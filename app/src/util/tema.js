// Cor do topo do celular (meta theme-color). Cada troca de tela volta para a
// cor padrão (main.js); uma tela pode pedir outra, como a capa vermelha do
// dia de culto no Início.
const meta = () => document.querySelector('meta[name="theme-color"]');
let padrao = null;
export function corDoTopo(cor) {
    const m = meta();
    if (!m) return;
    padrao ??= m.content;
    m.content = cor ?? padrao;
}
