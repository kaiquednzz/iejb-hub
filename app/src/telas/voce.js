// Você (redesign, etapa 2): a conta da pessoa. Não traz função nova: junta
// o que antes ficava espalhado entre o cabeçalho (Sair, selo "Admin"), a
// barra lateral e o rodapé do Início. As "suas áreas" seguem exatamente as
// mesmas regras de quem vê o quê (sessao.js); o banco continua conferindo.
import { h, icone } from '../util/dom.js';
import { cabecalhoApp, avatar, papelPrincipal, sair } from './moldura.js';
import { textoAniversario, folhaAniversario } from './aniversarios.js';
import { abrirTour } from './tour.js';
import { nomeDoTitulo } from '../util/titulos.js';
import { definirPreferenciaTema, preferenciaTema } from '../util/tema.js';
import { interruptor } from './equipe/pecas.js';
import { enfeitesLigados, ligarEnfeites } from '../util/epocas.js';

// Linha de lista: ícone, nome, texto de apoio e seta. Toda a linha é o link.
export function linhaLista({ href, nome, texto, nomeIcone }) {
    return h('li', null, h('a', { class: 'item-lista', href },
        nomeIcone && h('span', { class: 'item-icone', 'aria-hidden': 'true' }, icone(nomeIcone)),
        h('span', { class: 'item-textos' },
            h('span', { class: 'item-nome' }, nome),
            texto && h('span', { class: 'item-apoio' }, texto)),
        icone('seta', 'icone icone-p item-seta')));
}

