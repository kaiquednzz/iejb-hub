// Folhas da montagem: um culto em detalhe, a escolha da mesa, culto especial.
import { h, icone, comCarregando } from '../../util/dom.js';
import { supabase } from '../../supabase.js';
import { abrirFolha, confirmar, avisar } from '../../util/folha.js';
import { mensagemDoBanco } from '../../util/erros.js';
import { rotuloDoDia, formatarHorario, hojeEmBrasilia, somarDias, partesDaData } from '../../util/datas.js';
import { FUNCAO_MESA, naoVai } from '../../util/escala.js';
import { avatar } from '../../util/foto.js';
import { nomeCurto } from '../../sessao.js';
import { campo, caixaDeAviso } from '../moldura.js';
import { seletorInstrumentos, interruptor } from '../equipe/pecas.js';
import { candidatosAMesa, nomesDosGrupos } from './dados.js';
import { comemorar } from '../../util/comemorar.js';

const ROTULO_CEIA = 'Ceia';
const SUGESTOES = ['Voz', 'Violão', 'Guitarra', 'Baixo', 'Teclado', 'Bateria', 'Cajón', FUNCAO_MESA];

// ---------------------------------------------------------------------------
// Um culto: grupos (pode misturar), mesa, ceia, pessoas, publicar, cancelar.
// A folha se redesenha depois de cada mudança com os dados novos.
// ---------------------------------------------------------------------------
export function abrirCulto(cultoId, ctx) {
    const folha = abrirFolha({ titulo: 'Culto', conteudo: h('div') });
    redesenhar();

    function redesenhar() {
        const dados = ctx.dados();
        const culto = dados.cultos.find((c) => c.id === cultoId);
        if (!culto) return folha.fechar();
        folha.elemento.querySelector('.folha-topo h2').textContent = culto.nome;
        folha.trocarConteudo(conteudo(culto, dados));
    }

    // Roda uma ação, recarrega o mês e redesenha a folha
    async function fazer(acao, sucesso) {
        const { error } = await acao();
        if (error) { avisar(mensagemDoBanco(error)); return false; }
        if (sucesso) avisar(sucesso);
        await ctx.recarregar();
        redesenhar();
        return true;
    }

    function conteudo(culto, dados) {
        const publicada = culto.escala?.estado === 'publicada';
        const partes = [
            h('p', { class: 'folha-texto culto-quando' },
                `${rotuloDoDia(culto.data)} · ${formatarHorario(culto.horario)}`,
                publicada ? h('span', { class: 'estado-pill estado-publicada' }, 'Publicada')
                    : culto.itens.length ? h('span', { class: 'estado-pill estado-rascunho' }, 'Rascunho · só você vê') : null),
        ];

        if (!culto.ativo) {
            const reativar = h('button', { type: 'button', class: 'botao-secundario botao-largo' }, 'Reativar culto');
            reativar.addEventListener('click', () => comCarregando(reativar, () =>
                fazer(() => supabase.from('culto').update({ estado: 'ativo' }).eq('id', culto.id), 'Culto reativado.')));
            return h('div', { class: 'folha-pilha' }, partes,
                h('p', { class: 'folha-texto' }, 'Este culto foi cancelado. Quem estava escalado foi avisado.'), reativar);
        }

        // Grupos: mais de um = grupos mesclados (cultos especiais)
        partes.push(h('section', { class: 'bloco bloco-sem-linha' },
            h('h3', { class: 'bloco-titulo' }, 'Grupos'),
            h('div', { class: 'chips-grupo chips-grupo-grande', role: 'group', 'aria-label': 'Grupos deste culto' },
                dados.grupos.map((g) => {
                    const marcado = culto.gruposIds.includes(g.id);
                    const chip = h('button', { type: 'button', class: 'chip-grupo', 'aria-pressed': String(marcado) },
                        g.nome, grupoVazio(g) && h('span', { class: 'chip-vazio' }, 'vazio'));
                    chip.addEventListener('click', async () => {
                        chip.classList.add('carregando-chip');
                        const novos = marcado ? culto.gruposIds.filter((id) => id !== g.id) : [...culto.gruposIds, g.id];
                        await fazer(() => supabase.rpc('definir_grupos_do_culto', {
                            p_culto: culto.id, p_ministerio: dados.ministerioId, p_grupos: novos,
                        }));
                        if (!marcado && grupoVazio(g)) avisarGrupoVazio(g);
                    });
                    return chip;
                })),
            h('p', { class: 'bloco-texto' }, 'Toque em mais de um para juntar grupos (culto especial).'),
        ));

        // Pessoas da escala (sem quem está só pela mesa: isso fica no bloco da mesa)
        const pessoas = culto.itens
            .filter((i) => i.instrumento_exibido.some((x) => x !== FUNCAO_MESA) || !i.instrumento_exibido.includes(FUNCAO_MESA))
            .map((i) => ({ ...i, pessoa: dados.porId.get(i.pessoa_id) }))
            .filter((i) => i.pessoa)
            .sort((a, b) => nomeCurto(a.pessoa).localeCompare(nomeCurto(b.pessoa), 'pt-BR'));

        const adicionar = h('button', { type: 'button', class: 'botao-secundario botao-pequeno' }, icone('mais', 'icone icone-p'), 'Pessoa');
        adicionar.addEventListener('click', () => folhaAdicionarPessoa(culto, dados, fazer));
        partes.push(h('section', { class: 'bloco' },
            h('div', { class: 'bloco-topo' }, h('h3', { class: 'bloco-titulo' }, `Quem toca (${pessoas.filter((i) => !naoVai(i)).length})`), adicionar),
            pessoas.length === 0
                ? h('p', { class: 'bloco-texto' }, 'Escolha um grupo acima ou adicione pessoas.')
                : h('ul', { class: 'lista-linhas lista-linhas-compacta' }, pessoas.map((item) => {
                    const linha = h('button', { type: 'button', class: 'linha-caixa linha-tocavel' },
                        avatar(item.pessoa),
                        h('span', { class: 'linha-textos' },
                            h('span', { class: 'linha-nome' }, nomeCurto(item.pessoa)),
                            naoVai(item)
                                ? h('span', { class: 'linha-detalhe linha-nao-vai' }, 'Avisou que não vai · toque para trocar')
                                : h('span', { class: 'linha-detalhe' },
                                    item.instrumento_exibido.filter((x) => x !== FUNCAO_MESA).join(', ') || 'sem instrumento',
                                    !item.origem_grupo_id && ' · avulso')),
                        icone('seta', 'icone icone-p linha-seta'));
                    linha.addEventListener('click', () => folhaItem(item, culto, fazer));
                    return h('li', { class: 'linha' }, linha);
                })),
        ));

        // Mesa
        const mesa = h('button', { type: 'button', class: `chip-mesa chip-mesa-largo${culto.mesa.length ? ' definida' : ''}` },
            h('span', { class: 'chip-mesa-rotulo' }, 'Mesa'),
            culto.mesa.length ? culto.mesa.map((p) => nomeCurto(p)).join(', ') : 'escolher quem fica no som');
        mesa.addEventListener('click', () => folhaMesa(culto, ctx, redesenhar));
        partes.push(h('section', { class: 'bloco' }, h('h3', { class: 'bloco-titulo' }, 'Som'), mesa));

        // Ceia
        partes.push(h('section', { class: 'bloco' }, interruptor({
            rotulo: 'Culto de Ceia',
            descricao: 'Aparece destacado na escala e na mensagem.',
            ligado: culto.rotulo === ROTULO_CEIA,
            aoMudar: (valor) => fazer(() => supabase.from('culto')
                .update({ rotulo: valor ? ROTULO_CEIA : null }).eq('id', culto.id)),
        })));

        // Publicar este (o botão grande da tela publica o mês todo)
        const finais = [];
        // Reserva do push (RN-43): mensagem pronta desta escala para o grupo do WhatsApp
        if (publicada) {
            finais.push(h('a', {
                class: 'botao-secundario botao-largo', target: '_blank', rel: 'noopener noreferrer',
                href: `https://wa.me/?text=${encodeURIComponent(mensagemDoCulto(culto, dados))}`,
            }, icone('whatsapp'), 'Mandar esta escala no WhatsApp'));
        }
        if (!publicada && culto.itens.length > 0) {
            const publicar = h('button', { type: 'button', class: 'botao-principal botao-largo' }, 'Publicar só este culto');
            publicar.addEventListener('click', () => comCarregando(publicar, () =>
                fazer(() => supabase.from('escala').update({ estado: 'publicada' }).eq('id', culto.escala.id))
                    .then((ok) => ok && comemorar('Culto publicado!', 'Quem foi escalado já recebe o aviso.'))));
            finais.push(publicar);
        }
        const cancelar = h('button', { type: 'button', class: 'botao-texto-perigo' }, 'Cancelar este culto');
        cancelar.addEventListener('click', async () => {
            const ok = await confirmar({
                titulo: 'Cancelar o culto?',
                texto: publicada ? 'Quem está escalado vai ser avisado do cancelamento.' : 'Ele sai da escala do mês. Dá para reativar.',
                botao: 'Cancelar culto', perigo: true,
            });
            if (ok) fazer(() => supabase.from('culto').update({ estado: 'cancelado' }).eq('id', culto.id), 'Culto cancelado.');
        });
        finais.push(cancelar);
        partes.push(h('div', { class: 'bloco bloco-final' }, finais));

        return h('div', { class: 'folha-pilha' }, partes);
    }
}

