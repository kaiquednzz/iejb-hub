// Abertura (D51): a logo se monta no index.html enquanto o app carrega.
// Ela sai quando as duas coisas acontecem: a primeira tela está pronta E a
// animação terminou (cortar no meio fica feio). Se o app demorar, ela espera
// o app; se o app for rápido, espera a animação. Nunca as duas somadas.
const DURACAO_MS = 2150;           // chama no lugar + um respiro com a logo inteira
const DURACAO_SEM_MOVIMENTO_MS = 500;

export function fecharAbertura() {
    const abertura = document.getElementById('abertura');
    if (!abertura || abertura.classList.contains('saindo')) return;
    const semMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const falta = (semMovimento ? DURACAO_SEM_MOVIMENTO_MS : DURACAO_MS) - performance.now();
    setTimeout(() => {
        abertura.classList.add('saindo');
        abertura.addEventListener('transitionend', () => abertura.remove(), { once: true });
        setTimeout(() => abertura.remove(), 800); // se o transitionend não vier
    }, Math.max(0, falta));
}
