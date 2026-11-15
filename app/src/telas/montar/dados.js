// Dados e contas da tela "Montar escala".
import { supabase } from '../../supabase.js';
import { hojeEmBrasilia, somarDias, formatarHorario } from '../../util/datas.js';
import { separarMesa, FUNCAO_MESA } from '../../util/escala.js';
import { nomeCurto } from '../../sessao.js';

// O mês da escala segue a planilha do líder: são as SEMANAS que começam
// (domingo) dentro do mês. A terça 01/12 entra na escala de novembro porque
// é da semana do domingo 29/11, exatamente como no PDF de hoje.
export function intervaloDoMes(mes) { // mes = 'AAAA-MM'
    const primeiro = `${mes}-01`;
    const diaSemana = new Date(`${primeiro}T12:00:00Z`).getUTCDay();
    const inicio = somarDias(primeiro, (7 - diaSemana) % 7); // 1º domingo do mês
    const [a, m] = mes.split('-').map(Number);
    const ultimo = new Date(Date.UTC(a, m, 0, 12)).toISOString().slice(0, 10);
    const ultimoDomingo = somarDias(ultimo, -new Date(`${ultimo}T12:00:00Z`).getUTCDay());
    return { inicio, fim: somarDias(ultimoDomingo, 6) };
}

export function somarMes(mes, n) {
    const [a, m] = mes.split('-').map(Number);
    const d = new Date(Date.UTC(a, m - 1 + n, 1, 12));
    return d.toISOString().slice(0, 7);
}

export function nomeDoMes(mes) {
    const t = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
        .format(new Date(`${mes}-01T12:00:00Z`));
    return t.charAt(0).toUpperCase() + t.slice(1);
}

// Mês que o líder provavelmente quer montar: depois do dia 20, já o próximo
export function mesSugerido() {
    const hoje = hojeEmBrasilia();
    return Number(hoje.slice(8)) > 20 ? somarMes(hoje.slice(0, 7), 1) : hoje.slice(0, 7);
}

export async function carregarMontagem(mes) {
    const { inicio, fim } = intervaloDoMes(mes);
    const hoje = hojeEmBrasilia();

    // Os cultos fixos (domingo e terça) aparecem sozinhos: gerar é idempotente
    // e só cria o que falta. Mês passado ou longe demais: nem tenta.
    if (fim >= hoje && fim <= somarDias(hoje, 366)) {
        await supabase.rpc('gerar_cultos', { p_ate: fim });
    }

    const [cultos, grupos, pessoas, ministerio, tipos] = await Promise.all([
        supabase.from('culto')
            .select(`id, nome, rotulo, data, horario, estado, tipo_culto_id,
                     tipo:tipo_culto_id ( gerar_sozinho, grupo_padrao_id ),
                     escala ( id, estado, escala_item ( id, pessoa_id, instrumento_exibido, origem_grupo_id, saiu_em ),
                              escala_grupo ( grupo_id ) )`)
            .eq('tem_louvor', true)
            .gte('data', inicio).lte('data', fim)
            .order('data').order('horario'),
        supabase.from('grupo')
            .select('id, nome, grupo_membro!grupo_membro_grupo_id_fkey ( pessoa_id )')
            .eq('ativo', true).order('nome'),
        supabase.from('pessoa')
            .select('id, nome, apelido, instrumentos, foto, ativa, membro_ministerio ( ministerio_id, ativo )')
            .order('nome'),
        supabase.from('ministerio').select('id').eq('nome', 'Louvor').maybeSingle(),
        supabase.from('tipo_culto').select('id, nome, dia_semana, horario, gerar_sozinho, grupo_padrao_id, tem_louvor').eq('ativo', true),
    ]);
    const erro = cultos.error || grupos.error || pessoas.error || ministerio.error || tipos.error;
    if (erro) return { erro };

    const ministerioId = ministerio.data?.id;
    const porId = new Map(pessoas.data.map((p) => [p.id, p]));
    const grupoPorId = new Map(grupos.data.map((g) => [g.id, g]));
    const doLouvor = pessoas.data.filter((p) => p.ativa &&
        p.membro_ministerio.some((m) => m.ministerio_id === ministerioId && m.ativo));

    const lista = cultos.data.map((c) => {
        const escala = c.escala?.[0] ?? null;
        const itens = escala?.escala_item ?? [];
        const { mesa } = separarMesa(itens);
        return {
            ...c,
            escala,
            itens,
            gruposIds: (escala?.escala_grupo ?? []).map((g) => g.grupo_id)
                .sort((a, b) => grupoPorId.get(a)?.nome.localeCompare(grupoPorId.get(b)?.nome)),
            mesa: mesa.map((i) => porId.get(i.pessoa_id)).filter(Boolean),
            // "fixo" = semanal (domingo, terça): é o que o grupo da semana
            // preenche. O Culto de Jovens tem tipo, mas é "quando tiver" e
            // tem grupo próprio (D41): fica fora do grupo da semana.
            fixo: c.tipo?.gerar_sozinho === true,
            ativo: c.estado === 'ativo',
            passou: c.data < hoje,
        };
    });

    return {
        dados: {
            mes, inicio, fim, ministerioId,
            cultos: lista,
            semanas: agruparPorSemana(lista, inicio, fim),
            grupos: grupos.data,
            // Tipos "quando tiver" (Culto de Jovens): o líder cria no dia que quiser
            tiposQuandoTiver: tipos.data.filter((t) => !t.gerar_sozinho && t.tem_louvor),
            grupoPorId,
            porId,
            doLouvor,
        },
    };
}