// Instrumento da pessoa NESTE culto (RN-17: pode ser diferente do padrão do grupo)
export function folhaItem(item, culto, fazer) {
    const temMesa = item.instrumento_exibido.includes(FUNCAO_MESA);
    const seletor = seletorInstrumentos({
        sugestoes: SUGESTOES.filter((s) => s !== FUNCAO_MESA),
        marcados: item.instrumento_exibido.filter((x) => x !== FUNCAO_MESA),
        rotulo: 'Neste culto toca',
    });
    const salvar = h('button', { type: 'button', class: 'botao-principal botao-largo' }, 'Salvar');
    const tirar = h('button', { type: 'button', class: 'botao-texto-perigo' }, 'Tirar deste culto');

    const folha = abrirFolha({
        titulo: nomeCurto(item.pessoa),
        conteudo: h('div', { class: 'form' },
            h('p', { class: 'folha-texto' }, 'Vale só para este culto. O padrão do grupo não muda.'),
            seletor.elemento, salvar, h('div', { class: 'bloco bloco-final' }, tirar)),
    });
    salvar.addEventListener('click', () => comCarregando(salvar, async () => {
        const instrumentos = [...seletor.valores(), ...(temMesa ? [FUNCAO_MESA] : [])];
        if (await fazer(() => supabase.from('escala_item').update({ instrumento_exibido: instrumentos }).eq('id', item.id), 'Salvo.')) folha.fechar();
    }));
    tirar.addEventListener('click', () => comCarregando(tirar, async () => {
        if (await fazer(() => supabase.from('escala_item').delete().eq('id', item.id),
            culto.escala?.estado === 'publicada' ? `${nomeCurto(item.pessoa)} saiu. Vai ser avisado.` : 'Tirado.')) folha.fechar();
    }));
}

