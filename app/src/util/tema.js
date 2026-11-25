// Preferência de aparência fica no aparelho: não é um dado de conta.
const CHAVE = 'iejb-aparencia';
const CORES_TOPO = { claro: '#FDFAF5', escuro: '#18191A' };
const meta = () => document.querySelector('meta[name="theme-color"]');
const sistema = () => window.matchMedia?.('(prefers-color-scheme: dark)');

export function preferenciaTema() {
    try {
        const modo = localStorage.getItem(CHAVE);
        return ['sistema', 'claro', 'escuro'].includes(modo) ? modo : 'claro';
    } catch { return 'claro'; }
}

function aplicar(modo = preferenciaTema()) {
    const escuro = modo === 'escuro' || (modo === 'sistema' && sistema()?.matches);
    document.documentElement.dataset.tema = escuro ? 'escuro' : 'claro';
    const m = meta();
    if (m && !corTopoSolicitada) m.content = escuro ? CORES_TOPO.escuro : CORES_TOPO.claro;
    return escuro;
}

export function definirPreferenciaTema(modo) {
    if (!['sistema', 'claro', 'escuro'].includes(modo)) return;
    try { localStorage.setItem(CHAVE, modo); } catch { /* preferência vale nesta sessão */ }
    aplicar(modo);
}

// Chamado na inicialização para ligar mudanças do sistema quando necessário.
const media = sistema();
const aoMudarSistema = () => {
    if (preferenciaTema() === 'sistema') aplicar('sistema');
};
if (media?.addEventListener) media.addEventListener('change', aoMudarSistema);
else media?.addListener?.(aoMudarSistema);

let corTopoSolicitada = null;
export function corDoTopo(cor) {
    corTopoSolicitada = cor ?? null;
    const m = meta();
    if (!m) return;
    if (corTopoSolicitada) m.content = corTopoSolicitada;
    else aplicar();
}

aplicar();
