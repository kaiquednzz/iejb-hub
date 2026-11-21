// "Repertórios" (D39): o que o Louvor já tocou. Depois que o culto passa, o
// repertório é de todo o ministério (antes dele, só de quem é do culto, D36).
//
// Perguntas que a tela responde:
//   * "o que tocamos no domingo passado?"   -> lista por mês, do mais novo
//   * "quando tocamos essa música?"         -> busca por música ou artista
//   * "o que o G2 costuma tocar?"           -> filtro por grupo
// Tocar numa música abre o "ouvir" (streamings), como na escala.
import { abrirWhatsApp, textoDoRepertorio } from '../util/compartilhar.js';
import { h, icone, comCarregando } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { mensagemDoBanco } from '../util/erros.js';
import { hojeEmBrasilia, formatarHorario, partesDaData } from '../util/datas.js';
import { cabecalhoApp, navLouvor } from './moldura.js';
import { folhaOuvir } from './repertorio.js';

const POR_PAGINA = 40;   // cultos por vez; "Ver mais antigos" busca os próximos

const MES = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const mesDe = (dataISO) => { const t = MES.format(new Date(`${dataISO}T12:00:00Z`)); return t.charAt(0).toUpperCase() + t.slice(1); };
const DATA_CURTA = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const dataCurta = (dataISO) => DATA_CURTA.format(new Date(`${dataISO}T12:00:00Z`)).replace('.', '').replace(/ de /g, ' ');
const normalizar = (t) => (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function telaRepertorios(conta) {
    let cultos = [];
    let acabou = false;
    let termo = '';
    let grupo = null;

    const busca = h('input', {
        type: 'search', class: 'busca-musica', placeholder: 'Procurar música ou artista',
        'aria-label': 'Procurar música ou artista', autocomplete: 'off', enterkeyhint: 'search',
    });
    const filtros = h('div', { class: 'chips-grupo filtros-grupo', role: 'group', 'aria-label': 'Filtrar por grupo' });
    const resumo = h('div', { class: 'historico-resumo', 'aria-live': 'polite' });
    const lista = h('div', { class: 'historico-lista', 'aria-busy': 'true' }, esqueleto());
    const mais = h('button', { type: 'button', class: 'botao-secundario botao-largo', hidden: true }, 'Ver mais antigos');

    let espera = null;
    busca.addEventListener('input', () => {
        clearTimeout(espera);
        espera = setTimeout(() => { termo = busca.value.trim(); desenhar(); }, 150);
    });
    mais.addEventListener('click', () => comCarregando(mais, carregar));

    const tela = h('div', { class: 'tela tela-app tela-repertorios' },
        cabecalhoApp(conta, { modulo: 'Louvor' }),
        h('main', { id: 'conteudo', class: 'app-conteudo' },
            navLouvor(conta, '#/repertorios'),
            h('div', { class: 'historico-busca' }, icone('lupa', 'icone icone-p'), busca),
            filtros,
            resumo,
            lista,
            mais,
        ),
    );
    carregar();
    return tela;

    async function carregar() {
        const ultimo = cultos.at(-1);
        let consulta = supabase.from('culto')
            .select(`id, nome, rotulo, data, horario,
                escala ( escala_grupo ( grupo:grupo_id ( id, nome ) ),
                    escala_item ( instrumento_exibido, saiu_em, pessoa:pessoa_id ( nome, apelido ) ) ),
                repertorio_item!inner ( id, posicao, tom, musica:musica_id ( id, titulo, artista, link, links_streaming ) )`)
            .eq('estado', 'ativo').lte('data', hojeEmBrasilia())
            .order('data', { ascending: false }).order('horario', { ascending: false })
            .order('posicao', { referencedTable: 'repertorio_item' })
            .limit(POR_PAGINA);
        if (ultimo) consulta = consulta.lt('data', ultimo.data);
        const { data, error } = await consulta;
        lista.removeAttribute('aria-busy');
        if (error) {
            console.error(error);
            lista.replaceChildren(h('div', { class: 'estado-vazio' },
                h('p', { class: 'estado-vazio-titulo' }, 'Não deu para carregar os repertórios.'),
                h('p', { class: 'estado-vazio-texto' }, mensagemDoBanco(error))));
            return;
        }
        // Culto de hoje que ainda não começou não é histórico
        const agora = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'medium' }).format(new Date()).replace(' ', 'T');
        cultos = cultos.concat(data.filter((c) => `${c.data}T${c.horario}` <= agora));
        acabou = data.length < POR_PAGINA;
        desenharFiltros();
        desenhar();
    }

    function gruposDe(culto) {
        return culto.escala.flatMap((e) => e.escala_grupo.map((g) => g.grupo)).filter(Boolean);
    }

    function desenharFiltros() {
        const todos = new Map();
        cultos.forEach((c) => gruposDe(c).forEach((g) => todos.set(g.id, g.nome)));
        if (todos.size < 2) { filtros.replaceChildren(); return; }
        const opcoes = [[null, 'Todos'], ...[...todos.entries()].sort((a, b) => a[1].localeCompare(b[1]))];
        filtros.replaceChildren(...opcoes.map(([id, nome]) => {
            const b = h('button', { type: 'button', class: 'chip-grupo', 'aria-pressed': String(grupo === id) }, nome);
            b.addEventListener('click', () => { grupo = id; desenharFiltros(); desenhar(); });
            return b;
        }));
    }

    function desenhar() {
        const t = normalizar(termo);
        const doGrupo = grupo ? cultos.filter((c) => gruposDe(c).some((g) => g.id === grupo)) : cultos;
        const combina = (m) => normalizar(`${m.titulo} ${m.artista ?? ''}`).includes(t);
        const visiveis = t ? doGrupo.filter((c) => c.repertorio_item.some((i) => combina(i.musica))) : doGrupo;

        // Buscando: um resumo por música ("tocada 3 vezes · última em 9 nov 2026")
        if (t) {
            const porMusica = new Map();
            for (const c of doGrupo) {
                for (const i of c.repertorio_item) {
                    if (!combina(i.musica)) continue;
                    const r = porMusica.get(i.musica.id) ?? { musica: i.musica, vezes: 0, ultima: c.data, tons: new Set() };
                    r.vezes++;
                    if (i.tom) r.tons.add(i.tom);
                    porMusica.set(i.musica.id, r);
                }
            }
            resumo.replaceChildren(...[...porMusica.values()].slice(0, 6).map((r) => {
                const b = h('button', { type: 'button', class: 'resumo-musica' },
                    h('span', { class: 'linha-textos' },
                        h('span', { class: 'linha-nome' }, r.musica.titulo),
                        h('span', { class: 'linha-detalhe' },
                            `${r.vezes === 1 ? 'Tocada 1 vez' : `Tocada ${r.vezes} vezes`} · última em ${dataCurta(r.ultima)}`,
                            r.tons.size ? ` · tom ${[...r.tons].join(', ')}` : '')),
                    icone('fone', 'icone icone-p'));
                b.addEventListener('click', () => folhaOuvir(r.musica));
                return b;
            }));
        } else {
            resumo.replaceChildren(...maisTocadas(doGrupo));
        }

        if (!visiveis.length) {
            lista.replaceChildren(h('div', { class: 'estado-vazio' },
                h('div', { class: 'estado-vazio-icone', 'aria-hidden': 'true' }, icone('historico')),
                h('p', { class: 'estado-vazio-titulo' }, t ? 'Nada encontrado' : 'Nenhum repertório ainda'),
                h('p', { class: 'estado-vazio-texto' }, t
                    ? (acabou ? `Essa música não aparece em nenhum culto${grupo ? ' desse grupo' : ''}.` : 'Não está nos cultos carregados. Toque em "Ver mais antigos" para procurar mais para trás.')
                    : 'Os repertórios aparecem aqui depois que o culto acontece.')));
        } else {
            // Agrupado por mês
            const meses = [];
            for (const c of visiveis) {
                const nome = mesDe(c.data);
                if (meses.at(-1)?.nome !== nome) meses.push({ nome, cultos: [] });
                meses.at(-1).cultos.push(c);
            }
            let n = 0;
            lista.replaceChildren(...meses.map((m) => h('section', { class: 'historico-mes' },
                h('h2', { class: 'historico-mes-titulo' }, m.nome),
                h('ul', { class: 'historico-cultos' }, m.cultos.map((c) => cartaoCulto(c, t, combina, n++))))));
        }
        mais.hidden = acabou;
    }

    function cartaoCulto(culto, t, combina, i) {
        const partes = partesDaData(culto.data);
        const grupos = gruposDe(culto).map((g) => g.nome);
        return h('li', { class: 'historico-culto', style: { '--i': Math.min(i, 8) } },
            h('div', { class: 'historico-topo' },
                h('span', { class: 'mini-data', 'aria-hidden': 'true' }, h('span', null, partes.semana), h('strong', null, partes.dia)),
                h('div', { class: 'historico-titulos' },
                    h('h3', null, culto.nome, culto.rotulo && h('span', { class: 'rotulo-culto' }, culto.rotulo)),
                    h('p', { class: 'historico-detalhe' },
                        `${dataCurta(culto.data)} · ${formatarHorario(culto.horario)}`,
                        grupos.length ? h('strong', null, ` · ${grupos.join(' + ')}`) : '')),
                // Mandar este repertório no WhatsApp (ícone no canto da capa)
                whatsCulto(culto)),
            h('ol', { class: 'historico-musicas' }, culto.repertorio_item.map((item) => {
                const b = h('button', { type: 'button', class: `historico-musica${t && combina(item.musica) ? ' achada' : ''}` },
                    h('span', { class: 'linha-textos' },
                        h('span', { class: 'linha-nome' }, item.musica.titulo),
                        item.musica.artista && h('span', { class: 'linha-detalhe' }, item.musica.artista)),
                    item.tom && h('span', { class: 'musica-tom' }, item.tom),
                    icone('fone', 'icone icone-p historico-fone'));
                b.addEventListener('click', () => folhaOuvir(item.musica));
                return h('li', null, b);
            })));
    }
}

