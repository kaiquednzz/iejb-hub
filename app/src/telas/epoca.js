// Datas especiais no Início (D79): um cartão com um desenho da época, um
// versículo curto e, nos dias de festa, uma chuva de enfeites na primeira
// abertura do dia. Discreto de propósito: o resto do app não muda.
// As regras de data ficam em util/epocas.js.
import { h } from '../util/dom.js';
import { epocaAtual, primeiraVezHoje } from '../util/epocas.js';
import { hojeEmBrasilia } from '../util/datas.js';

// Cores dos desenhos: tons médios, que ficam bem no claro e no escuro
const R = '#C8322B', RD = '#8F0D0B', G = '#E2A93B', GL = '#F4D58A', V = '#3E8E5E', VL = '#7BBF8E',
    M = '#8A5A3C', ML = '#B98260', C = '#F6EBDB', PE = '#F1C9A5', P = '#F2A7A1', A = '#4F7CB8',
    S = '#9C8E80', SL = '#D3C8BC', ES = '#3A3432';

const TEXTOS = {
    advento: { titulo: 'Tempo de Advento', frase: 'Eis que a virgem conceberá e dará à luz um filho.', ref: 'Isaías 7:14' },
    natal: { titulo: 'Feliz Natal', frase: 'Hoje vos nasceu o Salvador, que é Cristo, o Senhor.', ref: 'Lucas 2:11', saudacao: 'Feliz Natal' },
    'ano-novo': { titulo: 'Feliz Ano Novo', frase: 'Eis que faço novas todas as coisas.', ref: 'Apocalipse 21:5', saudacao: 'Feliz Ano Novo' },
    'sexta-santa': { titulo: 'Sexta-feira Santa', frase: 'Ele foi ferido por causa das nossas transgressões.', ref: 'Isaías 53:5' },
    pascoa: { titulo: 'Feliz Páscoa', frase: 'Ele não está aqui, porque já ressuscitou.', ref: 'Mateus 28:6', saudacao: 'Feliz Páscoa' },
    pentecostes: { titulo: 'Pentecostes', frase: 'E todos foram cheios do Espírito Santo.', ref: 'Atos 2:4' },
    maes: { titulo: 'Feliz Dia das Mães', frase: 'Levantam-se seus filhos e lhe chamam bem-aventurada.', ref: 'Provérbios 31:28' },
    pais: { titulo: 'Feliz Dia dos Pais', frase: 'Como um pai se compadece dos filhos, assim o Senhor se compadece dos que o temem.', ref: 'Salmos 103:13' },
    namorados: { titulo: 'Dia dos Namorados', frase: 'O amor é paciente, o amor é bondoso.', ref: '1 Coríntios 13:4' },
    pastor: { titulo: 'Dia do Pastor', frase: 'Eu sou o bom pastor.', ref: 'João 10:11' },
    reforma: { titulo: 'Dia da Reforma', frase: 'O justo viverá pela fé.', ref: 'Romanos 1:17' },
    aniversario: { titulo: 'Mês de aniversário da IEJB', frase: 'Até aqui nos ajudou o Senhor.', ref: '1 Samuel 7:12' },
};

// Quantas velas da coroa do Advento já estão acesas: uma por domingo do
// Advento que já chegou (o 1º é o 4º domingo antes do Natal)
function velasAcesas(hoje) {
    const ano = Number(hoje.slice(0, 4));
    const natal = new Date(Date.UTC(ano, 11, 25, 12));
    const domingoAntes = new Date(natal);
    domingoAntes.setUTCDate(25 - (natal.getUTCDay() || 7));
    let acesas = 0;
    for (let i = 3; i >= 0; i -= 1) {
        const d = new Date(domingoAntes);
        d.setUTCDate(d.getUTCDate() - i * 7);
        if (d.toISOString().slice(0, 10) <= hoje) acesas += 1;
    }
    return Math.max(1, acesas);
}

const chama = (x, y, s = 1, cor = R, miolo = G) =>
    `<g class="ep-chama" transform="translate(${x} ${y}) scale(${s})"><path d="M0 0c-5 0-8-4-8-8 0-6 5-9 6-15 2 4 1 7 4 9 1-3 3-4 3-7 3 4 3 8 3 13 0 5-3 8-8 8z" fill="${cor}"/><path d="M0-1c-2.5 0-4-2-4-4 0-3 2-4 3-7 1 2 1 4 2 5 1-1 1-2 2-3 1 2 1 3 1 5 0 2-2 4-4 4z" fill="${miolo}"/></g>`;

