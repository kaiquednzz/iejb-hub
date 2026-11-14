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

// "achados": os links diretos da faixa (função links-da-musica; hoje só a
// Apple). Onde não tiver, cai na busca. O app do Spotify ignora a busca que
// chega por open.spotify.com, então no celular usa o endereço do próprio app
// (spotify:search:termo), que abre já buscando; "reserva" é a busca no
// navegador, para quem não tem o app (ver abrirComReserva).
const CELULAR = /iphone|ipad|ipod|android/i.test(navigator.userAgent);

// Não dá para saber de antemão se o app do Spotify está instalado. Se o
// endereço spotify: falha (o iPhone mostra "endereço inválido" e a página
// continua na frente), o aparelho guarda isso e passa a abrir a busca no
// navegador. Se um dia o app abrir (a página some), a marca é apagada.
const SEM_SPOTIFY = 'iejb-sem-app-spotify';
const lerMarca = () => { try { return localStorage.getItem(SEM_SPOTIFY) === '1'; } catch { return false; } };
const marcar = (sem) => { try { sem ? localStorage.setItem(SEM_SPOTIFY, '1') : localStorage.removeItem(SEM_SPOTIFY); } catch { /* sem armazenamento: tenta o app de novo da próxima vez */ } };

export function linksDeBusca(musica, achados = null) {
    const termo = encodeURIComponent(termoDeBusca(musica));
    const spotifyWeb = `https://open.spotify.com/search/${termo}`;
    return [
        achados?.spotify
            ? { nome: 'Spotify', classe: 'spotify', url: achados.spotify }
            : CELULAR && !lerMarca()
                ? { nome: 'Spotify', classe: 'spotify', url: `spotify:search:${termo}`, reserva: spotifyWeb }
                : { nome: CELULAR ? 'Spotify (navegador)' : 'Spotify', classe: 'spotify', url: spotifyWeb },
        { nome: 'YouTube Music', classe: 'ytmusic', url: achados?.ytmusic ?? `https://music.youtube.com/search?q=${termo}` },
        { nome: 'Apple Music', classe: 'apple', url: achados?.apple ?? `https://music.apple.com/br/search?term=${termo}` },
        { nome: 'YouTube', classe: 'youtube', url: achados?.youtube ?? `https://www.youtube.com/results?search_query=${termo}` },
    ].map((l) => ({ ...l, direto: Boolean(achados?.[l.classe]) }));
}

// Endereço de app (spotify:): se em 1,5 s a página continua na frente, o app
// não abriu. Abrir o navegador sozinho nessa hora o iPhone bloqueia (não veio
// de um toque), então só guarda a marca e chama aoFalhar, que troca o botão
// para a busca no navegador. Abriu o app em até 15 s: apaga a marca.
export function abrirComReserva(aoFalhar) {
    let abriu = false;
    const aoSumir = () => {
        if (document.visibilityState !== 'hidden') return;
        abriu = true;
        marcar(false);
        document.removeEventListener('visibilitychange', aoSumir);
    };
    document.addEventListener('visibilitychange', aoSumir);
    setTimeout(() => document.removeEventListener('visibilitychange', aoSumir), 15000);
    setTimeout(() => {
        if (abriu || document.visibilityState !== 'visible') return;
        marcar(true);
        aoFalhar?.();
    }, 1500);
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
