// "Ver a escala": os próximos cultos com quem toca o quê e o repertório.
//
// Uma consulta só traz tudo (culto → escala → pessoas, culto → repertório),
// usando os relacionamentos das chaves estrangeiras (o "embed" do PostgREST).
// A RLS já filtra no banco: rascunho só aparece para o líder de louvor, e
// quem não é do ministério não recebe nada. A tela só desenha o que chegou.
import { h, icone, comCarregando } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { nomeCurto } from '../sessao.js';
import { hojeEmBrasilia, somarDias, rotuloDoDia, partesDaData, formatarHorario } from '../util/datas.js';
import { cabecalhoApp, barraAbas, iniciais } from './moldura.js';
import { guardarEscala, escalaGuardada, eErroDeRede } from '../offline.js';

const SEMANAS_A_MOSTRAR = 6;
const SEMANAS_PARA_GERAR = 8;

const CONSULTA = `
    id, nome, data, horario, estado,
    escala (
        id, estado,
        escala_item ( id, pessoa_id, instrumento_exibido, pessoa:pessoa_id ( nome, apelido ) ),
        escala_grupo ( grupo:grupo_id ( nome ) )
    ),
    repertorio_item ( id, posicao, tom, musica:musica_id ( titulo, artista, link ) )
`;

export function telaEscala(conta) {
    const lista = h('div', { class: 'lista-cultos', 'aria-busy': 'true' }, esqueleto());
    const destaque = h('div', { class: 'destaque-area' });
    const faixaOffline = h('div', { class: 'faixa-offline-area', role: 'status' });
    const titulo = h('h1', { tabindex: -1, class: 'titulo-tela' }, `Oi, ${nomeCurto(conta.pessoa, 'tudo bem')}!`);

    const tela = h('div', { class: 'tela tela-app' },
        cabecalhoApp(conta),
        h('main', { id: 'conteudo', class: 'app-conteudo' },
            titulo,
            h('p', { class: 'subtitulo-tela' }, 'Aqui estão os próximos cultos do Louvor.'),
            faixaOffline,
            destaque,
            h('h2', { class: 'titulo-secao' }, 'Próximos cultos'),
            lista,
        ),
        barraAbas(conta, '#/escala'),
    );

    carregar();
    return tela;

    async function carregar() {
        lista.setAttribute('aria-busy', 'true');
        const hoje = hojeEmBrasilia();
        const { data: cultos, error } = await supabase
            .from('culto')
            .select(CONSULTA)
            .eq('tem_louvor', true)
            .gte('data', hoje)
            .lte('data', somarDias(hoje, SEMANAS_A_MOSTRAR * 7))
            .order('data')
            .order('horario')
            .order('posicao', { referencedTable: 'repertorio_item' })
            .retry(navigator.onLine); // ver o comentário em sessao.js

        lista.removeAttribute('aria-busy');
        if (error) {
            console.error(error);
            const copia = eErroDeRede(error) ? escalaGuardada(conta.id) : null;
            if (copia) {
                desenhar(copia.cultos.filter((culto) => culto.data >= hoje), copia.salvaEm);
                return;
            }
            faixaOffline.replaceChildren();
            lista.replaceChildren(estadoVazio('Não deu para carregar a escala.', 'Confira sua internet e tente de novo.',
                botaoAcao('Tentar de novo', carregar)));
            return;
        }
        guardarEscala(conta.id, cultos);
        desenhar(cultos);
    }

    // offlineDesde: quando veio da cópia local, a data dessa cópia
    function desenhar(cultos, offlineDesde) {
        faixaOffline.replaceChildren(...(offlineDesde ? [faixaSemConexao(offlineDesde, carregar)] : []));
        const meuId = conta.pessoa?.id;
        destaque.replaceChildren(...cartaoDestaque(cultos, meuId));

        if (cultos.length === 0) {
            const acao = conta.e_administrador && !offlineDesde && botaoAcao(`Gerar ${SEMANAS_PARA_GERAR} semanas de cultos`, gerarCultos);
            lista.replaceChildren(estadoVazio('Nenhum culto no calendário ainda.',
                conta.e_administrador
                    ? 'Os cultos fixos (domingo e terça) são gerados a partir dos tipos de culto cadastrados.'
                    : 'Assim que a liderança montar o calendário, ele aparece aqui.',
                acao));
            return;
        }
        lista.replaceChildren(...cultos.map((culto, i) => cartaoCulto(culto, meuId, i)));
    }

    async function gerarCultos() {
        const ate = somarDias(hojeEmBrasilia(), SEMANAS_PARA_GERAR * 7);
        const { error } = await supabase.rpc('gerar_cultos', { p_ate: ate });
        if (error) {
            console.error(error);
            alertaInline(lista, 'Não deu para gerar os cultos. Só administrador e líder de louvor podem fazer isso.');
            return;
        }
        await carregar();
    }
}

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

