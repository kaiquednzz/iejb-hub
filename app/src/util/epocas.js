// Datas especiais (D79): o app se veste para a época, sem ninguém cadastrar.
// Datas de igreja, não de comércio. A Páscoa muda todo ano (conta abaixo) e
// arrasta a Sexta-feira Santa e o Pentecostes. Uma época por vez: a lista
// está em ordem de prioridade (a primeira que valer, ganha).
//
// Para ver uma época fora da data: abra o app com ?epoca=natal (ou outra).
import { hojeEmBrasilia } from './datas.js';

const CHAVE_DESLIGADO = 'iejb-enfeites-desligados';

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano)
export function domingoDePascoa(ano) {
    const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31);
    const dia = ((h + l - 7 * m + 114) % 31) + 1;
    return iso(ano, mes, dia);
}

const iso = (ano, mes, dia) => `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
function somar(dataISO, dias) {
    const d = new Date(`${dataISO}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
}
// n-ésimo domingo de um mês (2º domingo de maio = Dia das Mães)
function enesimoDomingo(ano, mes, n) {
    const primeiro = new Date(Date.UTC(ano, mes - 1, 1, 12));
    const ate = (7 - primeiro.getUTCDay()) % 7;
    return iso(ano, mes, 1 + ate + (n - 1) * 7);
}

// Cada época: de/até (inclusive), se é dia de festa (chuva de enfeites na
// primeira abertura do dia) e o tom (sóbrio: sem festa nenhuma)
function epocasDoAno(ano) {
    const pascoa = domingoDePascoa(ano);
    const maes = enesimoDomingo(ano, 5, 2);
    const pais = enesimoDomingo(ano, 8, 2);
    const pastor = enesimoDomingo(ano, 6, 2);
    return [
        { id: 'sexta-santa', de: somar(pascoa, -2), ate: somar(pascoa, -1), sobria: true },
        { id: 'pascoa', de: pascoa, ate: somar(pascoa, 1), festa: true },
        { id: 'pentecostes', de: somar(pascoa, 48), ate: somar(pascoa, 49), festa: true },
        { id: 'natal', de: iso(ano, 12, 24), ate: iso(ano, 12, 26), festa: true },
        { id: 'ano-novo', de: iso(ano, 12, 31), ate: iso(ano, 12, 31), festa: true },
        { id: 'ano-novo', de: iso(ano, 1, 1), ate: iso(ano, 1, 2), festa: true },
        { id: 'maes', de: somar(maes, -1), ate: maes },
        { id: 'pais', de: somar(pais, -1), ate: pais },
        { id: 'pastor', de: somar(pastor, -1), ate: pastor },
        { id: 'namorados', de: iso(ano, 6, 12), ate: iso(ano, 6, 12) },
        { id: 'reforma', de: iso(ano, 10, 31), ate: iso(ano, 10, 31) },
        { id: 'advento', de: iso(ano, 12, 1), ate: iso(ano, 12, 23) },
        // O mês de aniversário da IEJB é julho: o mês inteiro, bem discreto
        { id: 'aniversario', de: iso(ano, 7, 1), ate: iso(ano, 7, 31) },
    ];
}

export function epocaDe(dataISO) {
    const ano = Number(dataISO.slice(0, 4));
    return epocasDoAno(ano).find((e) => dataISO >= e.de && dataISO <= e.ate) ?? null;
}

export function enfeitesLigados() {
    try { return localStorage.getItem(CHAVE_DESLIGADO) !== '1'; } catch { return true; }
}
export function ligarEnfeites(ligado) {
    try { localStorage.setItem(CHAVE_DESLIGADO, ligado ? '0' : '1'); } catch { /* vale nesta sessão */ }
}

// A época de agora (ou a de teste, ?epoca=...), se os enfeites estão ligados
export function epocaAtual() {
    if (!enfeitesLigados()) return null;
    const teste = new URLSearchParams(location.search).get('epoca');
    if (teste) {
        const todas = epocasDoAno(2026);
        return todas.find((e) => e.id === teste) ?? null;
    }
    return epocaDe(hojeEmBrasilia());
}

// A chuva de enfeites roda uma vez por dia por aparelho
export function primeiraVezHoje(id) {
    const chave = `iejb-epoca-vista-${id}`;
    const hoje = hojeEmBrasilia();
    try {
        if (localStorage.getItem(chave) === hoje) return false;
        localStorage.setItem(chave, hoje);
    } catch { /* sem storage: mostra */ }
    return true;
}