// As mais tocadas (dos cultos já carregados): um ranking de boletim, só
// quando já existe histórico suficiente para dizer algo
function maisTocadas(cultos) {
    if (cultos.length < 3) return [];
    const conta = new Map();
    for (const c of cultos) for (const i of c.repertorio_item) {
        const r = conta.get(i.musica.id) ?? { musica: i.musica, vezes: 0 };
        r.vezes++;
        conta.set(i.musica.id, r);
    }
    const top = [...conta.values()].filter((r) => r.vezes > 1).sort((a, b) => b.vezes - a.vezes).slice(0, 5);
    if (top.length < 2) return [];
    return [h('section', { class: 'mais-tocadas', 'aria-labelledby': 'titulo-mais-tocadas' },
        h('h2', { id: 'titulo-mais-tocadas', class: 'rotulo-secao' }, 'As mais tocadas'),
        h('ol', { class: 'mais-tocadas-lista' }, top.map((r, i) => {
            const b = h('button', { type: 'button', class: 'mais-tocada' },
                h('span', { class: 'mais-tocada-n', 'aria-hidden': 'true' }, i + 1),
                h('span', { class: 'mais-tocada-nome' }, r.musica.titulo),
                h('span', { class: 'mais-tocada-vezes' }, `${r.vezes}×`, h('span', { class: 'sr-only' }, ' tocada')));
            b.addEventListener('click', () => folhaOuvir(r.musica));
            return h('li', null, b);
        })))];
}

function whatsCulto(culto) {
    const b = h('button', { type: 'button', class: 'botao-icone historico-whats', 'aria-label': `Mandar o repertório de ${culto.nome} no WhatsApp` }, icone('whatsapp'));
    b.addEventListener('click', () => abrirWhatsApp(textoDoRepertorio(culto)));
    return b;
}

function esqueleto() {
    return h('ul', { class: 'historico-cultos', 'aria-hidden': 'true' },
        [0, 1].map((i) => h('li', { class: 'historico-culto esqueleto', style: { '--i': i } })));
}
