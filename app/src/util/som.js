// Som de entrada (D51): um "plim" curto e baixo, feito na hora pelo Web Audio
// (sem arquivo para baixar). Duas notas em quinta, com cauda de sino.
//
// Por que só ao ENTRAR (tocar em "Entrar") e não ao abrir o app: navegador
// nenhum deixa uma página tocar som sem um toque da pessoa antes. No iPhone o
// som também respeita a chave do silencioso: no culto, com o celular no
// silencioso, não toca.
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