// Pessoa avulsa (substituição combinada, D16; ou culto especial)
export function folhaAdicionarPessoa(culto, dados, fazer) {
    const jaEstao = new Set(culto.itens.map((i) => i.pessoa_id));
    const candidatas = dados.doLouvor.filter((p) => !jaEstao.has(p.id));
    if (candidatas.length === 0) {
        abrirFolha({ titulo: 'Adicionar pessoa', conteudo: h('p', { class: 'folha-texto' }, 'Todo mundo do Louvor já está neste culto.') });
        return;
    }
    let escolhida = null;
    const aviso = caixaDeAviso();
    const seletor = seletorInstrumentos({ sugestoes: SUGESTOES.filter((s) => s !== FUNCAO_MESA), rotulo: 'Neste culto toca' });
    const opcoes = h('div', { class: 'escolha-pessoas', role: 'radiogroup', 'aria-label': 'Quem entra' },
        candidatas.map((p) => {
            const b = h('button', { type: 'button', role: 'radio', 'aria-checked': 'false', class: 'escolha-pessoa' }, nomeCurto(p));
            b.addEventListener('click', () => {
                escolhida = p;
                opcoes.querySelectorAll('[role=radio]').forEach((o) => o.setAttribute('aria-checked', String(o === b)));
                seletor.marcar(p.instrumentos.filter((i) => i !== FUNCAO_MESA));
            });
            return b;
        }));
    const salvar = h('button', { type: 'button', class: 'botao-principal botao-largo' }, 'Adicionar');
    const folha = abrirFolha({
        titulo: 'Adicionar pessoa',
        conteudo: h('div', { class: 'form' },
            h('fieldset', { class: 'campo' }, h('legend', null, 'Quem entra'), opcoes),
            seletor.elemento, aviso.elemento, salvar),
    });
    salvar.addEventListener('click', () => comCarregando(salvar, async () => {
        if (!escolhida) return aviso.mostrar('Escolha quem entra.');
        // A escala pode ainda não existir: o grupo vazio cria sem mudar nada
        let escalaId = culto.escala?.id;
        if (!escalaId) {
            const { data, error } = await supabase.rpc('definir_grupos_do_culto', {
                p_culto: culto.id, p_ministerio: dados.ministerioId, p_grupos: culto.gruposIds,
            });
            if (error) return aviso.mostrar(mensagemDoBanco(error));
            escalaId = data;
        }
        const ok = await fazer(() => supabase.from('escala_item').insert({
            escala_id: escalaId, pessoa_id: escolhida.id, instrumento_exibido: seletor.valores(),
        }), `${nomeCurto(escolhida)} entrou.`);
        if (ok) folha.fechar();
    }));
}

