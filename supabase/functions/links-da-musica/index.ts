// Função de servidor "links-da-musica": o link de cada streaming que abre
// A FAIXA no app (não a busca, que o Spotify e o Apple Music ignoram no iPhone).
//
//   POST { musica_id }  ->  { apple, faixa } | { nada: true }
//
// Como acha: catálogo público do iTunes (sem chave), "título artista", Brasil,
// 5 resultados; fica o de título mais parecido (ver escolher()).
// O Spotify não sai daqui: o song.link, que traduzia a faixa, fechou a API
// pública (401 PUBLIC_API_ACCESS_DEPRECATED, 14/11/2026). No celular o app
// abre o Spotify direto na busca (spotify:search:), ver util/musica.js.
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

// Tira acento, caixa e o que estiver entre parênteses: "Bondade de Deus (Ao Vivo)" -> "bondade de deus"
const limpo = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const AO_VIVO = /\b(ao vivo|en vivo|live|acustic|acoustic|playback|instrumental|karaoke)\b/i;

// Melhor resultado: título igual vale mais; a versão (ao vivo, playback...)
// tem que bater com o que o título cadastrado pede; artista igual ajuda.
function escolher(resultados: any[], titulo: string, artista: string | null) {
    const alvo = limpo(titulo);
    const pedeVersao = AO_VIVO.test(titulo);
    let melhor = null, nota = -Infinity;
    resultados.forEach((r, i) => {
        let n = -i * 0.1;   // empate: fica a ordem da Apple
        if (limpo(r.trackName ?? '') === alvo) n += 3;
        else if (limpo(r.trackName ?? '').includes(alvo)) n += 1;
        if (artista && limpo(r.artistName ?? '').includes(limpo(artista))) n += 1;
        const eVersao = AO_VIVO.test(`${r.trackName} ${r.collectionName}`);
        if (eVersao !== pedeVersao) n -= 1.5;   // quer estúdio e veio ao vivo, ou o contrário
        if (n > nota) { nota = n; melhor = r; }
    });
    return nota >= 1 ? melhor : null;   // nada parecido: melhor cair na busca
}

async function procurar(titulo: string, artista: string | null) {
    const termo = [titulo, artista].filter(Boolean).join(' ');
    const itunes = await fetch(`https://itunes.apple.com/search?${new URLSearchParams({
        term: termo, country: 'BR', media: 'music', entity: 'song', limit: '5',
    })}`, { signal: AbortSignal.timeout(8000) });
    if (!itunes.ok) throw new Error(`itunes ${itunes.status}`);
    const faixa = escolher((await itunes.json()).results ?? [], titulo, artista);
    const apple = seguro(faixa?.trackViewUrl, ['music.apple.com', 'itunes.apple.com']);
    if (!apple) return { nada: true };
    return { apple, faixa: `${faixa.trackName} – ${faixa.artistName}` };
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
