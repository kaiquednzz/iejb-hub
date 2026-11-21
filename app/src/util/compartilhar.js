// Compartilhar no WhatsApp (redesign v2). O texto usa a marcação do próprio
// WhatsApp (*negrito*, _itálico_) e abre pelo wa.me, que no celular abre o
// app do WhatsApp para escolher a conversa. Sem WhatsApp, abre o WhatsApp Web.
import { h, icone } from './dom.js';
import { rotuloDoDia, formatarHorario } from './datas.js';
import { filaDoYoutube } from './musica.js';
import { naoVai, FUNCAO_MESA } from './escala.js';
import { nomeCurto } from '../sessao.js';

export function abrirWhatsApp(texto) {
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
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

export function botaoWhatsRepertorio(culto, classe = 'botao-whatsapp') {
    const b = h('button', { type: 'button', class: classe }, icone('whatsapp', 'icone icone-p'), 'Mandar no WhatsApp');
    b.addEventListener('click', (e) => { e.stopPropagation(); abrirWhatsApp(textoDoRepertorio(culto)); });
    return b;
}