// ---------------------------------------------------------------------------
// Mesa de som: um toque escolhe. Quem tem "Mesa" nos instrumentos vem primeiro.
// ---------------------------------------------------------------------------
export function folhaMesa(culto, ctx, depois) {
    const dados = ctx.dados();
    const { fazem, outros } = candidatosAMesa(dados);
    const atual = new Set(culto.mesa.map((p) => p.id));

    const opcao = (p) => {
        const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(atual.has(p?.id ?? null) || (!p && atual.size === 0)), class: 'opcao-mesa' },
            p ? avatar(p) : h('span', { class: 'pessoa-avatar', 'aria-hidden': 'true' }, '–'),
            h('span', null, p ? nomeCurto(p) : 'Ninguém'));
        b.addEventListener('click', async () => {
            b.classList.add('carregando-chip');
            const { error } = await supabase.rpc('definir_mesa', {
                p_culto: culto.id, p_ministerio: dados.ministerioId, p_pessoa: p?.id ?? null,
            });
            if (error) { b.classList.remove('carregando-chip'); return avisar(mensagemDoBanco(error)); }
            folha.fechar();
            await ctx.recarregar();
            depois?.();
        });
        return b;
    };

    const folha = abrirFolha({
        titulo: `Mesa · ${rotuloDoDia(culto.data)}`,
        conteudo: h('div', { class: 'form' },
            fazem.length === 0 && h('p', { class: 'folha-texto' },
                'Dica: marque "Mesa" nos instrumentos de quem opera o som (em Equipe → Pessoas) para essas pessoas aparecerem primeiro.'),
            h('div', { class: 'grade-mesa', role: 'radiogroup', 'aria-label': 'Quem fica na mesa' },
                fazem.map(opcao), opcao(null)),
            outros.length > 0 && h('details', { class: 'grupo-recolhido', open: fazem.length === 0 },
                h('summary', null, fazem.length ? `Outras pessoas (${outros.length})` : `Todo o Louvor (${outros.length})`),
                h('div', { class: 'grade-mesa', role: 'radiogroup', 'aria-label': 'Outras pessoas' }, outros.map(opcao))),
        ),
    });
}