const DESENHOS = {
    advento: (hoje) => {
        const acesas = velasAcesas(hoje);
        const velas = [36, 52, 68, 84].map((x, i) => {
            const cor = i === 2 ? P : R;
            const acesa = i < acesas;
            return `<g class="ep-vela" style="--i:${i}"><rect x="${x - 4}" y="${acesa ? 38 : 40}" width="8" height="${acesa ? 26 : 24}" rx="2" fill="${cor}"/>${acesa ? chama(x, 37, 0.55) : `<line x1="${x}" y1="40" x2="${x}" y2="36" stroke="${ES}" stroke-width="1.5" stroke-linecap="round"/>`}</g>`;
        }).join('');
        return `<ellipse cx="60" cy="68" rx="40" ry="10" fill="none" stroke="${V}" stroke-width="9"/>
            <ellipse cx="60" cy="68" rx="40" ry="10" fill="none" stroke="${VL}" stroke-width="2" stroke-dasharray="3 7"/>
            ${velas}
            <circle cx="28" cy="72" r="3" fill="${R}"/><circle cx="92" cy="71" r="3" fill="${R}"/><circle cx="60" cy="79" r="3" fill="${R}"/>`;
    },
    natal: () => `
        <path class="ep-luz" d="M60 18 L38 56 L82 56 Z" fill="${GL}" opacity="0.22"/>
        <g class="ep-estrela"><path d="M60 4 L63 14 L73 17 L63 20 L60 30 L57 20 L47 17 L57 14 Z" fill="${G}"/></g>
        <circle class="ep-pisca" cx="30" cy="12" r="1.6" fill="${G}"/><circle class="ep-pisca" style="--i:2" cx="92" cy="20" r="1.4" fill="${G}"/><circle class="ep-pisca" style="--i:4" cx="100" cy="8" r="1" fill="${G}"/>
        <path d="M33 60 L44 86 M44 60 L32 86 M76 60 L88 86 M87 60 L75 86" stroke="${M}" stroke-width="4" stroke-linecap="round"/>
        <path d="M30 56 L90 56 L84 70 L36 70 Z" fill="${M}"/>
        <path d="M30 57 l4-6 3 5 4-7 3 6 4-5 3 6 4-7 3 6 4-6 3 7 4-6 3 5 4-7 3 6 4-5 3 6 Z" fill="${G}"/>
        <ellipse cx="65" cy="47" rx="21" ry="9.5" fill="${C}" stroke="${SL}" stroke-width="1"/>
        <path d="M56 39 Q60 47 56 55 M68 38 Q72 47 68 56 M78 40 Q81 47 78 54" stroke="${SL}" stroke-width="1.4" fill="none"/>
        <circle class="ep-aureola" cx="44" cy="43" r="12" fill="none" stroke="${G}" stroke-width="1.8"/>
        <circle cx="44" cy="43" r="8" fill="${PE}"/>
        <path d="M37 41 C38 35 46 33 51 38 C47 37 42 37 37 41 Z" fill="${C}"/>`,
    'ano-novo': (hoje) => {
        const ano = Number(hoje.slice(0, 4)) + (hoje.slice(5) === '12-31' ? 1 : 0);
        const fogo = (x, y, cor, i, n = 10) => `<g class="ep-fogo" style="--i:${i}" transform="translate(${x} ${y})">${Array.from({ length: n }, (_, k) => {
            const a = (k / n) * Math.PI * 2;
            return `<line x1="${(Math.cos(a) * 5).toFixed(1)}" y1="${(Math.sin(a) * 5).toFixed(1)}" x2="${(Math.cos(a) * 14).toFixed(1)}" y2="${(Math.sin(a) * 14).toFixed(1)}" stroke="${cor}" stroke-width="2.2" stroke-linecap="round"/>`;
        }).join('')}<circle r="2.2" fill="${cor}"/></g>`;
        return `${fogo(30, 26, R, 0)}${fogo(86, 20, G, 1, 12)}${fogo(60, 40, RD, 2, 8)}
            <text x="60" y="82" text-anchor="middle" font-family="Playfair Display, Georgia, serif" font-style="italic" font-weight="700" font-size="24" fill="${R}">${ano}</text>`;
    },
    'sexta-santa': () => `
        <path d="M8 84 Q60 52 112 84 Z" fill="currentColor" opacity="0.3"/>
        <g fill="currentColor"><rect x="57" y="22" width="6" height="46" rx="1"/><rect x="47" y="32" width="26" height="5" rx="1"/>
        <rect x="27.5" y="44" width="4" height="30" rx="1"/><rect x="21" y="50" width="17" height="3.5" rx="1"/>
        <rect x="88.5" y="44" width="4" height="30" rx="1"/><rect x="82" y="50" width="17" height="3.5" rx="1"/></g>`,
    pascoa: () => `
        <g class="ep-sol"><circle cx="86" cy="40" r="13" fill="${G}"/>
        ${Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2; return `<line x1="${(86 + Math.cos(a) * 17).toFixed(1)}" y1="${(40 + Math.sin(a) * 17).toFixed(1)}" x2="${(86 + Math.cos(a) * 23).toFixed(1)}" y2="${(40 + Math.sin(a) * 23).toFixed(1)}" stroke="${G}" stroke-width="2.4" stroke-linecap="round"/>`; }).join('')}</g>
        <path d="M6 86 C10 50 30 34 52 34 C74 34 90 52 92 86 Z" fill="${S}"/>
        <path d="M34 86 L34 66 C34 54 42 48 50 48 C58 48 66 54 66 66 L66 86 Z" fill="${ES}"/>
        <g class="ep-pedra"><circle cx="86" cy="72" r="14" fill="${SL}" stroke="${S}" stroke-width="2"/><path d="M80 66 Q86 70 82 78" stroke="${S}" stroke-width="1.5" fill="none"/></g>
        <path d="M4 86 L116 86" stroke="${V}" stroke-width="4" stroke-linecap="round"/>
        <g class="ep-flor"><line x1="20" y1="86" x2="20" y2="76" stroke="${V}" stroke-width="2"/><circle cx="20" cy="74" r="3.2" fill="${C}"/><circle cx="20" cy="74" r="1.3" fill="${G}"/></g>
        <g class="ep-flor" style="--i:1"><line x1="106" y1="86" x2="106" y2="78" stroke="${V}" stroke-width="2"/><circle cx="106" cy="76" r="3" fill="${P}"/><circle cx="106" cy="76" r="1.2" fill="${G}"/></g>`,
    pentecostes: () => `
        <g class="ep-pomba">
            <path d="M32 40 L16 33 L21 41 L14 47 L32 45 Z" fill="#FFFFFF" stroke="${SL}" stroke-width="1"/>
            <path d="M28 41 C33 32 48 28 62 30 C70 31 76 34 82 30 C88 32 88 38 82 41 C74 47 58 49 46 47 C38 46 32 44 28 41 Z" fill="#FFFFFF" stroke="${SL}" stroke-width="1"/>
            <circle cx="84" cy="32" r="7" fill="#FFFFFF" stroke="${SL}" stroke-width="1"/>
            <path d="M90 31 L97 33 L90 35 Z" fill="${G}"/><circle cx="86" cy="30.5" r="1.3" fill="${ES}"/>
            <path d="M46 32 C46 18 56 7 74 4 C68 12 66 22 67 31 C60 30 52 30 46 32 Z" fill="${C}" stroke="${SL}" stroke-width="1"/>
            <path d="M54 26 C57 20 61 16 66 13 M52 30 C55 25 59 22 64 20" stroke="${SL}" stroke-width="1.2" fill="none"/>
        </g>
        ${chama(34, 82, 0.9)}${chama(60, 80, 1.05, RD, R)}${chama(86, 82, 0.9)}`,
    maes: () => `
        <g class="ep-flor"><line x1="60" y1="64" x2="46" y2="30" stroke="${V}" stroke-width="2.4"/>${flor(46, 28, R)}</g>
        <g class="ep-flor" style="--i:1"><line x1="60" y1="64" x2="60" y2="22" stroke="${V}" stroke-width="2.4"/>${flor(60, 20, P)}</g>
        <g class="ep-flor" style="--i:2"><line x1="60" y1="64" x2="74" y2="30" stroke="${V}" stroke-width="2.4"/>${flor(74, 28, R)}</g>
        <path d="M44 50 L76 50 L64 84 L56 84 Z" fill="${C}" stroke="${SL}" stroke-width="1"/>
        <path d="M54 62 C48 56 46 66 52 66 L56 64 M66 62 C72 56 74 66 68 66 L64 64" stroke="${R}" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="60" cy="64" r="3" fill="${R}"/>`,
    pais: () => `
        <path d="M54 14 L66 14 L64 22 L56 22 Z" fill="${RD}"/>
        <path class="ep-gravata" d="M56 22 L64 22 L72 64 L60 78 L48 64 Z" fill="${R}"/>
        <path d="M52 40 L68 34 M50 52 L70 44 M50 62 L71 54" stroke="${RD}" stroke-width="3" opacity="0.5"/>
        <g class="ep-coracao" transform="translate(88 34)">${coracao(0, 0, 0.6, P)}</g>`,
    namorados: () => `
        <g class="ep-coracao">${coracao(48, 46, 1.25, R)}</g>
        <g class="ep-coracao" style="--i:1">${coracao(72, 52, 1, P)}</g>
        <g class="ep-sobe">${coracao(30, 24, 0.35, P)}</g><g class="ep-sobe" style="--i:2">${coracao(92, 20, 0.3, R)}</g><g class="ep-sobe" style="--i:3">${coracao(98, 46, 0.25, P)}</g>`,
    pastor: () => `
        <path class="ep-cajado" d="M30 86 L30 28 C30 14 48 12 50 24 C51 30 46 32 44 28" stroke="${M}" stroke-width="5" fill="none" stroke-linecap="round"/>
        <g class="ep-ovelha">
            <g fill="${C}" stroke="${SL}" stroke-width="1"><circle cx="64" cy="58" r="9"/><circle cx="74" cy="54" r="10"/><circle cx="86" cy="58" r="9"/><circle cx="70" cy="66" r="9"/><circle cx="82" cy="66" r="9"/></g>
            <rect x="66" y="70" width="4" height="12" rx="2" fill="${ES}"/><rect x="80" y="70" width="4" height="12" rx="2" fill="${ES}"/>
            <ellipse cx="96" cy="56" rx="7" ry="8.5" fill="${ES}"/><ellipse cx="92" cy="50" rx="4" ry="2" fill="${ES}" transform="rotate(-30 92 50)"/>
            <circle cx="98" cy="54" r="1.3" fill="#FFFFFF"/>
        </g>`,
    reforma: () => `
        <circle cx="60" cy="46" r="38" fill="${A}"/><circle cx="60" cy="46" r="38" fill="none" stroke="${G}" stroke-width="4"/>
        <g class="ep-rosa">${Array.from({ length: 5 }, (_, k) => { const a = (k / 5) * Math.PI * 2 - Math.PI / 2; return `<circle cx="${(60 + Math.cos(a) * 15).toFixed(1)}" cy="${(46 + Math.sin(a) * 15).toFixed(1)}" r="13" fill="#FFFFFF"/>`; }).join('')}</g>
        ${coracao(60, 48, 0.95, R)}
        <rect x="58" y="34" width="4" height="22" fill="${ES}"/><rect x="52" y="40" width="16" height="4" fill="${ES}"/>`,
    aniversario: () => `
        <rect x="30" y="50" width="60" height="30" rx="6" fill="${C}"/>
        <path d="M30 56 C30 50 34 48 40 48 L80 48 C86 48 90 50 90 56 L90 58 C86 58 86 64 82 64 C78 64 78 58 74 58 C70 58 70 66 66 66 C62 66 62 58 58 58 C54 58 54 64 50 64 C46 64 46 58 42 58 C38 58 38 62 34 62 C31 62 30 60 30 58 Z" fill="${R}"/>
        <rect x="40" y="34" width="40" height="16" rx="4" fill="${C}"/>
        <path d="M40 38 C40 35 42 34 44 34 L76 34 C78 34 80 35 80 38 L80 40 C77 40 77 44 74 44 C71 44 71 40 68 40 C65 40 65 45 62 45 C59 45 59 40 56 40 C53 40 53 44 50 44 C47 44 47 40 44 40 C42 40 40 41 40 40 Z" fill="${P}"/>
        <rect x="58" y="20" width="4" height="14" rx="1" fill="${G}"/>
        ${chama(60, 20, 0.6)}
        <g class="ep-confete"><rect x="18" y="22" width="4" height="8" rx="1" fill="${G}" transform="rotate(20 20 26)"/><circle cx="100" cy="28" r="2.5" fill="${R}"/><rect x="96" y="56" width="4" height="8" rx="1" fill="${P}" transform="rotate(-25 98 60)"/><circle cx="20" cy="60" r="2" fill="${P}"/></g>`,
};
function flor(x, y, cor) {
    return Array.from({ length: 6 }, (_, k) => { const a = (k / 6) * Math.PI * 2; return `<circle cx="${(x + Math.cos(a) * 5).toFixed(1)}" cy="${(y + Math.sin(a) * 5).toFixed(1)}" r="4" fill="${cor}"/>`; }).join('')
        + `<circle cx="${x}" cy="${y}" r="3" fill="${G}"/>`;
}
function coracao(x, y, s, cor) {
    return `<path transform="translate(${x} ${y}) scale(${s})" d="M0 14 C-14 4 -18 -4 -14 -10 C-10 -16 -2 -14 0 -8 C2 -14 10 -16 14 -10 C18 -4 14 4 0 14 Z" fill="${cor}"/>`;
}

