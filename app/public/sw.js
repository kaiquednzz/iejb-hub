// Service worker do IEJB Hub (escrito à mão, sem Workbox: são poucas regras).
//
// O que ele faz:
//   1. Páginas (navegação): REDE PRIMEIRO. Com internet, sempre a versão nova.
//      Sem internet, abre a última cópia guardada do app.
//   2. /assets/* (JS e CSS do build): CACHE PRIMEIRO. O Vite põe um hash no
//      nome (index-B3oDp4F2.js); se o conteúdo muda, o nome muda. Então um
//      arquivo com o mesmo nome nunca fica velho e pode vir direto do cache.
//   3. Ícones e manifest: usa o do cache e atualiza por trás.
//   4. Supabase (dados) e outros domínios: NÃO passa por aqui. Dado de escala
//      tem que ser fresco; a cópia offline da escala é guardada pelo próprio
//      app (ver src/offline.js), não pelo service worker.
//
// Por que não tem botão "nova versão disponível"? Porque a navegação já é
// rede-primeiro: abrir o app com internet já carrega o build novo. Este
// arquivo só precisa mudar quando as REGRAS acima mudarem.

const CACHE_APP = 'iejb-hub-app';
const CACHE_ASSETS = 'iejb-hub-assets';
const ESTATICOS = ['/manifest.webmanifest', '/logo-iejb-pequeno.png', '/icone-192.png', '/favicon-96x96.png'];

self.addEventListener('install', (evento) => {
    evento.waitUntil((async () => {
        const app = await caches.open(CACHE_APP);
        await app.addAll(ESTATICOS);
        // Guarda a página E os arquivos que ela usa já na instalação.
        // Sem isso, na primeira visita o JS/CSS passa antes do SW existir
        // e o app não abriria offline até a segunda visita.
        const resposta = await fetch('/', { cache: 'no-cache' });
        if (resposta.ok) {
            const html = await resposta.clone().text();
            await app.put('/', resposta);
            const arquivos = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
            await (await caches.open(CACHE_ASSETS)).addAll(arquivos);
        }
        // Não espera as abas antigas fecharem: as regras são seguras para
        // assumir uma página que já está aberta.
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (evento) => {
    evento.waitUntil((async () => {
        const nossos = [CACHE_APP, CACHE_ASSETS];
        for (const nome of await caches.keys()) {
            if (!nossos.includes(nome)) await caches.delete(nome);
        }
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (evento) => {
    const pedido = evento.request;
    if (pedido.method !== 'GET') return;
    const url = new URL(pedido.url);
    if (url.origin !== self.location.origin) return; // Supabase, fontes: direto pra rede

    if (pedido.mode === 'navigate') {
        evento.respondWith(navegacao(pedido));
    } else if (url.pathname.startsWith('/assets/')) {
        evento.respondWith(cachePrimeiro(pedido));
    } else {
        evento.respondWith(cacheEAtualiza(pedido, evento));
    }
});

async function navegacao(pedido) {
    const app = await caches.open(CACHE_APP);
    try {
        const resposta = await fetch(pedido);
        // O app é uma página só: guarda sempre como "/", sem ?query
        // (evita uma cópia por link com ?utm=...).
        if (resposta.ok && !resposta.redirected) {
            await app.put('/', resposta.clone());
            limparAssetsVelhos(await resposta.clone().text()); // sem await: não atrasa a página
        }
        return resposta;
    } catch {
        const guardada = await app.match('/');
        return guardada ?? new Response('Sem conexão e o app ainda não foi aberto com internet neste aparelho.', {
            status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    }
}

// Cada deploy gera arquivos com hash novo. Os do build anterior viram lixo:
// apaga do cache tudo que a página atual não referencia mais.
async function limparAssetsVelhos(html) {
    const usados = new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]));
    if (usados.size === 0) return; // HTML inesperado: melhor não apagar nada
    const assets = await caches.open(CACHE_ASSETS);
    for (const pedido of await assets.keys()) {
        if (!usados.has(new URL(pedido.url).pathname)) await assets.delete(pedido);
    }
}

async function cachePrimeiro(pedido) {
    const assets = await caches.open(CACHE_ASSETS);
    // ignoreVary: o servidor manda "Vary: Origin" e o <script crossorigin> do
    // Vite envia Origin, mas a cópia feita na instalação não. Sem isto o cache
    // nunca "batia" e o app não abria offline. Seguro aqui porque arquivo com
    // hash no nome tem sempre o mesmo conteúdo.
    const guardada = await assets.match(pedido, { ignoreVary: true });
    if (guardada) return guardada;
    const resposta = await fetch(pedido);
    if (resposta.ok) await assets.put(pedido, resposta.clone());
    return resposta;
}

async function cacheEAtualiza(pedido, evento) {
    const app = await caches.open(CACHE_APP);
    const guardada = await app.match(pedido);
    const daRede = fetch(pedido).then(async (resposta) => {
        if (resposta.ok) await app.put(pedido, resposta.clone());
        return resposta;
    });
    if (guardada) {
        evento.waitUntil(daRede.catch(() => {})); // atualiza por trás
        return guardada;
    }
    return daRede;
}

// ---------------------------------------------------------------------------
// Notificações push (D18, D25)
// O servidor (função enviar-push) manda { titulo, corpo, url, tag }.
// No iPhone, todo push PRECISA virar notificação visível: se o service worker
// recebe e não mostra nada, o iOS cancela a inscrição depois de algumas vezes.
// ---------------------------------------------------------------------------
self.addEventListener('push', (evento) => {
    let dados = {};
    try { dados = evento.data?.json() ?? {}; } catch { dados = { corpo: evento.data?.text() }; }
    evento.waitUntil(self.registration.showNotification(dados.titulo || 'IEJB Hub', {
        body: dados.corpo || 'Tem novidade na escala.',
        icon: '/icone-192.png',
        badge: '/icone-192.png',
        tag: dados.tag,          // mesma escala: a notificação nova substitui a antiga
        renotify: !!dados.tag,   // ...mas ainda vibra/toca de novo
        data: { url: dados.url || '/' },
    }));
});

// Tocar na notificação: abre o app (ou traz para frente o que já está aberto)
self.addEventListener('notificationclick', (evento) => {
    evento.notification.close();
    const destino = new URL(evento.notification.data?.url || '/', self.location.origin).href;
    evento.waitUntil((async () => {
        const abertos = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const app = abertos.find((c) => new URL(c.url).origin === self.location.origin);
        if (app) {
            await app.focus();
            return app.navigate(destino).catch(() => {});
        }
        return self.clients.openWindow(destino);
    })());
});