// ---------------------------------------------------------------------------
// Culto especial (RN-22): Jovens no sábado, evento, ceia extra...
// ---------------------------------------------------------------------------
export function folhaCultoEspecial(dados, ctx) {
    const aviso = caixaDeAviso();
    const botao = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, 'Criar culto');
    const hoje = hojeEmBrasilia();
    const form = h('form', { class: 'form', novalidate: true },
        campo({ rotulo: 'Nome', nome: 'nome', autocomplete: 'off', autocapitalize: 'sentences', placeholder: 'Ex.: Culto de Jovens' }),
        h('div', { class: 'fichas' }, ['Culto Especial', 'Santa Ceia', 'Vigília', 'Conferência'].map((n) => {
            const f = h('button', { type: 'button', class: 'ficha' }, n);
            f.addEventListener('click', () => { form.elements.nome.value = n; });
            return f;
        })),
        h('div', { class: 'campos-lado' },
            campo({ rotulo: 'Data', nome: 'data', tipo: 'date', min: hoje, value: dados.inicio > hoje ? dados.inicio : hoje }),
            campo({ rotulo: 'Horário', nome: 'horario', tipo: 'time', value: '19:30' }),
        ),
        aviso.elemento,
        botao,
    );
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        aviso.limpar();
        const nome = form.elements.nome.value.trim();
        const data = form.elements.data.value;
        const horario = form.elements.horario.value;
        if (!nome) return aviso.mostrar('Dê um nome ao culto.');
        if (!data || !horario) return aviso.mostrar('Escolha data e horário.');
        await comCarregando(botao, async () => {
            const { data: criado, error } = await supabase.from('culto')
                .insert({ nome, data, horario, tem_louvor: true }).select('id').single();
            if (error) return aviso.mostrar(mensagemDoBanco(error));
            folha.fechar();
            const atualizados = await ctx.recarregar();
            // Data fora das semanas deste mês: ele aparece quando abrir o mês dele
            if (atualizados?.cultos.some((c) => c.id === criado.id)) {
                avisar('Culto criado. Agora escolha o grupo.');
                abrirCulto(criado.id, ctx);
            } else {
                avisar(`Culto criado para ${rotuloDoDia(data)}. Ele aparece no mês dele.`);
            }
        });
    });
    const folha = abrirFolha({ titulo: 'Culto especial', conteudo: form });
}

// Grupo sem ninguém cadastrado: escolher não traz pessoas, e o líder achava
// que era defeito. Agora o chip diz "vazio" e escolher avisa onde cadastrar.
export const grupoVazio = (g) => !(g.grupo_membro?.length);
export function avisarGrupoVazio(g) {
    avisar(`O ${g.nome} ainda não tem ninguém cadastrado. Cadastre os membros em Equipe › Grupos que eles entram na escala sozinhos.`);
}

// "Adicionar culto": os tipos "quando tiver" (Culto de Jovens, D41) primeiro,
// com o grupo padrão já escalado; depois o culto especial de nome livre.
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export function folhaAdicionarCulto(dados, ctx) {
    const opcoes = dados.tiposQuandoTiver.map((tipo) => {
        const grupo = dados.grupoPorId.get(tipo.grupo_padrao_id);
        const b = h('button', { type: 'button', class: 'opcao-culto' },
            h('span', { class: 'opcao-culto-nome' }, tipo.nome),
            h('span', { class: 'opcao-culto-detalhe' },
                `${DIAS[tipo.dia_semana]}, ${formatarHorario(tipo.horario)}`, grupo ? ` · ${grupo.nome}` : ''),
            icone('seta', 'icone icone-p'));
        b.addEventListener('click', () => { folha.fechar(); folhaCultoDoTipo(tipo, dados, ctx); });
        return b;
    });
    const especial = h('button', { type: 'button', class: 'opcao-culto' },
        h('span', { class: 'opcao-culto-nome' }, 'Outro culto especial'),
        h('span', { class: 'opcao-culto-detalhe' }, 'Ceia, vigília, conferência... com nome, dia e hora livres'),
        icone('seta', 'icone icone-p'));
    especial.addEventListener('click', () => { folha.fechar(); folhaCultoEspecial(dados, ctx); });
    const folha = abrirFolha({ titulo: 'Adicionar culto', conteudo: h('div', { class: 'form' }, ...opcoes, especial) });
}

