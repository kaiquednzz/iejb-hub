// Contar pelas notas (redesign v2, fase 3). Em vez de somar de cabeça e
// digitar "1.370,00", a tesouraria toca na figura de cada cédula ou moeda
// quantas vezes tiver: a pilha cresce e o total soma sozinho. É opcional:
// o campo de valor continua aceitando digitar. Nada é salvo aqui; o total
// só preenche o campo do formulário (que é o que vai para o banco).
import { h, icone } from '../../util/dom.js';
import { abrirFolha, anunciar } from '../../util/folha.js';

// Cores aproximadas das cédulas do Real (2ª família), para reconhecer de
// relance, escurecidas para o texto branco ter contraste AA (>= 4,5:1).
// O valor escrito é o que vale.
const NOTAS = [
    { c: 20000, rotulo: '200', cor: '#7A5C3E' },
    { c: 10000, rotulo: '100', cor: '#2F6A9E' },
    { c: 5000, rotulo: '50', cor: '#A3561A' },
    { c: 2000, rotulo: '20', cor: '#8C6400' },
    { c: 1000, rotulo: '10', cor: '#A8352D' },
    { c: 500, rotulo: '5', cor: '#6B4A8E' },
    { c: 200, rotulo: '2', cor: '#3D6874' },
];
const MOEDAS = [
    { c: 100, rotulo: '1' },
    { c: 50, rotulo: '0,50' },
    { c: 25, rotulo: '0,25' },
    { c: 10, rotulo: '0,10' },
    { c: 5, rotulo: '0,05' },
];

const reais = (c) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c / 100);

export function abrirCedulas(titulo, aoUsar) {
    const qtd = new Map();
    const total = h('p', { class: 'cedulas-total', 'aria-live': 'polite' }, reais(0));
    const usar = h('button', { type: 'button', class: 'botao-principal botao-largo', disabled: true }, 'Usar este valor');
    const zerar = h('button', { type: 'button', class: 'botao-texto' }, 'Zerar');

    const atualizar = () => {
        const soma = [...qtd].reduce((s, [c, n]) => s + c * n, 0);
        total.textContent = reais(soma);
        total.classList.remove('pulou');
        void total.offsetWidth; // reinicia a animação do número
        total.classList.add('pulou');
        usar.disabled = soma === 0;
        usar.textContent = soma ? `Usar ${reais(soma)}` : 'Usar este valor';
        return soma;
    };

    const peca = (item, tipo) => {
        const n = h('span', { class: 'cedula-n', 'aria-hidden': 'true' });
        const menos = h('button', { type: 'button', class: 'cedula-menos', 'aria-label': `Tirar uma de R$ ${item.rotulo}`, hidden: true }, '−');
        const botao = h('button', { type: 'button', class: `cedula cedula-${tipo}`, style: item.cor ? { '--cor': item.cor } : null, 'aria-label': `Mais uma de R$ ${item.rotulo}` },
            h('span', { class: 'cedula-rs' }, 'R$'), h('span', { class: 'cedula-valor' }, item.rotulo), n);
        const mudar = (passo) => {
            const novo = Math.max(0, (qtd.get(item.c) ?? 0) + passo);
            qtd.set(item.c, novo);
            n.textContent = novo ? `×${novo}` : '';
            botao.dataset.pilha = String(Math.min(novo, 3));
            menos.hidden = novo === 0;
            botao.classList.remove('tocou');
            void botao.offsetWidth;
            if (passo > 0) botao.classList.add('tocou');
            atualizar();
            anunciar(`${novo} de R$ ${item.rotulo}`);
        };
        botao.addEventListener('click', () => mudar(1));
        menos.addEventListener('click', () => mudar(-1));
        return h('li', { class: 'cedula-lugar' }, botao, menos);
    };

    zerar.addEventListener('click', () => {
        qtd.clear();
        folha.elemento.querySelectorAll('.cedula-n').forEach((x) => { x.textContent = ''; });
        folha.elemento.querySelectorAll('.cedula').forEach((x) => { x.dataset.pilha = '0'; });
        folha.elemento.querySelectorAll('.cedula-menos').forEach((x) => { x.hidden = true; });
        atualizar();
    });
    usar.addEventListener('click', () => {
        const soma = atualizar();
        aoUsar(soma);
        folha.fechar();
    });

    const folha = abrirFolha({
        titulo,
        conteudo: h('div', { class: 'cedulas' },
            h('p', { class: 'folha-texto folha-texto-pequeno' }, 'Toque em cada nota ou moeda quantas vezes tiver.'),
            h('div', { class: 'cedulas-topo' }, total, zerar),
            h('h3', { class: 'cedulas-grupo' }, 'Notas'),
            h('ul', { class: 'cedulas-notas' }, NOTAS.map((x) => peca(x, 'nota'))),
            h('h3', { class: 'cedulas-grupo' }, 'Moedas'),
            h('ul', { class: 'cedulas-moedas' }, MOEDAS.map((x) => peca(x, 'moeda'))),
            usar),
    });
}

// Botão "Contar pelas notas" ligado a um campo de valor (campoValor)
export function botaoCedulas(campo, titulo) {
    const b = h('button', { type: 'button', class: 'botao-cedulas' }, icone('moeda', 'icone icone-p'), 'Contar pelas notas');
    b.addEventListener('click', () => abrirCedulas(titulo, (centavos) => {
        campo.entrada.value = (centavos / 100).toFixed(2).replace('.', ',');
        campo.entrada.dispatchEvent(new Event('input', { bubbles: true }));
    }));
    return b;
}