// A escala que vale para a tela: publicada (todos) ou rascunho (só o líder vê)
function escalaDo(culto) {
    return culto.escala?.[0] ?? null;
}

function cartaoDestaque(cultos, meuId) {
    if (!meuId) return [];
    for (const culto of cultos) {
        const escala = escalaDo(culto);
        if (culto.estado !== 'ativo' || escala?.estado !== 'publicada') continue;
        const eu = escala.escala_item.find((item) => item.pessoa_id === meuId);
        if (!eu) continue;
        return [h('a', { class: 'destaque', href: `#culto-${culto.id}` },
            h('span', { class: 'destaque-rotulo' }, icone('estrela'), 'Sua próxima escala'),
            h('strong', { class: 'destaque-quando' }, `${rotuloDoDia(culto.data)} · ${formatarHorario(culto.horario)}`),
            h('span', { class: 'destaque-culto' }, culto.nome),
            eu.instrumento_exibido.length > 0 &&
                h('span', { class: 'destaque-instrumento' }, eu.instrumento_exibido.join(' · ')),
        )];
    }
    return [];
}

function cartaoCulto(culto, meuId, indice) {
    const escala = escalaDo(culto);
    const cancelado = culto.estado === 'cancelado';
    const datas = partesDaData(culto.data);
    const estouNela = escala?.escala_item.some((item) => item.pessoa_id === meuId);

    let selo = null;
    if (cancelado) selo = h('span', { class: 'selo selo-cancelado' }, 'Cancelado');
    else if (escala?.estado === 'rascunho') selo = h('span', { class: 'selo selo-rascunho' }, icone('olho'), 'Rascunho · só você vê');
    else if (estouNela) selo = h('span', { class: 'selo selo-voce' }, 'Você toca');

    return h('article', {
        class: `cartao-culto${cancelado ? ' cancelado' : ''}${estouNela && !cancelado ? ' comigo' : ''}`,
        id: `culto-${culto.id}`,
        style: { '--i': Math.min(indice, 8) },
        'aria-labelledby': `titulo-${culto.id}`,
    },
        h('div', { class: 'cartao-topo' },
            h('div', { class: 'cartao-data', 'aria-hidden': 'true' },
                h('span', { class: 'cartao-data-semana' }, datas.semana),
                h('span', { class: 'cartao-data-dia' }, datas.dia),
                h('span', { class: 'cartao-data-mes' }, datas.mes),
            ),
            h('div', { class: 'cartao-titulos' },
                h('h3', { id: `titulo-${culto.id}` }, culto.nome),
                h('p', { class: 'cartao-quando' },
                    icone('relogio', 'icone icone-p'),
                    `${rotuloDoDia(culto.data)}, ${formatarHorario(culto.horario)}`),
                selo,
            ),
        ),
        !cancelado && corpoDaEscala(escala, meuId),
        !cancelado && blocoRepertorio(culto.repertorio_item),
    );
}

