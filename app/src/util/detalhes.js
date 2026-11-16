// Abre e fecha todo <details> do app com animação (repertório, "Desativadas",
// eventos antigos...). Antes era só CSS (interpolate-size + ::details-content),
// que o Safari ignora: no iPhone o repertório abria seco, sem animação.
//
// Um ouvinte só, no documento (vale para os <details> criados depois também):
// - a altura do bloco anima do tamanho fechado até o aberto (ou o contrário);
// - ao abrir, o conteúdo desce e aparece em cascata (música por música).
// Usa a Web Animations API (funciona no Safari, Chrome e Firefox) e só mexe
// em height/opacity/transform durante a animação. Com "reduzir movimento",
// o navegador abre e fecha normal, sem animação.

const DURACAO = 420;
const CURVA = 'cubic-bezier(0.32, 0.72, 0, 1)'; // a mesma "ease-ios" das folhas

export function ligarDetalhes() {
    document.addEventListener('click', (evento) => {
        const resumo = evento.target.closest('summary');
        const detalhes = resumo?.parentElement;
        if (!detalhes || detalhes.tagName !== 'DETAILS' || resumo !== detalhes.firstElementChild) return;
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        evento.preventDefault();
        alternar(detalhes);
    });
}

function alturaFechado(detalhes) {
    const estava = detalhes.open;
    detalhes.open = false;
    const altura = detalhes.offsetHeight;
    detalhes.open = estava;
    return altura;
}

function alternar(detalhes) {
    const abrindo = !detalhes.open || detalhes.classList.contains('fechando');
    const inicio = detalhes.offsetHeight; // pega do meio, se tocar durante uma animação
    detalhes.__animacao?.cancel();
    detalhes.classList.toggle('fechando', !abrindo);
    if (abrindo) detalhes.open = true;
    const fim = abrindo ? detalhes.offsetHeight : alturaFechado(detalhes);

    detalhes.style.overflow = 'clip';
    const animacao = detalhes.animate({ height: [`${inicio}px`, `${fim}px`] }, { duration: DURACAO, easing: CURVA });
    detalhes.__animacao = animacao;

    if (abrindo) cascata(detalhes);

    animacao.onfinish = () => {
        if (!abrindo) detalhes.open = false;
        detalhes.classList.remove('fechando');
        detalhes.style.overflow = '';
        detalhes.__animacao = null;
    };
    animacao.oncancel = () => { detalhes.style.overflow = ''; };
}

// O que está dentro desce e aparece; numa lista, item por item
function cascata(detalhes) {
    const blocos = [...detalhes.children].slice(1);
    const pecas = blocos.flatMap((b) => (b.matches('ol, ul') ? [...b.children] : [b])).slice(0, 12);
    pecas.forEach((peca, i) => {
        peca.animate(
            { opacity: [0, 1], transform: ['translateY(-8px)', 'none'] },
            { duration: 360, delay: 40 + i * 45, easing: CURVA, fill: 'backwards' },
        );
    });
}
