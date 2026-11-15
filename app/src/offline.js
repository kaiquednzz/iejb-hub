// Cópia local da conta e da última escala, para abrir o app sem internet
// (subsolo da igreja, 4G ruim). Fica no localStorage do próprio aparelho.
//
// Só guarda o que a pessoa já podia ver, e é apagado ao sair da conta.
// É uma cópia de leitura: nada é editado offline.

const CHAVE_CONTA = 'iejb-hub:conta';
const CHAVE_ESCALA = 'iejb-hub:escala';
const CHAVE_CIFRAS = 'iejb-hub:cifras';

function ler(chave) {
    try { return JSON.parse(localStorage.getItem(chave)); } catch { return null; }
}
function gravar(chave, valor) {
    try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* cheio ou bloqueado: segue sem cópia */ }
}

export function guardarConta(conta) { gravar(CHAVE_CONTA, conta); }
export function contaGuardada(idUsuario) {
    const conta = ler(CHAVE_CONTA);
    return conta?.id === idUsuario ? conta : null;
}

export function guardarEscala(idUsuario, cultos) {
    gravar(CHAVE_ESCALA, { idUsuario, salvaEm: new Date().toISOString(), cultos });
}
export function escalaGuardada(idUsuario) {
    const copia = ler(CHAVE_ESCALA);
    return copia?.idUsuario === idUsuario ? copia : null;
}

// Cifras dos repertórios que a pessoa vê (D38), para abrir no ensaio sem
// sinal. Cada vez que a escala carrega, a lista é trocada inteira: cifra de
// música que saiu do repertório não fica ocupando espaço.
export function guardarCifras(cifras) {
    gravar(CHAVE_CIFRAS, Object.fromEntries(cifras.map((c) => [c.id, c])));
}
export function cifrasGuardadas() { return ler(CHAVE_CIFRAS) ?? {}; }

export function apagarCopiasLocais() {
    try {
        localStorage.removeItem(CHAVE_CONTA);
        localStorage.removeItem(CHAVE_ESCALA);
        localStorage.removeItem(CHAVE_CIFRAS);
    } catch { /* nada a fazer */ }
}

// Erro de rede (sem internet) é diferente de erro do servidor (RLS, bug):
// só no primeiro caso faz sentido mostrar a cópia antiga.
export function eErroDeRede(erro) {
    return !navigator.onLine || /fetch|network|load failed/i.test(erro?.message ?? '');
}