function corpoDaEscala(escala, meuId) {
    if (!escala || escala.escala_item.length === 0) {
        return h('p', { class: 'cartao-vazio' }, 'Escala ainda não publicada.');
    }
    const grupos = escala.escala_grupo.map((g) => g.grupo?.nome).filter(Boolean).sort();
    const pessoas = [...escala.escala_item].sort((a, b) =>
        nomeCurto(a.pessoa).localeCompare(nomeCurto(b.pessoa), 'pt-BR'));

    return h('div', { class: 'cartao-escala' },
        grupos.length > 0 && h('p', { class: 'cartao-grupos' }, grupos.length > 1 ? 'Grupos ' : 'Grupo ', grupos.join(' + ')),
        h('ul', { class: 'lista-pessoas' },
            pessoas.map((item) => h('li', { class: item.pessoa_id === meuId ? 'sou-eu' : null },
                h('span', { class: 'pessoa-avatar', 'aria-hidden': 'true' }, iniciais(item.pessoa)),
                h('span', { class: 'pessoa-nome' },
                    nomeCurto(item.pessoa, 'Pessoa'),
                    item.pessoa_id === meuId && h('span', { class: 'sr-only' }, ' (você)')),
                h('span', { class: 'pessoa-instrumento' }, item.instrumento_exibido.join(' · ') || '—'),
            )),
        ),
    );
}

function blocoRepertorio(itens) {
    if (!itens || itens.length === 0) return null;
    return h('details', { class: 'repertorio' },
        h('summary', null,
            icone('musica', 'icone icone-p'),
            `Repertório · ${itens.length} ${itens.length === 1 ? 'música' : 'músicas'}`),
        h('ol', { class: 'lista-musicas' },
            itens.map((item) => h('li', null,
                h('span', { class: 'musica-titulo' }, item.musica.titulo),
                item.musica.artista && h('span', { class: 'musica-artista' }, item.musica.artista),
                item.tom && h('span', { class: 'musica-tom', title: 'Tom' }, item.tom),
                linkSeguro(item.musica.link),
            )),
        ),
    );
}

// O banco já só aceita http(s) (check na tabela musica), mas conferir de novo
// aqui custa uma linha e impede um "javascript:" se a regra um dia mudar.
function linkSeguro(link) {
    if (!link || !/^https?:\/\//i.test(link)) return null;
    return h('a', { class: 'musica-link', href: link, target: '_blank', rel: 'noopener noreferrer', 'aria-label': 'Ouvir (abre em outra aba)' },
        icone('externo', 'icone icone-p'));
}

function faixaSemConexao(salvaEm, tentarDeNovo) {
    const quando = new Intl.DateTimeFormat('pt-BR', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
    }).format(new Date(salvaEm));
    const botao = h('button', { type: 'button', class: 'faixa-offline-botao' }, 'Atualizar');
    botao.addEventListener('click', () => comCarregando(botao, tentarDeNovo));
    return h('div', { class: 'faixa-offline' },
        h('span', { class: 'faixa-offline-ponto', 'aria-hidden': 'true' }),
        h('span', null, h('strong', null, 'Sem conexão. '), `Mostrando a escala de ${quando}.`),
        botao,
    );
}

function estadoVazio(titulo, texto, acao) {
    return h('div', { class: 'estado-vazio' },
        h('div', { class: 'estado-vazio-icone', 'aria-hidden': 'true' }, icone('musica')),
        h('p', { class: 'estado-vazio-titulo' }, titulo),
        h('p', { class: 'estado-vazio-texto' }, texto),
        acao,
    );
}

function botaoAcao(texto, acao) {
    const botao = h('button', { type: 'button', class: 'botao-principal' }, texto);
    botao.addEventListener('click', () => comCarregando(botao, acao));
    return botao;
}

function alertaInline(onde, texto) {
    onde.querySelector('.aviso-form')?.remove();
    onde.append(h('p', { class: 'aviso-form', role: 'alert', 'data-tipo': 'erro' }, texto));
}

// Cartões "fantasma" enquanto carrega: a tela não pula quando os dados chegam
function esqueleto() {
    return [0, 1, 2].map(() => h('div', { class: 'cartao-culto esqueleto', 'aria-hidden': 'true' },
        h('div', { class: 'cartao-topo' },
            h('div', { class: 'cartao-data' }),
            h('div', { class: 'cartao-titulos' }, h('span', { class: 'linha l1' }), h('span', { class: 'linha l2' })),
        ),
        h('span', { class: 'linha l3' }),
    ));
}
