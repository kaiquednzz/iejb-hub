// Prestação de contas do mês em PDF (redesign v2, fase 3). Um relatório
// diagramado (capa, resultado, de onde veio, para onde foi, saldo das contas)
// para levar ao pastor ou à assembleia. Usa os mesmos números do Resumo
// (resumo.js) e sai pela impressão do sistema: no iPhone, "Imprimir" →
// compartilhar → Salvar em Arquivos vira PDF; no computador, "Salvar como PDF".
import { h, icone } from '../../util/dom.js';
import { reais, MESES } from './util.js';

const nomeMes = (iso) => {
    const m = MESES[Number(iso.slice(5, 7)) - 1];
    return `${m.charAt(0).toUpperCase()}${m.slice(1)} de ${iso.slice(0, 4)}`;
};

export function botaoRelatorio(r, dados) {
    const b = h('button', { type: 'button', class: 'botao-secundario botao-largo fin-relatorio-botao' },
        icone('baixar'), 'Prestação de contas (PDF)');
    b.addEventListener('click', () => imprimir(r, dados));
    return b;
}

function tabela(titulo, cats, total) {
    if (!cats.length) return null;
    return h('section', { class: 'rel-bloco' },
        h('h2', null, titulo),
        h('table', null,
            h('tbody', null, cats.filter((c) => c.total > 0).map((c) => h('tr', null,
                h('td', null, c.nome),
                h('td', { class: 'rel-pct' }, total ? `${Math.round((c.total / total) * 100)}%` : ''),
                h('td', { class: 'rel-valor' }, reais(c.total))))),
            h('tfoot', null, h('tr', null, h('td', null, 'Total'), h('td'), h('td', { class: 'rel-valor' }, reais(total))))));
}

function imprimir(r, dados) {
    const { entradas, saidas } = r.atual;
    const resultado = entradas - saidas;
    const emitido = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date());
    const contas = dados.resumo.contas ?? [];
    const doc = h('article', { class: 'impressao', 'aria-hidden': 'true' },
        h('header', { class: 'rel-capa' },
            h('p', { class: 'rel-igreja' }, 'IEJB · Igreja Evangélica do Jardim Brasil'),
            h('h1', null, 'Prestação de contas'),
            h('p', { class: 'rel-mes' }, nomeMes(r.mes), r.emAndamento ? ' (parcial, mês em andamento)' : '')),
        h('section', { class: 'rel-resultado' },
            h('div', null, h('span', null, 'Entradas'), h('strong', null, reais(entradas))),
            h('div', null, h('span', null, 'Saídas'), h('strong', null, reais(saidas))),
            h('div', { class: resultado >= 0 ? 'rel-positivo' : 'rel-negativo' },
                h('span', null, resultado >= 0 ? 'Sobrou' : 'Faltou'), h('strong', null, reais(Math.abs(resultado))))),
        tabela('I. De onde veio', r.entradas, entradas),
        tabela('II. Para onde foi', r.saidas, saidas),
        contas.length ? h('section', { class: 'rel-bloco' },
            h('h2', null, 'III. Saldo das contas hoje'),
            h('table', null,
                h('tbody', null, contas.map((c) => h('tr', null, h('td', null, c.nome), h('td'), h('td', { class: 'rel-valor' }, reais(c.saldo))))),
                h('tfoot', null, h('tr', null, h('td', null, 'Total'), h('td'), h('td', { class: 'rel-valor' }, reais(r.saldo)))))) : null,
        h('footer', { class: 'rel-rodape' },
            h('p', null, `Emitido em ${emitido}, pelo IEJB Hub.`),
            h('p', null, 'Valores lançados e conferidos pela tesouraria. Transferências entre contas e lançamentos cancelados não entram.'),
            h('div', { class: 'rel-assinaturas' },
                h('span', null, 'Tesouraria'), h('span', null, 'Pastor'))));

    document.querySelectorAll('.impressao').forEach((x) => x.remove()); // sobra de uma impressão anterior
    document.body.append(doc);
    document.documentElement.classList.add('imprimindo');
    const limpar = () => {
        doc.remove();
        document.documentElement.classList.remove('imprimindo');
        window.removeEventListener('afterprint', limpar);
    };
    window.addEventListener('afterprint', limpar);
    // Dá um quadro para o navegador aplicar o estilo de impressão. Na tela o
    // relatório é invisível (display: none), então se o afterprint não vier
    // (alguns celulares), ele só fica escondido até a próxima impressão.
    requestAnimationFrame(() => window.print());
}
