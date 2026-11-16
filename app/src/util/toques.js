// Ícones que reagem ao toque (D59). Cada um com um gesto que combina com ele:
// o sino balança, a moeda gira, o relógio dá uma volta, o olho pisca...
//
// Um ouvinte só, no documento inteiro (delegação): qualquer botão ou link com
// ícone ganha o efeito, inclusive os que forem criados depois. O movimento em
// si está no CSS (estilo/toques.css), só com translate/rotate/scale, que
// rodam na placa de vídeo e não brigam com o transform que já existe nos
// botões (o "afundar" ao apertar) nem com o rotate(180°) das setas.
// Com "reduzir movimento" ligado, o CSS desliga tudo.

const IGNORAR = '.aba, .lateral-item, [disabled], [aria-disabled="true"]'; // abas já pulam ao trocar

export function ligarToques() {
    document.addEventListener('pointerdown', (evento) => {
        const alvo = evento.target.closest?.('button, a, [role="tab"]');
        if (!alvo || alvo.matches(IGNORAR)) return;
        const svg = alvo.querySelector('svg[data-icone]');
        if (!svg || svg.classList.contains('desenha')) return;
        svg.classList.remove('reage');
        void svg.getBoundingClientRect(); // reinicia se tocar de novo no meio
        svg.classList.add('reage');
        svg.addEventListener('animationend', () => svg.classList.remove('reage'), { once: true });
    }, { passive: true });
}
