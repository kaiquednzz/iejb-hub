// A chama do logo da IEJB como elemento de interface (redesign v2).
// Aparece: no avatar de quem toca nos próximos 7 dias, ao puxar para
// atualizar, no "dia de culto" e na comemoração. Duas camadas (fora e
// dentro) que tremulam em ritmos diferentes, só com transform (GPU).
import { hojeEmBrasilia, diasEntre } from './datas.js';

const NS = 'http://www.w3.org/2000/svg';
const FORA = 'M12 1.8c.9 3.6 6 5.9 6 11.6a6 6 0 0 1-12 0c0-3 1.8-5 2.9-6 .1 2 1.1 3.2 2.1 3.5-.4-3.5.4-6.7 1-9.1z';
const DENTRO = 'M12 11.6c1.2 1.3 2.6 2.4 2.6 4.4a2.6 2.6 0 0 1-5.2 0c0-1.4.9-2.6 2.6-4.4z';

export function chama(classe = '') {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', `chama ${classe}`.trim());
    for (const [d, c] of [[FORA, 'chama-fora'], [DENTRO, 'chama-dentro']]) {
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', d);
        p.setAttribute('class', c);
        svg.append(p);
    }
    return svg;
}

// "Toca nos próximos 7 dias": guardado quando o Início ou a Agenda descobrem
// a próxima escala, para o cabeçalho acender a chama sem consultar o banco.
const CHAVE = 'iejb-proxima-escala';
export function marcarEscalado(data) {
    try {
        if (data) localStorage.setItem(CHAVE, data);
        else localStorage.removeItem(CHAVE);
    } catch { /* modo privado: só não lembra */ }
    document.querySelectorAll('.cabecalho-conta').forEach((a) => acenderNoAvatar(a));
}
export function escaladoEmBreve() {
    let data = null;
    try { data = localStorage.getItem(CHAVE); } catch { /* idem */ }
    if (!data) return false;
    const dias = diasEntre(hojeEmBrasilia(), data);
    return dias >= 0 && dias <= 6;
}
export function acenderNoAvatar(lugar) {
    const tem = lugar.querySelector('.chama-avatar');
    if (escaladoEmBreve() && !tem) {
        lugar.append(chama('chama-avatar'));
        lugar.setAttribute('aria-label', 'Você: sua conta. Você toca nesta semana');
    } else if (!escaladoEmBreve() && tem) {
        tem.remove();
        lugar.setAttribute('aria-label', 'Você: sua conta');
    }
}
