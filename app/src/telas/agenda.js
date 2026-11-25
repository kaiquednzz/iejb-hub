// Agenda (redesign v2): cultos da igreja, participação pessoal quando houver
// escala publicada, e eventos do site, numa linha do tempo só por mês.
import { h, icone } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { hojeEmBrasilia, somarDias, formatarHorario, partesDaData, diasEntre } from '../util/datas.js';
import { cabecalhoApp } from './moldura.js';
import { blocoData, linhaDoEvento } from './inicio-eventos.js';
import { proximosEventos } from '../util/eventos.js';
import { naoVai, FUNCAO_MESA } from '../util/escala.js';
import { escalaGuardada } from '../offline.js';
import { botaoAgenda } from '../util/agenda.js';
import { marcarEscalado } from '../util/chama.js';

const SEMANAS = 10;
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function telaAgenda(conta) {
    const lista = h('div', { class: 'agenda', 'aria-busy': 'true' }, esqueleto());
    const tela = h('div', { class: 'tela tela-app tela-agenda' },
        cabecalhoApp(conta),
        h('main', { id: 'conteudo', class: 'app-conteudo' },
            h('div', { class: 'escala-topo' },
                h('h1', { tabindex: -1, class: 'titulo-tela' }, 'Agenda'),
                botaoAgenda()),
            h('p', { class: 'subtitulo-tela' }, 'Onde você toca e o que vem aí na igreja.'),
            lista,
        ),
    );
    carregar();
    return tela;

    async function carregar() {
        const [cultos, eventos] = await Promise.all([cultosDaIgreja(conta), proximosEventos().catch(() => [])]);
        lista.removeAttribute('aria-busy');
        const itens = [
            ...cultos.map((c) => ({ tipo: 'culto', data: c.data, hora: c.horario, c })),
            ...eventos.map((e) => ({ tipo: 'evento', data: e.data, hora: e.horario, e })),
        ].sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));

        if (!itens.length) {
            lista.replaceChildren(h('div', { class: 'estado' },
                h('span', { class: 'estado-icone' }, icone('calendario')),
                h('p', { class: 'estado-titulo' }, 'Nada na sua agenda por enquanto'),
                h('p', { class: 'estado-texto' }, 'Quando você entrar numa escala ou a igreja marcar um evento, ele aparece aqui.')));
            return;
        }

        // Agrupa por mês: cada mês é uma "seção" do boletim
        const meses = new Map();
        for (const item of itens) {
            const chave = item.data.slice(0, 7);
            if (!meses.has(chave)) meses.set(chave, []);
            meses.get(chave).push(item);
        }
        const hoje = hojeEmBrasilia();
        let i = 0;
        lista.replaceChildren(...[...meses].map(([chave, doMes]) => {
            const [ano, mes] = chave.split('-').map(Number);
            const esteAno = Number(hoje.slice(0, 4)) === ano;
            return h('section', { class: 'agenda-mes', 'aria-label': `${MESES[mes - 1]}${esteAno ? '' : ` de ${ano}`}` },
                h('h2', { class: 'agenda-mes-nome' }, MESES[mes - 1], esteAno ? null : h('span', null, ` ${ano}`)),
                h('ul', { class: 'grupo-lista' }, doMes.map((item) => {
                    const li = h('li', { style: { '--i': i++ } }, item.tipo === 'culto' ? linhaDoCulto(item.c, conta, hoje) : linhaDoEvento(item.e));
                    if (item.tipo === 'evento') li.firstChild.classList.add('agenda-evento');
                    return li;
                })));
        }));
    }
}

// Cultos ativos da igreja nas próximas semanas. A escala embutida fica
// filtrada para a pessoa atual, mas não remove da lista os cultos sem escala dela.
export async function cultosDaIgreja(conta) {
    const meuId = conta.pessoa?.id;
    const hoje = hojeEmBrasilia();
    let consulta = supabase.from('culto')
        .select('id, nome, rotulo, data, horario, estado, escala ( estado, escala_item ( pessoa_id, instrumento_exibido, saiu_em ) )')
        .eq('estado', 'ativo').gte('data', hoje).lte('data', somarDias(hoje, SEMANAS * 7))
        .order('data').order('horario');
    if (meuId) consulta = consulta.eq('escala.escala_item.pessoa_id', meuId);
    const { data, error } = await consulta;
    const cultos = error ? (escalaGuardada(conta.id)?.cultos ?? []).filter((c) => c.data >= hoje) : data;
    const minhaEscala = (c) => c.escala?.some((e) => e.estado === 'publicada'
        && e.escala_item.some((it) => it.pessoa_id === meuId && !naoVai(it)));
    marcarEscalado(cultos.find(minhaEscala)?.data ?? null);
    return cultos;
}

function linhaDoCulto(culto, conta, hoje) {
    const eu = (culto.escala ?? []).filter((e) => e.estado === 'publicada')
        .flatMap((e) => e.escala_item ?? []).find((i) => i.pessoa_id === conta.pessoa?.id);
    const vai = Boolean(eu) && !naoVai(eu);
    const naoVaiPessoa = Boolean(eu) && naoVai(eu);
    const funcoes = (eu?.instrumento_exibido ?? []).map((x) => (x === FUNCAO_MESA ? 'Mesa de som' : x)).join(', ');
    const p = partesDaData(culto.data);
    const dias = diasEntre(hoje, culto.data);
    const quando = dias === 0 ? 'Hoje' : dias === 1 ? 'Amanhã' : `${p.semana.charAt(0).toUpperCase()}${p.semana.slice(1)}`;
    return h(eu ? 'a' : 'div', {
        class: `item-lista agenda-culto${eu ? '' : ' agenda-culto-informativo'}${naoVaiPessoa ? ' nao-vai' : ''}`,
        ...(eu ? { href: '#/escala' } : {}),
    },
        blocoData(culto.data),
        h('span', { class: 'item-textos' },
            h('span', { class: 'item-nome' }, culto.nome, culto.rotulo ? ` · ${culto.rotulo}` : ''),
            h('span', { class: 'item-apoio' }, `${quando} · ${formatarHorario(culto.horario)}${funcoes ? ` · ${funcoes}` : ''}`),
            h('span', { class: `agenda-marca${eu && !vai ? ' agenda-marca-nao' : ''}` },
                !eu ? 'Culto da igreja' : vai ? 'Você serve' : 'Você avisou que não vai')),
        icone('seta', 'icone icone-p item-seta'));
}

function esqueleto() {
    return h('div', { class: 'agenda-mes', 'aria-hidden': 'true' },
        h('div', { class: 'esqueleto', style: { height: '28px', width: '40%', margin: '24px 0 12px', borderRadius: '8px' } }),
        h('div', { class: 'esqueleto', style: { height: '210px', borderRadius: '20px' } }));
}
