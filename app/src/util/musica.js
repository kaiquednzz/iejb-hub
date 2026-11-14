// Música nas plataformas de streaming, sem integração de conta (D26).
//
// Cada botão abre a BUSCA da plataforma com título + artista: funciona para
// qualquer pessoa, sem login no Hub, sem chave de API e sem limite de uso.
// "Tocar o repertório" monta uma fila no YouTube com os vídeos da ordem do
// culto, a partir dos links do YouTube cadastrados nas músicas.
//
// Risco aceito (D26): o endereço watch_videos do YouTube não é oficial.
// Se um dia parar, os botões por música continuam funcionando.

import { supabase } from '../supabase.js';

export function termoDeBusca(musica) {
    return [musica.titulo, musica.artista].filter(Boolean).join(' ');
}

// "achados": os links diretos da faixa (função links-da-musica). Onde não
// tiver, cai na busca, que funciona no navegador e no YouTube, mas o app do
// Spotify e o do Apple Music no iPhone abrem sem a busca.
export function linksDeBusca(musica, achados = null) {
    const termo = encodeURIComponent(termoDeBusca(musica));
    return [
        { nome: 'Spotify', classe: 'spotify', url: achados?.spotify ?? `https://open.spotify.com/search/${termo}` },
        { nome: 'YouTube Music', classe: 'ytmusic', url: achados?.ytmusic ?? `https://music.youtube.com/search?q=${termo}` },
        { nome: 'Apple Music', classe: 'apple', url: achados?.apple ?? `https://music.apple.com/br/search?term=${termo}` },
        { nome: 'YouTube', classe: 'youtube', url: achados?.youtube ?? `https://www.youtube.com/results?search_query=${termo}` },
    ].map((l) => ({ ...l, direto: Boolean(achados?.[l.classe]) }));
}

// Pede ao servidor os links diretos (uma vez por música e por sessão; o
// servidor ainda guarda no banco para os próximos)
const linksAchados = new Map();
export function buscarLinksDiretos(musicaId) {
    if (!linksAchados.has(musicaId)) {
        linksAchados.set(musicaId, supabase.functions
            .invoke('links-da-musica', { body: { musica_id: musicaId } })
            .then(({ data, error }) => {
                if (error || !data) { linksAchados.delete(musicaId); return null; }
                return data;
            }));
    }
    return linksAchados.get(musicaId);
}

// Pega o ID de 11 caracteres de qualquer formato de link do YouTube:
// youtu.be/ID, watch?v=ID, /shorts/ID, /embed/ID, /live/ID, music.youtube.com
export function idDoYoutube(link) {
    if (!link) return null;
    let url;
    try { url = new URL(link); } catch { return null; }
    const host = url.hostname.replace(/^www\.|^m\./, '');
    let id = null;
    if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'music.youtube.com') {
        id = url.searchParams.get('v')
            ?? url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1]
            ?? null;
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
}

// Fila do culto no YouTube, na ordem do repertório
export function filaDoYoutube(musicas) {
    const ids = musicas.map((m) => idDoYoutube(m.link)).filter(Boolean);
    return {
        ids,
        url: ids.length ? `https://www.youtube.com/watch_videos?video_ids=${ids.join(',')}` : null,
    };
}

// Só http(s): o banco já confere, mas conferir de novo aqui custa uma linha
export function linkSeguro(link) {
    return link && /^https?:\/\//i.test(link) ? link : null;
}

// Tons mais usados, para escolher com um toque (dá para escrever outro)
export const TONS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
