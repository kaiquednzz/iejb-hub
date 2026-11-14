// Função de servidor "links-da-musica": o link de cada streaming que abre
// A FAIXA no app (não a busca, que o Spotify e o Apple Music ignoram no iPhone).
//
//   POST { musica_id }  ->  { apple, spotify, ytmusic, youtube, faixa } | { nada: true }
//
// Como acha:
//   1. Catálogo público do iTunes (sem chave): "título artista", Brasil, 1º resultado.
//   2. song.link (sem chave, 10 consultas/min) traduz a faixa da Apple para
//      Spotify, YouTube Music e YouTube.
// O resultado fica guardado em musica.links_streaming: cada música é
// procurada uma vez (de novo só se não achou, depois de 1 dia, ou se o
// título/artista mudar, que zera a coluna no banco).
//
// Segurança: só quem está logado (token conferido aqui). Ler a música é feito
// COM O TOKEN da pessoa (RLS); só a gravação dos links usa a chave de serviço.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const resposta = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
});
const UM_DIA = 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f-]{36}$/i;

// Só aceita links dos próprios serviços (nada de URL qualquer voltando para o app)
function seguro(url: unknown, hosts: string[]): string | null {
    if (typeof url !== 'string') return null;
    try {
        const u = new URL(url);
        return u.protocol === 'https:' && hosts.includes(u.hostname) ? u.toString() : null;
    } catch {
        return null;
    }
}

async function procurar(titulo: string, artista: string | null) {
    const termo = [titulo, artista].filter(Boolean).join(' ');
    const itunes = await fetch(`https://itunes.apple.com/search?${new URLSearchParams({
        term: termo, country: 'BR', media: 'music', entity: 'song', limit: '1',
    })}`, { signal: AbortSignal.timeout(8000) });
    if (!itunes.ok) throw new Error(`itunes ${itunes.status}`);
    const faixa = (await itunes.json()).results?.[0];
    const apple = seguro(faixa?.trackViewUrl, ['music.apple.com', 'itunes.apple.com']);
    if (!apple) return { nada: true };

    const links: Record<string, string | null> = { apple, spotify: null, ytmusic: null, youtube: null };
    try {
        const songlink = await fetch(`https://api.song.link/v1-alpha.1/links?${new URLSearchParams({
            url: apple, userCountry: 'BR',
        })}`, { signal: AbortSignal.timeout(8000) });
        if (songlink.ok) {
            const p = (await songlink.json()).linksByPlatform ?? {};
            links.spotify = seguro(p.spotify?.url, ['open.spotify.com']);
            links.ytmusic = seguro(p.youtubeMusic?.url, ['music.youtube.com']);
            links.youtube = seguro(p.youtube?.url, ['www.youtube.com', 'youtube.com', 'youtu.be']);
        }
    } catch (e) {
        console.error('song.link', e);   // fica só com a Apple; o app usa a busca nos outros
    }
    return { ...links, faixa: `${faixa.trackName} – ${faixa.artistName}` };
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return resposta(405, { erro: 'Método não permitido.' });

    const url = Deno.env.get('SUPABASE_URL')!;
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const chavePublica = req.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY')!;
    if (!token) return resposta(401, { erro: 'Entre no Hub de novo.' });

    const sistema = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user } } = await sistema.auth.getUser(token);
    if (!user) return resposta(401, { erro: 'Sessão expirada.' });

    const { musica_id } = await req.json().catch(() => ({}));
    if (typeof musica_id !== 'string' || !UUID.test(musica_id)) return resposta(400, { erro: 'Música inválida.' });

    // Lê como a pessoa: se ela não pode ver a música, não recebe nada
    const comoQuemChamou = createClient(url, chavePublica, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: musica } = await comoQuemChamou.from('musica')
        .select('id, titulo, artista, links_streaming').eq('id', musica_id).maybeSingle();
    if (!musica) return resposta(404, { erro: 'Música não encontrada.' });

    const guardado = musica.links_streaming;
    const fresco = guardado && (!guardado.nada || Date.now() - Date.parse(guardado.em) < UM_DIA);
    if (fresco) return resposta(200, guardado);

    let achado;
    try {
        achado = { ...(await procurar(musica.titulo, musica.artista)), em: new Date().toISOString() };
    } catch (e) {
        console.error(e);
        return resposta(502, { erro: 'Não deu para procurar agora.' });
    }
    await sistema.from('musica').update({ links_streaming: achado }).eq('id', musica.id);
    return resposta(200, achado);
});