// Cada desenho é SVG escrito aqui mesmo (nada de arquivo de imagem) e só
// usa atributos de apresentação: a CSP do app não deixa estilo inline em
// atributo, então o --i das animações é passado pelo JS depois (abaixo).
function desenho(id, hoje) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 120 90');
    svg.setAttribute('class', `epoca-desenho epoca-${id}`);
    svg.setAttribute('aria-hidden', 'true');
    const html = DESENHOS[id](hoje).replace(/ style="--i:(\d+)"/g, ' data-i="$1"');
    svg.innerHTML = html;
    svg.querySelectorAll('[data-i]').forEach((el) => el.style.setProperty('--i', el.dataset.i));
    return svg;
}

export function saudacaoDaEpoca() {
    const epoca = epocaAtual();
    if (!epoca) return null;
    const hoje = hojeEmBrasilia();
    // Só no dia em si (Natal é dia 25; Ano Novo, dia 1º), não na época toda
    if (epoca.id === 'natal' && !hoje.endsWith('-12-25') && !new URLSearchParams(location.search).get('epoca')) return null;
    if (epoca.id === 'ano-novo' && !hoje.endsWith('-01-01') && !new URLSearchParams(location.search).get('epoca')) return null;
    return TEXTOS[epoca.id]?.saudacao ?? null;
}

