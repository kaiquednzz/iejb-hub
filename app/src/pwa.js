// Tudo que é PWA fora do service worker: registrar o SW, descobrir em que
// aparelho estamos, se o app já está instalado, e guardar o pedido de
// instalação do Android.

// --- Em que aparelho estamos -------------------------------------------------

const ua = navigator.userAgent;

// iPadOS 13+ se apresenta como Mac; o que entrega é ter tela de toque
const ehIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const ehAndroid = /Android/.test(ua);

// Navegadores embutidos em outros apps (abrir o link pelo WhatsApp, Instagram...)
// não instalam PWA. A pessoa precisa abrir no navegador de verdade.
const ehNavegadorDeApp = /FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv\)|GSA\//.test(ua);

export const aparelho = {
    ios: ehIOS,
    android: ehAndroid,
    celular: ehIOS || ehAndroid,
    navegadorDeApp: ehNavegadorDeApp,
};

export function estaInstalado() {
    return matchMedia('(display-mode: standalone)').matches
        || matchMedia('(display-mode: fullscreen)').matches
        || navigator.standalone === true; // Safari do iPhone
}

// Regra do projeto: no celular, só instalado (é o que permite o push no
// iPhone, que só chega para app da tela de início). No computador, livre.
// No `npm run dev` a trava fica desligada: pelo IP da rede local não existe
// HTTPS, então nem dá para instalar enquanto desenvolve.
export function precisaInstalar() {
    if (import.meta.env.DEV) return false;
    return aparelho.celular && !estaInstalado();
}

// --- Pedido de instalação do Android (Chrome, Edge, Samsung) -----------------
// O navegador dispara "beforeinstallprompt" quando acha que o site pode ser
// instalado. Isso pode acontecer antes da tela de instalação existir, então
// guardamos o evento aqui (módulo carregado logo no início) e avisamos quem
// estiver ouvindo.

let pedidoGuardado = null;
const ouvintes = new Set();

window.addEventListener('beforeinstallprompt', (evento) => {
    evento.preventDefault(); // nós mostramos o nosso botão, não o banner padrão
    pedidoGuardado = evento;
    ouvintes.forEach((ouvinte) => ouvinte('disponivel'));
});

window.addEventListener('appinstalled', () => {
    pedidoGuardado = null;
    ouvintes.forEach((ouvinte) => ouvinte('instalado'));
});

export function podeInstalarDireto() {
    return pedidoGuardado !== null;
}

export function aoMudarInstalacao(ouvinte) {
    ouvintes.add(ouvinte);
    return () => ouvintes.delete(ouvinte);
}

// Abre a janelinha nativa "Instalar app?". Devolve true se a pessoa aceitou.
export async function pedirInstalacao() {
    if (!pedidoGuardado) return false;
    const pedido = pedidoGuardado;
    pedidoGuardado = null; // o mesmo evento só pode ser usado uma vez
    await pedido.prompt();
    const { outcome } = await pedido.userChoice;
    return outcome === 'accepted';
}

// --- Service worker ----------------------------------------------------------

export function registrarServiceWorker() {
    // Em dev o Vite serve módulos soltos que mudam a cada salvamento: um SW
    // guardando cópias ali só atrapalharia.
    if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((erro) => {
            console.error('Service worker não registrou:', erro);
        });
    });
}
