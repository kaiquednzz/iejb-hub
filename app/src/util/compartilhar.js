// Compartilhar no WhatsApp (redesign v2). O texto usa a marcação do próprio
// WhatsApp (*negrito*, _itálico_) e abre pelo wa.me, que no celular abre o
// app do WhatsApp para escolher a conversa. Sem WhatsApp, abre o WhatsApp Web.
import { h, icone } from './dom.js';
import { rotuloDoDia, formatarHorario } from './datas.js';
import { filaDoYoutube, linkSeguro } from './musica.js';

export function abrirWhatsApp(texto) {
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
}

// "*Repertório · Culto da Família*\nDomingo, 22 de nov. · 18h\n\n1. Música · Artista\n   Tom: G\n   link..."
export function textoDoRepertorio(culto) {
    const itens = culto.repertorio_item ?? [];
    const titulo = `${culto.nome}${culto.rotulo ? ` · ${culto.rotulo}` : ''}`;
    const linhas = [`*Repertório · ${titulo}*`, `${rotuloDoDia(culto.data)} · ${formatarHorario(culto.horario)}`, ''];
    itens.forEach((item, i) => {
        const m = item.musica;
        linhas.push(`*${i + 1}. ${m.titulo}*${m.artista ? ` · ${m.artista}` : ''}`);
        if (item.tom) linhas.push(`   Tom: ${item.tom}`);
        const link = linkSeguro(m.link);
        if (link) linhas.push(`   ${link}`);
    });
    const fila = filaDoYoutube(itens.map((i) => i.musica));
    if (fila.url && fila.ids.length > 1) linhas.push('', `Ouvir tudo em sequência: ${fila.url}`);
    linhas.push('', '_Enviado pelo IEJB Hub_');
    return linhas.join('\n');
}

export function botaoWhatsRepertorio(culto, classe = 'botao-whatsapp') {
    const b = h('button', { type: 'button', class: classe }, icone('whatsapp', 'icone icone-p'), 'Mandar no WhatsApp');
    b.addEventListener('click', (e) => { e.stopPropagation(); abrirWhatsApp(textoDoRepertorio(culto)); });
    return b;
}
