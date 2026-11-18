// "Vem aí" na Início (D50): os eventos publicados no site, para todo mundo do
// Hub. Mesmo conceito da escala em blocos: fechado mostra só o essencial
// (dia, nome, hora); tocar abre os detalhes. Some sozinho quando o evento
// acaba (mesma regra do site) e, sem evento, a seção nem aparece.
import { h, icone } from '../util/dom.js';
import { abrirFolha } from '../util/folha.js';
import { partesDaData, formatarHorario, rotuloDoDia } from '../util/datas.js';
import { proximosEventos, urlDaImagem, enderecoNoSite } from '../util/eventos.js';

const MAXIMO = 8;
const VISIVEIS = 3; // o resto aparece em "Ver todos", sem sair da tela

export function blocoEventos() {
    const lugar = h('section', { class: 'inicio-eventos', 'aria-labelledby': 'titulo-eventos', hidden: true });
    carregar();
    return lugar;

    async function carregar() {
        let eventos;
        try {
            eventos = (await proximosEventos()).slice(0, MAXIMO);
        } catch (erro) {
            console.error(erro);
            return; // sem rede: a seção só não aparece
        }
        if (!eventos.length) return;
        // Lista vertical (redesign): título inteiro, sem rolagem para o lado
        const itens = eventos.map((e, i) => h('li', { style: { '--i': i }, hidden: i >= VISIVEIS }, linha(e)));
        const cabeca = h('div', { class: 'rotulo-secao-linha' }, h('h2', { id: 'titulo-eventos', class: 'rotulo-secao' }, 'Vem aí'));
        if (eventos.length > VISIVEIS) {
            const lista = h('ul', { class: 'grupo-lista eventos-lista', id: 'lista-eventos' });
            const mais = h('button', { type: 'button', class: 'rotulo-secao-acao', 'aria-expanded': 'false', 'aria-controls': 'lista-eventos' }, `Ver todos (${eventos.length})`);
            mais.addEventListener('click', () => {
                const abrir = mais.getAttribute('aria-expanded') === 'false';
                itens.forEach((li, i) => { if (i >= VISIVEIS) li.hidden = !abrir; });
                mais.setAttribute('aria-expanded', String(abrir));
                mais.textContent = abrir ? 'Ver menos' : `Ver todos (${eventos.length})`;
            });
            cabeca.append(mais);
            lista.append(...itens);
            lugar.replaceChildren(cabeca, lista);
        } else {
            lugar.replaceChildren(cabeca, h('ul', { class: 'grupo-lista eventos-lista' }, itens));
        }
        lugar.hidden = false;
    }
}

// Bloco de data (componente do design system): dia grande, mês pequeno
export function blocoData(dataISO) {
    const p = partesDaData(dataISO);
    return h('span', { class: 'bloco-data', 'aria-hidden': 'true' },
        h('span', { class: 'bloco-data-dia' }, p.dia),
        h('span', { class: 'bloco-data-mes' }, p.mes));
}

function linha(e) {
    const p = partesDaData(e.data);
    const agora = e.situacao === 'agora';
    const b = h('button', { type: 'button', class: `item-lista evento-linha${agora ? ' agora' : ''}` },
        blocoData(e.data),
        h('span', { class: 'item-textos' },
            h('span', { class: 'item-nome' }, e.titulo),
            h('span', { class: 'item-apoio' },
                agora ? h('span', { class: 'evento-agora' }, 'Acontecendo agora') : `${p.semana.charAt(0).toUpperCase()}${p.semana.slice(1)} · ${formatarHorario(e.horario)}`)),
        icone('seta', 'icone icone-p item-seta'),
    );
    b.setAttribute('aria-label', `${e.titulo}, ${agora ? 'acontecendo agora' : `${rotuloDoDia(e.data)}, ${formatarHorario(e.horario)}`}`);
    b.addEventListener('click', () => detalhes(e));
    return b;
}

function detalhes(e) {
    const imagem = urlDaImagem(e.imagem);
    const quando = e.data_fim
        ? `${rotuloDoDia(e.data)} a ${rotuloDoDia(e.data_fim)} · ${formatarHorario(e.horario)}`
        : `${rotuloDoDia(e.data)} · ${formatarHorario(e.horario)}`;
    const onde = e.local_nome ? `${e.local_nome} · ${e.local_cidade}` : 'Na IEJB';
    abrirFolha({
        titulo: e.titulo,
        conteudo: h('div', { class: 'form evento-detalhe' },
            imagem && h('img', { class: 'evento-detalhe-img', src: imagem, alt: '', decoding: 'async', width: 800, height: 450 }),
            h('p', { class: 'evento-detalhe-categoria' }, e.categoria),
            h('ul', { class: 'evento-detalhe-fatos' },
                h('li', null, icone('calendario', 'icone icone-p'), quando),
                h('li', null, icone('local', 'icone icone-p'), onde)),
            h('p', { class: 'evento-detalhe-texto' }, e.descricao),
            e.link_inscricao && h('a', { class: 'botao-principal botao-largo', href: e.link_inscricao, target: '_blank', rel: 'noopener' }, 'Inscreva-se'),
            h('a', { class: 'botao-secundario botao-largo', href: enderecoNoSite(e), target: '_blank', rel: 'noopener' },
                icone('externo', 'icone icone-p'), 'Ver no site e compartilhar')),
    });
}