export function blocoEpoca() {
    const epoca = epocaAtual();
    if (!epoca || !DESENHOS[epoca.id]) return null;
    const hoje = hojeEmBrasilia();
    const t = TEXTOS[epoca.id];
    const cartao = h('section', { class: `epoca epoca-tom-${epoca.sobria ? 'sobrio' : 'festa'}`, 'aria-label': t.titulo },
        desenho(epoca.id, hoje),
        h('div', { class: 'epoca-textos' },
            h('p', { class: 'epoca-titulo' }, t.titulo),
            h('p', { class: 'epoca-frase' }, t.frase),
            h('p', { class: 'epoca-ref' }, t.ref)));
    if (epoca.festa && primeiraVezHoje(epoca.id)) requestAnimationFrame(() => chuva(epoca.id));
    return cartao;
}

// Chuva de enfeites: ~2,5 s, uma vez por dia, só transform/opacity. Some sozinha.
const PECAS_DA_CHUVA = {
    natal: ['estrela'], 'ano-novo': ['confete', 'fita'], pascoa: ['petala'], pentecostes: ['chaminha'], aniversario: ['confete', 'fita'],
};
const CORES_DA_CHUVA = {
    natal: [G, GL, '#FFFFFF'], 'ano-novo': [R, G, P, '#FFFFFF'], pascoa: [P, C, GL], pentecostes: [R, G], aniversario: [R, G, P, C],
};
function chuva(id) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const formas = PECAS_DA_CHUVA[id] ?? ['confete'];
    const cores = CORES_DA_CHUVA[id] ?? [R, G];
    const camada = h('div', { class: 'epoca-chuva', 'aria-hidden': 'true' });
    for (let i = 0; i < 26; i += 1) {
        const peca = h('span', { class: `epoca-peca peca-${formas[i % formas.length]}` });
        peca.style.setProperty('--x', `${Math.random() * 100}vw`);
        peca.style.setProperty('--deriva', `${(Math.random() * 60 - 30).toFixed(0)}px`);
        peca.style.setProperty('--giro', `${(Math.random() * 540 - 270).toFixed(0)}deg`);
        peca.style.setProperty('--atraso', `${(Math.random() * 0.9).toFixed(2)}s`);
        peca.style.setProperty('--dur', `${(1.8 + Math.random() * 1.1).toFixed(2)}s`);
        peca.style.setProperty('--cor', cores[i % cores.length]);
        camada.append(peca);
    }
    document.body.append(camada);
    setTimeout(() => camada.remove(), 3400);
}
