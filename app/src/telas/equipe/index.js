// Tela "Equipe": pedidos de acesso, pessoas e grupos do Louvor.
//
// Todo integrante entra aqui (para ver quem é quem e o contato de todos, Q22).
// Os botões de mexer aparecem conforme o papel, mas quem garante a regra é o
// banco: se alguém forçar um botão escondido, o RLS recusa.
import { h } from '../../util/dom.js';
import { cabecalhoApp, barraAbas } from '../moldura.js';
import { carregarEquipe } from './dados.js';
import { secaoPedidos } from './pedidos.js';
import { secaoPessoas } from './pessoas.js';
import { secaoGrupos } from './grupos.js';
import { mensagemDoBanco } from '../../util/erros.js';
import { vazio } from './pecas.js';

// A mesma tela serve dois lugares:
//   - Louvor > Equipe: pessoas e grupos do Louvor;
//   - Pessoas (só admin, D63): pedidos de acesso e o cadastro de todo mundo,
//     direto do Início, sem precisar entrar no Louvor.
export function telaEquipe(conta, { area = 'louvor' } = {}) {
    const ePessoas = area === 'pessoas';
    const LEMBRAR = ePessoas ? 'iejb-hub-pessoas-aba' : 'iejb-hub-equipe-aba';
    const lugar = h('div', { class: 'equipe-area', 'aria-busy': 'true' }, esqueleto());
    const abas = h('div', { class: 'segmentos', role: 'tablist', 'aria-label': 'Partes da equipe' });
    let dados = null;
    let atual = sessionStorage.getItem(LEMBRAR);

    const tela = h('div', { class: 'tela tela-app' },
        cabecalhoApp(conta, { modulo: ePessoas ? 'Pessoas' : 'Louvor' }),
        h('main', { id: 'conteudo', class: 'app-conteudo' },
            h('h1', { tabindex: -1, class: 'titulo-tela' }, ePessoas ? 'Pessoas' : 'Equipe'),
            abas,
            lugar,
        ),
        !ePessoas && barraAbas(conta, '#/equipe'),
    );

    const ctx = { conta, recarregar: carregar, dados: () => dados };
    carregar();
    return tela;

    async function carregar() {
        const resultado = await carregarEquipe(conta);
        lugar.removeAttribute('aria-busy');
        if (resultado.erro) {
            console.error(resultado.erro);
            const botao = h('button', { type: 'button', class: 'botao-principal' }, 'Tentar de novo');
            botao.addEventListener('click', () => { lugar.setAttribute('aria-busy', 'true'); lugar.replaceChildren(esqueleto()); carregar(); });
            lugar.replaceChildren(vazio('Não deu para carregar a equipe.', mensagemDoBanco(resultado.erro), botao));
            return;
        }
        dados = resultado.dados;
        desenharAbas();
        desenharSecao();
    }

    function secoesVisiveis() {
        const pendentes = dados.pedidos.filter((p) => p.estado === 'pendente').length;
        return ePessoas
            ? [{ id: 'pedidos', nome: 'Pedidos', contador: pendentes }, { id: 'pessoas', nome: 'Cadastro' }]
            : [{ id: 'pessoas', nome: 'Pessoas' }, { id: 'grupos', nome: 'Grupos' }];
    }

    function desenharAbas() {
        const secoes = secoesVisiveis();
        if (!secoes.some((s) => s.id === atual)) {
            // Primeira visita: admin com pedido esperando cai direto em Pedidos
            atual = secoes.find((s) => s.contador)?.id ?? 'pessoas';
        }
        abas.style.setProperty('--n', secoes.length);
        abas.style.setProperty('--ativo', secoes.findIndex((s) => s.id === atual));
        abas.replaceChildren(...secoes.map((s, i) => {
            const botao = h('button', {
                type: 'button', role: 'tab', id: `aba-${s.id}`,
                'aria-selected': String(s.id === atual), 'aria-controls': 'painel-equipe',
                tabindex: s.id === atual ? 0 : -1,
            }, s.nome, s.contador > 0 && h('span', { class: 'segmento-contador' }, String(s.contador)));
            botao.addEventListener('click', () => trocar(s.id));
            // Setas do teclado andam entre as abas (padrão de tablist)
            botao.addEventListener('keydown', (evento) => {
                const passo = { ArrowRight: 1, ArrowLeft: -1 }[evento.key];
                if (!passo) return;
                const proxima = secoes[(i + passo + secoes.length) % secoes.length];
                trocar(proxima.id);
                abas.querySelector(`#aba-${proxima.id}`).focus();
            });
            return botao;
        }));
    }

    function trocar(id) {
        if (id === atual) return;
        atual = id;
        sessionStorage.setItem(LEMBRAR, id);
        desenharAbas();
        desenharSecao();
    }

    function desenharSecao() {
        const montar = { pedidos: secaoPedidos, pessoas: secaoPessoas, grupos: secaoGrupos }[atual];
        const painel = h('div', {
            class: 'painel-equipe', id: 'painel-equipe', role: 'tabpanel', 'aria-labelledby': `aba-${atual}`,
        }, montar(dados, ctx));
        lugar.replaceChildren(painel);
    }
}

function esqueleto() {
    return h('div', { class: 'lista-linhas esqueleto-lista', 'aria-hidden': 'true' },
        [0, 1, 2, 3].map(() => h('div', { class: 'linha-caixa esqueleto' },
            h('span', { class: 'pessoa-avatar' }), h('span', { class: 'linha l1' }))));
}