function agruparPorSemana(cultos, inicio, fim) {
    const semanas = [];
    for (let domingo = inicio; domingo <= fim; domingo = somarDias(domingo, 7)) {
        const sabado = somarDias(domingo, 6);
        semanas.push({ domingo, cultos: cultos.filter((c) => c.data >= domingo && c.data <= sabado) });
    }
    return semanas;
}

// Quem pode ir para a mesa: primeiro quem tem "Mesa" nos instrumentos
export function candidatosAMesa(dados) {
    const fazem = dados.doLouvor.filter((p) => p.instrumentos.some((i) => i.toLowerCase() === FUNCAO_MESA.toLowerCase()));
    const outros = dados.doLouvor.filter((p) => !fazem.includes(p));
    return { fazem, outros };
}

export function nomesDosGrupos(culto, dados) {
    return culto.gruposIds.map((id) => dados.grupoPorId.get(id)?.nome).filter(Boolean);
}

// ---------------------------------------------------------------------------
// A mensagem do WhatsApp: o "PDF da planilha" em texto, com o link do app
// ---------------------------------------------------------------------------
const DIA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function textoDoMes(dados) {
    const linhas = [`*Escala do Louvor IEJB · ${nomeDoMes(dados.mes)}*`, ''];
    const publicadas = dados.cultos.filter((c) => c.escala?.estado === 'publicada' || !c.ativo);
    let semanaAnterior = null;

    for (const c of publicadas) {
        const semana = dados.semanas.find((s) => s.cultos.includes(c))?.domingo;
        if (semanaAnterior && semana !== semanaAnterior) linhas.push('');
        semanaAnterior = semana;

        const d = new Date(`${c.data}T12:00:00Z`);
        const quando = `${DIA_CURTO[d.getUTCDay()]} ${c.data.slice(8)}/${c.data.slice(5, 7)}`;
        const nome = c.fixo ? '' : ` · ${c.nome}`;
        const rotulo = c.rotulo ? ` · ${c.rotulo.toUpperCase()}` : '';
        if (!c.ativo) {
            linhas.push(`~${quando}${nome}~ cancelado`);
            continue;
        }
        const grupos = nomesDosGrupos(c, dados);
        const quem = grupos.length ? grupos.join(' + ') : 'equipe especial';
        const mesa = c.mesa.length ? ` · Mesa: ${c.mesa.map((p) => nomeCurto(p)).join(', ')}` : '';
        // Horário só nos especiais: os fixos todo mundo já sabe (como na planilha)
        const hora = c.fixo ? '' : ` ${formatarHorario(c.horario)}`;
        linhas.push(`*${quando}${rotulo}*${nome}${hora}: ${quem}${mesa}`);
    }

    linhas.push('', 'Equipe da mesa/som chega junto com o grupo de louvor.',
        '', `Quem toca o quê e o repertório: ${location.origin}`);
    return linhas.join('\n');
}
