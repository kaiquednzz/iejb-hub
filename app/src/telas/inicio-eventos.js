// "Vem aí" na Início (D50): os eventos publicados no site, para todo mundo do
// Hub. Mesmo conceito da escala em blocos: fechado mostra só o essencial
// (dia, nome, hora); tocar abre os detalhes. Some sozinho quando o evento
// acaba (mesma regra do site) e, sem evento, a seção nem aparece.
import { h, icone } from '../util/dom.js';
import { abrirFolha } from '../util/folha.js';
import { partesDaData, formatarHorario, rotuloDoDia } from '../util/datas.js';
import { proximosEventos, urlDaImagem, enderecoNoSite } from '../util/eventos.js';

const MAXIMO = 4;

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
        lugar.replaceChildren(
            h('h2', { id: 'titulo-eventos', class: 'inicio-secao' }, 'Vem aí'),
            h('ul', { class: 'eventos-faixa' }, eventos.map((e, i) => h('li', { style: { '--i': i } }, cartao(e)))),
        );
        lugar.hidden = false;
    }
}

function cartao(e) {
    const p = partesDaData(e.data);
    const agora = e.situacao === 'agora';
    const b = h('button', { type: 'button', class: `evento-bloco${agora ? ' agora' : ''}` },
        h('span', { class: 'evento-bloco-data', 'aria-hidden': 'true' },
            h('span', { class: 'evento-bloco-mes' }, p.mes),
            h('span', { class: 'evento-bloco-dia' }, p.dia)),
        h('span', { class: 'evento-bloco-textos' },
            h('span', { class: 'evento-bloco-titulo' }, e.titulo),
            h('span', { class: 'evento-bloco-quando' },
                agora ? h('span', { class: 'evento-agora' }, 'Acontecendo agora') : `${p.semana} · ${formatarHorario(e.horario)}`)),
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
