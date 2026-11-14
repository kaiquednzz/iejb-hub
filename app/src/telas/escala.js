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
import { cabecalhoApp, barraAbas, avatar } from './moldura.js';
import { FUNCAO_MESA, separarMesa } from '../util/escala.js';
import { blocoRepertorio } from './repertorio.js';
import { blocoPedido } from './pedido-alteracao.js';
import { estadoDoPush, ativarPush } from '../util/push.js';
import { guardarEscala, escalaGuardada, eErroDeRede } from '../offline.js';

const SEMANAS_A_MOSTRAR = 6;
const SEMANAS_PARA_GERAR = 8;

const CONSULTA = `
    id, nome, rotulo, data, horario, estado,
    escala (
        id, estado,
        escala_item ( id, pessoa_id, instrumento_exibido, pessoa:pessoa_id ( nome, apelido, foto ) ),
        escala_grupo ( grupo:grupo_id ( nome, lider_pessoa_id ) ),
        solicitacao_alteracao ( id, texto, estado, motivo, criado_em, autor_pessoa_id )
    ),
    repertorio_item ( id, posicao, tom, musica:musica_id ( id, titulo, artista, link ) )
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
            cartaoAvisos(),
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
        // Repertório: quem pode monta ali mesmo; ao fechar o editor, recarrega
        const extras = { conta, recarregar: carregar, offline: !!offlineDesde };
        lista.replaceChildren(...cultos.map((culto, i) => cartaoCulto(culto, meuId, i, extras)));
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

function cartaoCulto(culto, meuId, indice, extras) {
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
                h('h3', { id: `titulo-${culto.id}` }, culto.nome,
                    culto.rotulo && h('span', { class: 'rotulo-culto' }, culto.rotulo)),
                h('p', { class: 'cartao-quando' },
                    icone('relogio', 'icone icone-p'),
                    `${rotuloDoDia(culto.data)}, ${formatarHorario(culto.horario)}`),
                selo,
            ),
        ),
        !cancelado && corpoDaEscala(escala, meuId),
        !cancelado && blocoRepertorio(culto, extras.conta, extras.recarregar, extras.offline),
        !cancelado && !extras.offline && blocoPedido(culto, extras.conta, extras.recarregar),
    );
}

function corpoDaEscala(escala, meuId) {
    if (!escala || escala.escala_item.length === 0) {
        return h('p', { class: 'cartao-vazio' }, 'Escala ainda não publicada.');
    }
    const grupos = escala.escala_grupo.map((g) => g.grupo?.nome).filter(Boolean).sort();
    // Quem só está pela mesa de som vai numa linha à parte, como na planilha
    const { tocam, mesa } = separarMesa(escala.escala_item);
    const pessoas = [...tocam].sort((a, b) =>
        nomeCurto(a.pessoa).localeCompare(nomeCurto(b.pessoa), 'pt-BR'));

    return h('div', { class: 'cartao-escala' },
        grupos.length > 0 && h('p', { class: 'cartao-grupos' }, grupos.length > 1 ? 'Grupos ' : 'Grupo ', grupos.join(' + ')),
        h('ul', { class: 'lista-pessoas' },
            pessoas.map((item) => h('li', { class: item.pessoa_id === meuId ? 'sou-eu' : null },
                avatar(item.pessoa),
                h('span', { class: 'pessoa-nome' },
                    nomeCurto(item.pessoa, 'Pessoa'),
                    item.pessoa_id === meuId && h('span', { class: 'sr-only' }, ' (você)')),
                h('span', { class: 'pessoa-instrumento' },
                    item.instrumento_exibido.filter((i) => i !== FUNCAO_MESA).join(' · ') || '—'),
            )),
        ),
        mesa.length > 0 && h('p', { class: 'cartao-mesa' },
            h('span', null, 'Mesa de som'),
            h('strong', null, mesa.map((item) => nomeCurto(item.pessoa, 'Pessoa')).join(', '))),
    );
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

// "Ativar avisos": só aparece enquanto dá para ativar. No iPhone o pedido de
// permissão precisa sair de um toque, por isso é um botão e não automático.
function cartaoAvisos() {
    if (estadoDoPush() !== 'pode-ativar') return null;
    const ativar = h('button', { type: 'button', class: 'botao-principal botao-pequeno' }, 'Ativar');
    const agoraNao = h('button', { type: 'button', class: 'link-discreto' }, 'Agora não');
    const cartao = h('section', { class: 'cartao-avisos', 'aria-label': 'Avisos no celular' },
        h('div', { class: 'cartao-avisos-icone', 'aria-hidden': 'true' }, icone('sino')),
        h('div', { class: 'cartao-avisos-textos' },
            h('strong', null, 'Receba avisos da escala'),
            h('span', null, 'Quando você entrar, sair ou o repertório mudar, o celular avisa.')),
        h('div', { class: 'cartao-avisos-acoes' }, agoraNao, ativar),
    );
    const sumir = () => {
        cartao.classList.add('saindo');
        setTimeout(() => cartao.remove(), 350);
    };
    agoraNao.addEventListener('click', () => { sessionStorage.setItem('iejb-hub-avisos-depois', '1'); sumir(); });
    ativar.addEventListener('click', () => comCarregando(ativar, async () => {
        try {
            const resposta = await ativarPush();
            if (resposta === 'default') return; // fechou a pergunta: o cartão fica
            if (resposta === 'granted') {
                cartao.replaceChildren(h('div', { class: 'cartao-avisos-icone ok', 'aria-hidden': 'true' }, icone('certo')),
                    h('div', { class: 'cartao-avisos-textos', role: 'status' }, h('strong', null, 'Avisos ativados!'),
                        h('span', null, 'Você vai saber das mudanças na hora.')));
                setTimeout(sumir, 2500);
            } else {
                cartao.replaceChildren(h('div', { class: 'cartao-avisos-textos', role: 'status' },
                    h('strong', null, 'Avisos bloqueados'),
                    h('span', null, 'Para ativar depois: Ajustes do celular → Notificações → IEJB Hub.')));
            }
        } catch (erro) {
            console.error(erro);
            cartao.querySelector('.cartao-avisos-textos span').textContent = 'Não deu para ativar agora. Tente de novo.';
        }
    }));
    if (sessionStorage.getItem('iejb-hub-avisos-depois')) return null;
    return cartao;
}
