// Você (redesign, etapa 2): a conta da pessoa. Não traz função nova: junta
// o que antes ficava espalhado entre o cabeçalho (Sair, selo "Admin"), a
// barra lateral e o rodapé do Início. As "suas áreas" seguem exatamente as
// mesmas regras de quem vê o quê (sessao.js); o banco continua conferindo.
import { h, icone } from '../util/dom.js';
import { cabecalhoApp, avatar, papelPrincipal, sair } from './moldura.js';

// Linha de lista: ícone, nome, texto de apoio e seta. Toda a linha é o link.
export function linhaLista({ href, nome, texto, nomeIcone }) {
    return h('li', null, h('a', { class: 'item-lista', href },
        nomeIcone && h('span', { class: 'item-icone', 'aria-hidden': 'true' }, icone(nomeIcone)),
        h('span', { class: 'item-textos' },
            h('span', { class: 'item-nome' }, nome),
            texto && h('span', { class: 'item-apoio' }, texto)),
        icone('seta', 'icone icone-p item-seta')));
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
            h('section', { class: 'voce-perfil', 'aria-label': 'Seu perfil' },
                avatar(pessoa, 'pessoa-avatar voce-avatar'),
                h('div', null,
                    h('p', { class: 'voce-nome' }, nome),
                    h('p', { class: 'voce-papel' }, papelPrincipal(conta)),
                    conta.login && h('p', { class: 'voce-login' }, conta.login))),
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
