// Compartilhar no WhatsApp (redesign v2). O texto usa a marcação do próprio
// WhatsApp (*negrito*, _itálico_) e abre pelo wa.me, que no celular abre o
// app do WhatsApp para escolher a conversa. Sem WhatsApp, abre o WhatsApp Web.
import { h } from './dom.js';
import { rotuloDoDia, formatarHorario } from './datas.js';
import { filaDoYoutube } from './musica.js';
import { naoVai, FUNCAO_MESA } from './escala.js';
import { nomeCurto } from '../sessao.js';

export function abrirWhatsApp(texto) {
    window.open(linkDoWhatsApp(texto), '_blank', 'noopener');
}
export const linkDoWhatsApp = (texto) => `https://wa.me/?text=${encodeURIComponent(texto)}`;

// A marca do WhatsApp (balão com o telefone), em branco sobre o verde.
// Todo botão de WhatsApp do app é só ela (pedido do Kaique): o logo é
// reconhecido na hora, até por quem não lê o texto. O nome fica no
// aria-label e no title, para o leitor de tela e para o dedo que hesita.
export function logoWhatsApp() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'logo-whats');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const balao = document.createElementNS(ns, 'path');
    balao.setAttribute('d', 'M12 3.2a8.8 8.8 0 0 0-7.6 13.2L3.2 20.8l4.5-1.2A8.8 8.8 0 1 0 12 3.2z');
    balao.setAttribute('class', 'logo-whats-balao');
    const fone = document.createElementNS(ns, 'path');
    fone.setAttribute('d', 'M9.1 7.6c.3-.3.8-.2 1 .1l.9 1.8c.2.3.1.7-.1 1l-.6.6c.5 1.1 1.4 2 2.5 2.5l.6-.6c.3-.3.7-.3 1-.1l1.8.9c.4.2.4.7.1 1l-.8.8c-.6.6-1.5.8-2.3.5-2.2-.9-3.9-2.6-4.8-4.8-.3-.8-.1-1.7.5-2.3z');
    fone.setAttribute('class', 'logo-whats-fone');
    svg.append(balao, fone);
    return svg;
}

// Botão redondo só com o logo. Com `texto`, monta a mensagem na hora do toque
// (função ou string); com `href`, é um link comum (ex.: wa.me/<número>).
export function botaoWhats({ rotulo, texto, href, classe = '' }) {
    const props = { class: `botao-whats ${classe}`.trim(), 'aria-label': rotulo, title: rotulo };
    if (href) return h('a', { ...props, href, target: '_blank', rel: 'noopener noreferrer' }, logoWhatsApp());
    const b = h('button', { type: 'button', ...props }, logoWhatsApp());
    b.addEventListener('click', (e) => {
        e.stopPropagation(); // dentro de cartões que abrem ao toque
        abrirWhatsApp(typeof texto === 'function' ? texto() : texto);
    });
    return b;
}

// A mensagem é curta de propósito (pedido do Kaique): só as músicas com os
// tons, o link para ouvir tudo no YouTube e o link do culto no Hub.
//
//   *Repertório · Culto da Família*
//   Domingo, 22 de nov. · 18h
//
//   1. Grande é o Senhor · *G*
//   2. Santo Espírito · *D*
//
//   *Quem toca*
//   Voz: Larissa, Miriam
//   Violão: Kaique
//   Mesa de som: Davi
//
//   🎧 Ouvir no YouTube
//   https://www.youtube.com/watch_videos?video_ids=...
//
//   📲 Ver no IEJB Hub
//   https://app.iejb.com.br/#/culto/<id>
export function textoDoRepertorio(culto) {
    const itens = culto.repertorio_item ?? [];
    const titulo = `${culto.nome}${culto.rotulo ? ` · ${culto.rotulo}` : ''}`;
    const linhas = [`*Repertório · ${titulo}*`, `${rotuloDoDia(culto.data, true)} · ${formatarHorario(culto.horario)}`, ''];
    itens.forEach((item, i) => linhas.push(`${i + 1}. ${item.musica.titulo}${item.tom ? ` · *${item.tom}*` : ''}`));
    const quem = quemToca(culto);
    if (quem.length) linhas.push('', '*Quem toca*', ...quem);
    const fila = filaDoYoutube(itens.map((i) => i.musica));
    if (fila.url) linhas.push('', '🎧 Ouvir no YouTube', fila.url);
    linhas.push('', '📲 Ver no IEJB Hub', `${location.origin}/#/culto/${culto.id}`);
    return linhas.join('\n');
}

// "Voz: Larissa, Miriam" por instrumento, na ordem da banda, mesa por último.
// Só quem vai (quem avisou que não vai fica de fora).
const ORDEM = ['voz', 'violao', 'guitarra', 'baixo', 'teclado', 'bateria', 'cajon'];
const semAcento = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function quemToca(culto) {
    const porInstrumento = new Map();
    for (const e of culto.escala ?? []) {
        if (e.estado && e.estado !== 'publicada') continue;
        for (const item of e.escala_item ?? []) {
            if (naoVai(item) || !item.pessoa) continue;
            for (const inst of item.instrumento_exibido) {
                const nome = inst === FUNCAO_MESA ? 'Mesa de som' : inst;
                if (!porInstrumento.has(nome)) porInstrumento.set(nome, []);
                const quem = nomeCurto(item.pessoa, 'Alguém');
                if (!porInstrumento.get(nome).includes(quem)) porInstrumento.get(nome).push(quem);
            }
        }
    }
    const peso = (nome) => {
        if (nome === 'Mesa de som') return 99;
        const i = ORDEM.findIndex((o) => semAcento(nome).includes(o));
        return i < 0 ? 50 : i;
    };
    return [...porInstrumento].sort((a, b) => peso(a[0]) - peso(b[0])).map(([nome, pessoas]) => `${nome}: ${pessoas.join(', ')}`);
}

export function botaoWhatsRepertorio(culto, classe = '') {
    return botaoWhats({ rotulo: `Mandar o repertório de ${culto.nome} no WhatsApp`, texto: () => textoDoRepertorio(culto), classe });
}
