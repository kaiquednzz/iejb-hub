// Som de entrada (D51): um "plim" curto e baixo, feito na hora pelo Web Audio
// (sem arquivo para baixar). Duas notas em quinta, com cauda de sino.
//
// Quando toca:
//   - ao abrir o app, junto da chama acendendo, SE o celular deixar. O Chrome
//     do Android deixa site instalado na tela de início tocar som sozinho; o
//     iPhone não deixa (nenhuma página toca som sem um toque antes);
//   - ao entrar com e-mail e senha (aí tem o toque no botão).
// No iPhone respeita a chave do silencioso: no culto, não toca.
let contexto = null;

// Chamar DENTRO do toque (antes de qualquer await): é o que libera o áudio
export function prepararSom() {
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        contexto ??= new Ctx();
        if (contexto.state === 'suspended') contexto.resume();
        if ('audioSession' in navigator) navigator.audioSession.type = 'ambient';
    } catch { /* sem som, sem problema */ }
}

// Na abertura: tenta tocar em `quandoMs` (relógio da página). Se o celular
// não liberou o áudio, fica quieto, sem erro e sem pedir nada.
export function tocarNaAbertura(quandoMs) {
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        contexto ??= new Ctx();
        if ('audioSession' in navigator) navigator.audioSession.type = 'ambient';
        setTimeout(() => { if (contexto.state === 'running') tocarEntrada(); }, Math.max(0, quandoMs - performance.now()));
    } catch { /* sem som */ }
}

export function tocarEntrada() {
    if (!contexto || contexto.state !== 'running' || document.hidden) return;
    const agora = contexto.currentTime + 0.02;
    const saida = contexto.createGain();
    saida.gain.value = 0.11;
    saida.connect(contexto.destination);
    // Mi5 e depois Si5: subindo, como quem chega
    [[659.25, 0], [987.77, 0.11]].forEach(([freq, atraso]) => {
        for (const [mult, volume] of [[1, 1], [2.01, 0.18], [3.02, 0.06]]) { // harmônicos de sino
            const osc = contexto.createOscillator();
            const env = contexto.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq * mult;
            const t = agora + atraso;
            env.gain.setValueAtTime(0, t);
            env.gain.linearRampToValueAtTime(volume, t + 0.012);
            env.gain.exponentialRampToValueAtTime(0.0001, t + 1.3 / mult);
            osc.connect(env).connect(saida);
            osc.start(t);
            osc.stop(t + 1.4);
        }
    });
}