// Culto de Jovens: escolhe um dos próximos sábados (os que ainda não têm)
function folhaCultoDoTipo(tipo, dados, ctx) {
    const hoje = hojeEmBrasilia();
    const aviso = caixaDeAviso();
    const jaTem = new Set(dados.cultos.filter((c) => c.tipo_culto_id === tipo.id).map((c) => c.data));
    const datas = [];
    for (let d = dados.inicio; d <= dados.fim; d = somarDias(d, 1)) {
        if (d >= hoje && new Date(`${d}T12:00:00Z`).getUTCDay() === tipo.dia_semana) datas.push(d);
    }
    let escolhida = datas.find((d) => !jaTem.has(d)) ?? null;
    const fichas = h('div', { class: 'fichas fichas-datas', role: 'group', 'aria-label': 'Dia' });
    const desenhar = () => fichas.replaceChildren(...datas.map((d) => {
        const p = partesDaData(d);
        const f = h('button', { type: 'button', class: 'ficha', 'aria-pressed': String(d === escolhida), disabled: jaTem.has(d) },
            `${p.dia} ${p.mes}`, jaTem.has(d) && ' · já tem');
        f.addEventListener('click', () => { escolhida = d; desenhar(); });
        return f;
    }));
    desenhar();
    const grupo = dados.grupoPorId.get(tipo.grupo_padrao_id);
    const horario = campo({ rotulo: 'Horário', nome: 'horario', tipo: 'time', value: tipo.horario.slice(0, 5) });
    const criar = h('button', { type: 'button', class: 'botao-principal botao-largo' }, `Criar ${tipo.nome}`);
    criar.addEventListener('click', () => comCarregando(criar, async () => {
        aviso.limpar();
        if (!escolhida) return aviso.mostrar(`Escolha o dia.`);
        const { data: id, error } = await supabase.rpc('criar_culto_do_tipo', {
            p_tipo: tipo.id, p_data: escolhida, p_horario: horario.querySelector('input').value || null, p_ministerio: dados.ministerioId,
        });
        if (error) return aviso.mostrar(mensagemDoBanco(error));
        folha.fechar();
        await ctx.recarregar();
        avisar(grupo ? `${tipo.nome} criado com o ${grupo.nome}. Toque nele para trocar o grupo.` : `${tipo.nome} criado.`);
        if (grupo && grupoVazio(grupo)) avisarGrupoVazio(grupo);
        abrirCulto(id, ctx);
    }));
    const folha = abrirFolha({
        titulo: tipo.nome,
        conteudo: h('div', { class: 'form' },
            h('fieldset', { class: 'campo' }, h('legend', null, datas.length ? `Qual ${DIAS[tipo.dia_semana]}?` : 'Dia'),
                datas.length ? fichas : h('p', { class: 'campo-dica' }, `Não sobrou nenhum ${DIAS[tipo.dia_semana]} neste mês. Troque o mês no topo.`)),
            horario,
            grupo && h('p', { class: 'folha-texto folha-texto-pequeno' }, `Já vem com o ${grupo.nome}${grupoVazio(grupo) ? ' (que ainda não tem ninguém cadastrado)' : ''}. Dá para trocar depois.`),
            aviso.elemento,
            criar,
        ),
    });
}

// RN-43: "Escala atualizada: Culto de Oração, ter 18/11, 19h30 / Tocam: G2 + Fulano"
function mensagemDoCulto(culto, dados) {
    const grupos = nomesDosGrupos(culto, dados);
    const avulsos = culto.itens
        .filter((i) => !i.origem_grupo_id && i.instrumento_exibido.some((x) => x !== FUNCAO_MESA))
        .map((i) => nomeCurto(dados.porId.get(i.pessoa_id)));
    const tocam = [...grupos, ...avulsos].join(' + ') || 'a definir';
    return [
        `*Escala atualizada: ${culto.nome}${culto.rotulo ? ` (${culto.rotulo})` : ''}*`,
        `${rotuloDoDia(culto.data)}, ${formatarHorario(culto.horario)}`,
        `Tocam: ${tocam}`,
        culto.mesa.length ? `Mesa: ${culto.mesa.map((p) => nomeCurto(p)).join(', ')}` : null,
        '',
        `Veja no Hub: ${location.origin}`,
    ].filter((l) => l !== null).join('\n');
}