// Linha que abre algo na própria tela (folha, tour), em vez de navegar
function linhaBotao({ nome, texto, nomeIcone, aoTocar }) {
    const b = h('button', { type: 'button', class: 'item-lista' },
        nomeIcone && h('span', { class: 'item-icone', 'aria-hidden': 'true' }, icone(nomeIcone)),
        h('span', { class: 'item-textos' },
            h('span', { class: 'item-nome' }, nome),
            texto != null && h('span', { class: 'item-apoio' }, texto)),
        icone('seta', 'icone icone-p item-seta'));
    b.addEventListener('click', () => aoTocar(b));
    return h('li', null, b);
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function secaoAparencia() {
    const opcoes = [
        ['sistema', 'Seguir sistema'],
        ['claro', 'Claro'],
        ['escuro', 'Escuro'],
    ];
    const atual = preferenciaTema();
    const descricao = h('p', { class: 'aparencia-descricao', 'aria-live': 'polite' },
        atual === 'sistema' ? 'Acompanhando a aparência do aparelho.' : `Tema ${atual} ativado.`);
    const botoes = opcoes.map(([modo, nome]) => {
        const botao = h('button', {
            type: 'button', class: 'aparencia-opcao', 'aria-pressed': String(atual === modo),
        }, nome);
        botao.addEventListener('click', () => {
            definirPreferenciaTema(modo);
            botoes.forEach(([opcao], i) => {
                const escolhido = opcao === modo;
                const el = grupo.querySelectorAll('button')[i];
                el.setAttribute('aria-pressed', String(escolhido));
            });
            descricao.textContent = modo === 'sistema'
                ? 'Acompanhando a aparência do aparelho.' : `Tema ${modo} ativado.`;
        });
        return [modo, nome, botao];
    });
    const grupo = h('div', { class: 'aparencia-opcoes', role: 'group', 'aria-label': 'Escolha a aparência' },
        ...botoes.map(([, , botao]) => botao));
    return h('section', { class: 'secao-aparencia', 'aria-labelledby': 'titulo-aparencia' },
        h('h2', { id: 'titulo-aparencia', class: 'rotulo-secao' }, 'Aparência'),
        h('div', { class: 'grupo-lista aparencia-cartao' },
            h('div', { class: 'aparencia-controles' }, grupo, descricao)),
        // Datas especiais (D79): Natal, Páscoa, Pentecostes... no Início
        h('div', { class: 'grupo-lista aparencia-cartao aparencia-enfeites' },
            interruptor({ rotulo: 'Enfeites das datas especiais', descricao: 'Natal, Páscoa, Pentecostes e outras, no Início',
                ligado: enfeitesLigados(), aoMudar: (v) => { ligarEnfeites(v); return true; } })));
}

// Carteirinha digital (redesign v2, fase 3): o cartão da pessoa no Hub, com
// foto, nome, papel e ministério. O reflexo é uma faixa de luz lisa (sem
// degradê) que anda quando a pessoa arrasta o dedo sobre o cartão ou, se
// ela permitir, quando inclina o celular.
function carteirinha(conta, pessoa, nome) {
    // Onde serve (D71): "Louvor · Kids"; quem lidera aparece primeiro
    const vinculos = (pessoa.membro_ministerio ?? []).filter((m) => m.ativo)
        .sort((a, b) => b.e_lider - a.e_lider)
        .map((m) => `${m.ministerio?.nome ?? 'Louvor'}${m.e_lider ? ' (líder)' : ''}`);
    const ministerios = vinculos.length ? vinculos.join(' · ') : null;
    const desde = conta.criado_em ? `${MESES[Number(conta.criado_em.slice(5, 7)) - 1]} de ${conta.criado_em.slice(0, 4)}` : null;
    const cartao = h('section', { class: 'carteirinha', 'aria-label': `Carteirinha de ${nome}` },
        h('div', { class: 'carteirinha-topo' },
            h('img', { src: '/simbolo-fogo-iejb.png', alt: '', width: 15, height: 30 }),
            h('span', null, `IEJB · ${nomeDoTitulo(pessoa.titulo)}`)),
        h('div', { class: 'carteirinha-meio' },
            avatar(pessoa, 'pessoa-avatar carteirinha-foto'),
            h('div', null,
                h('p', { class: 'carteirinha-nome' }, nome),
                h('p', { class: 'carteirinha-papel' }, papelPrincipal(conta)),
                ministerios && h('p', { class: 'carteirinha-ministerio' }, ministerios))),
        desde && h('p', { class: 'carteirinha-desde' }, `No IEJB Hub desde ${desde}`),
        h('span', { class: 'carteirinha-brilho', 'aria-hidden': 'true' }));

    const mover = (px, py) => {
        cartao.style.setProperty('--brilho', `${(px * 160 - 40).toFixed(1)}%`);
        cartao.style.setProperty('--incl-x', `${((py - 0.5) * -8).toFixed(2)}deg`);
        cartao.style.setProperty('--incl-y', `${((px - 0.5) * 10).toFixed(2)}deg`);
    };
    cartao.addEventListener('pointermove', (e) => {
        const r = cartao.getBoundingClientRect();
        mover((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    });
    cartao.addEventListener('pointerleave', () => mover(0.5, 0.5));
    // Inclinar o celular: no iPhone precisa pedir permissão (no primeiro toque)
    let ouvindo = false;
    cartao.addEventListener('click', async () => {
        if (ouvindo || !('DeviceOrientationEvent' in window)) return;
        try {
            if (typeof DeviceOrientationEvent.requestPermission === 'function'
                && await DeviceOrientationEvent.requestPermission() !== 'granted') return;
        } catch { return; }
        ouvindo = true;
        const girar = (e) => {
            if (!cartao.isConnected) return window.removeEventListener('deviceorientation', girar);
            const gx = Math.max(-30, Math.min(30, e.gamma ?? 0));
            const by = Math.max(10, Math.min(70, e.beta ?? 40));
            mover((gx + 30) / 60, (by - 10) / 60);
        };
        window.addEventListener('deviceorientation', girar);
    });
    mover(0.5, 0.5);
    return cartao;
}

export function telaVoce(conta) {
    const pessoa = conta.pessoa ?? { nome: conta.nome_informado };
    const nome = pessoa.apelido || pessoa.nome || conta.nome_informado || 'Você';

    const botaoSair = h('button', { type: 'button', class: 'botao-texto-perigo voce-sair' }, 'Sair da conta');
    botaoSair.addEventListener('click', () => { botaoSair.disabled = true; botaoSair.classList.add('carregando'); sair(); });

    return h('div', { class: 'tela tela-app tela-voce' },
        cabecalhoApp(conta),
        h('main', { id: 'conteudo', class: 'app-conteudo' },
            h('h1', { class: 'sr-only', tabindex: -1 }, 'Você'),
            carteirinha(conta, pessoa, nome),
            conta.login && h('p', { class: 'voce-login' }, `Você entra com ${conta.login}`),
            h('h2', { class: 'rotulo-secao' }, 'Você na igreja'),
            h('ul', { class: 'grupo-lista' },
                conta.pessoa && linhaBotao({ nome: 'Aniversário', texto: textoAniversario(conta.pessoa) ?? 'Adicionar', nomeIcone: 'presente',
                    aoTocar: (b) => folhaAniversario(conta, () => { b.querySelector('.item-apoio').textContent = textoAniversario(conta.pessoa) ?? 'Adicionar'; }) }),
                linhaLista({ href: '#/oracao', nome: 'Pedidos de oração', nomeIcone: 'coracao' }),
                linhaBotao({ nome: 'Como usar o app', nomeIcone: 'info', aoTocar: () => abrirTour(conta) })),
            secaoAparencia(),
            h('h2', { class: 'rotulo-secao' }, 'Sobre o app'),
            h('ul', { class: 'grupo-lista' },
                linhaLista({ href: '#/privacidade', nome: 'Política de privacidade', nomeIcone: 'escudo' }),
                linhaLista({ href: '#/termos', nome: 'Termos de uso', nomeIcone: 'livro' })),
            h('div', { class: 'voce-rodape' },
                botaoSair,
                h('p', { class: 'voce-igreja' }, 'IEJB · Igreja Evangélica do Jardim Brasil')),
        ),
    );
}
