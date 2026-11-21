// Ministérios (redesign v2): a "porta" de cada ministério e das áreas da
// igreja. Cada ministério tem uma capa própria (o Louvor é o primeiro); os
// que vêm aí aparecem menores. As áreas de administração seguem as mesmas
// regras de quem vê o quê de antes (sessao.js), e o banco continua conferindo.
import { h, icone } from '../util/dom.js';
import { cabecalhoApp, contadorDePedidos } from './moldura.js';
import { linhaLista } from './voce.js';
import { veFinanceiro, cuidaDosEventos, eLiderDeLouvor } from '../sessao.js';

const EM_BREVE = [
    { nome: 'Kids', texto: 'Turmas e escalas', icone: 'crianca' },
    { nome: 'Pregações', texto: 'Mensagens e acervo', icone: 'livro' },
];

export function telaMinisterios(conta) {
    const areas = [
        conta.e_administrador && { href: '#/pessoas', nome: 'Pessoas', texto: 'Acessos e cadastro', nomeIcone: 'chave', id: 'pessoas' },
        cuidaDosEventos(conta) && { href: '#/eventos', nome: 'Eventos do site', texto: 'Agenda de iejb.com.br', nomeIcone: 'megafone' },
        veFinanceiro(conta) && { href: '#/financeiro', nome: 'Financeiro', texto: 'Caixa da igreja', nomeIcone: 'moeda' },
    ].filter(Boolean);
    const linhas = areas.map((a, i) => {
        const li = linhaLista(a);
        li.style.setProperty('--i', i + 2);
        if (a.id === 'pessoas') contadorDePedidos(li.querySelector('.item-nome'), 'item-contador');
        return li;
    });

    return h('div', { class: 'tela tela-app tela-ministerios' },
        cabecalhoApp(conta),
        h('main', { id: 'conteudo', class: 'app-conteudo' },
            h('h1', { tabindex: -1, class: 'titulo-tela' }, 'Ministérios'),
            h('h2', { class: 'rotulo-secao' }, 'Ministérios'),
            // Capa do Louvor: a casa inteira é o link
            h('a', { class: 'capa-ministerio capa-louvor', href: '#/escala' },
                h('span', { class: 'capa-marca', 'aria-hidden': 'true' }, icone('musica')),
                h('span', { class: 'capa-sobre' }, 'Ministério de'),
                h('span', { class: 'capa-nome' }, 'Louvor'),
                h('span', { class: 'capa-texto' }, eLiderDeLouvor(conta) ? 'Escala, montar, repertórios e equipe' : 'Escala, repertórios e equipe'),
                h('span', { class: 'capa-acao' }, 'Entrar', icone('seta', 'icone icone-p'))),
            h('ul', { class: 'capas-em-breve', 'aria-label': 'Em breve' }, EM_BREVE.map((m) => h('li', { class: 'capa-em-breve' },
                icone(m.icone),
                h('span', { class: 'capa-em-breve-nome' }, m.nome),
                h('span', { class: 'capa-em-breve-texto' }, 'Em breve')))),
            linhas.length ? h('h2', { class: 'rotulo-secao' }, 'Administração') : null,
            linhas.length ? h('ul', { class: 'grupo-lista' }, linhas) : null,
        ),
    );
}
