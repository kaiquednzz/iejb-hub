// Cifras em ChordPro (o formato aberto de cifra: "[G]Bondade de [D]Deus").
//
// Por que ChordPro por baixo: o acorde fica preso à sílaba, então dá para
// transpor e quebrar a linha no celular sem o acorde "escorregar". E é um
// formato padrão: dá para exportar a cifra para outros apps.
//
// O líder não precisa conhecer o formato: ele cola do jeito que copia do
// Cifra Club (acordes numa linha, letra na de baixo) e deColado() converte.
// Para editar de novo, paraAcordesEmCima() devolve no formato de antes.
//
// Tudo aqui é função pura (sem tela), testada em util/chordpro.test.mjs.

// ---------------------------------------------------------------------------
// Acordes
// ---------------------------------------------------------------------------

// Raiz + sustenido/bemol, depois o "sabor" (m, 7, 7M, sus4, dim, (9), (b5)...)
// e o baixo opcional (/F#). É de propósito mais rígido que "qualquer coisa
// que começa com A-G": "Dia", "Deus", "Bom" não podem virar acorde.
const ACORDE = /^([A-G])([#b]?)((?:maj|min|dim|aug|sus|add|m|M|º|°|\+|-|[0-9]|\((?:[#b+\-]?[0-9]+M?[/,]?)+\)|[#b](?=[0-9]))*)(?:\/([A-G])([#b]?))?$/;

export const eAcorde = (t) => ACORDE.test(t);

const NOTAS_SUSTENIDO = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTAS_BEMOL = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const INDICE = {
    C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, 'E#': 5, F: 5,
    'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11,
};
// Grafia de costume de cada tom (é o que o músico espera ler): Bb e não A#,
// F# e não Gb, C#m e não Dbm. Os acordes seguem a grafia do tom de chegada.
const TONS_MAIORES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const TONS_MENORES = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];
const TONS_BEMOL = new Set([...TONS_MAIORES, ...TONS_MENORES].filter((t) => /^[A-G]b/.test(t) || ['F', 'Dm', 'Gm', 'Cm', 'Fm'].includes(t)));

// "Em", "F#m7", "Bb" -> índice da raiz (0 a 11); null se não for tom
export function raiz(tom) {
    const m = /^([A-G])([#b]?)/.exec(tom ?? '');
    return m ? INDICE[m[1] + m[2]] : null;
}

const menor = (tom) => /^[A-G][#b]?m(?!aj)/.test(tom ?? '');

// Quantos semitons de um tom para outro (−5 a +6, o caminho mais curto)
export function distancia(de, para) {
    const a = raiz(de);
    const b = raiz(para);
    if (a == null || b == null) return 0;
    let d = (b - a + 12) % 12;
    if (d > 6) d -= 12;
    return d;
}

// O tom que resulta de andar n semitons a partir de "tom" (mantém o menor)
export function tomMovido(tom, n) {
    const r = raiz(tom);
    if (r == null) return tom;
    return (menor(tom) ? TONS_MENORES : TONS_MAIORES)[(r + n + 120) % 12];
}

// Transpõe um acorde n semitons; "tomFinal" decide sustenido ou bemol
export function transporAcorde(acorde, n, tomFinal) {
    const m = ACORDE.exec(acorde);
    if (!m || n % 12 === 0) return acorde;
    const usarBemol = TONS_BEMOL.has(tomFinal);
    const notas = usarBemol ? NOTAS_BEMOL : NOTAS_SUSTENIDO;
    const mover = (nota) => notas[(INDICE[nota] + n + 120) % 12];
    return mover(m[1] + m[2]) + m[3] + (m[4] ? `/${mover(m[4] + (m[5] ?? ''))}` : '');
}

// ---------------------------------------------------------------------------
// ChordPro -> estrutura para desenhar
// ---------------------------------------------------------------------------
// Resultado: { titulo, artista, tom, linhas: [...] }, cada linha é
//   { tipo: 'vazia' } | { tipo: 'secao', texto } | { tipo: 'tab', texto }
//   | { tipo: 'letra', partes: [{ acorde, texto }], refrao }
const DIRETIVA = /^\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}$/i;
const SECAO_ABRE = { start_of_chorus: 'Refrão', soc: 'Refrão', start_of_verse: null, sov: null, start_of_bridge: 'Ponte', sob: 'Ponte' };
const SECAO_FECHA = new Set(['end_of_chorus', 'eoc', 'end_of_verse', 'eov', 'end_of_bridge', 'eob']);

export function lerChordPro(texto) {
    const cifra = { titulo: null, artista: null, tom: null, linhas: [] };
    let refrao = false;
    let tab = false;
    for (const bruta of String(texto ?? '').replace(/\r\n?/g, '\n').split('\n')) {
        const linha = bruta.replace(/\s+$/, '');
        const d = DIRETIVA.exec(linha.trim());
        if (d) {
            const nome = d[1].toLowerCase();
            const valor = d[2] ?? '';
            if (nome === 'title' || nome === 't') cifra.titulo = valor;
            else if (nome === 'artist' || nome === 'subtitle' || nome === 'st') cifra.artista = cifra.artista ?? valor;
            else if (nome === 'key') cifra.tom = valor;
            else if (nome === 'comment' || nome === 'c' || nome === 'comment_italic' || nome === 'ci') cifra.linhas.push({ tipo: 'secao', texto: valor });
            else if (nome in SECAO_ABRE) {
                refrao = nome.includes('chorus') || nome === 'soc';
                const rotulo = valor || SECAO_ABRE[nome];
                if (rotulo) cifra.linhas.push({ tipo: 'secao', texto: rotulo });
            } else if (SECAO_FECHA.has(nome)) refrao = false;
            else if (nome === 'start_of_tab' || nome === 'sot') tab = true;
            else if (nome === 'end_of_tab' || nome === 'eot') tab = false;
            continue;   // outras diretivas (capo, tempo...) não aparecem
        }
        if (tab) { cifra.linhas.push({ tipo: 'tab', texto: linha }); continue; }
        if (!linha.trim()) { cifra.linhas.push({ tipo: 'vazia' }); continue; }
        cifra.linhas.push({ tipo: 'letra', partes: partesDaLinha(linha), refrao });
    }
    // Sem linhas vazias sobrando no começo e no fim
    while (cifra.linhas[0]?.tipo === 'vazia') cifra.linhas.shift();
    while (cifra.linhas.at(-1)?.tipo === 'vazia') cifra.linhas.pop();
    return cifra;
}

// "[G]Bondade de [D]Deus" -> [{acorde:'G', texto:'Bondade de '}, {acorde:'D', texto:'Deus'}]
function partesDaLinha(linha) {
    const partes = [];
    const re = /\[([^\]]*)\]/g;
    let ultimo = 0;
    let acorde = null;
    let m;
    while ((m = re.exec(linha))) {
        const texto = linha.slice(ultimo, m.index);
        if (texto || acorde !== null) partes.push({ acorde, texto });
        acorde = m[1].trim();
        ultimo = re.lastIndex;
    }
    partes.push({ acorde, texto: linha.slice(ultimo) });
    return partes.filter((p, i) => i > 0 || p.acorde !== null || p.texto);
}

// Parte cada trecho em palavras: o acorde fica com a primeira, as outras viram
// trechos sem acorde. Assim a linha pode quebrar entre palavras no celular sem
// separar o acorde da sílaba dele.
export function emPalavras(partes) {
    const saida = [];
    for (const { acorde, texto } of partes) {
        const palavras = texto.match(/\S+\s*|\s+/g) ?? [''];
        palavras.forEach((p, i) => saida.push({ acorde: i === 0 ? acorde : null, texto: p }));
    }
    return saida;
}

// ---------------------------------------------------------------------------
// Colado do Cifra Club (acordes em cima) -> ChordPro
// ---------------------------------------------------------------------------
const TOKEN_NEUTRO = /^(\||\|\||-+|x?\d+x?|\(\d*x\)|\(x?\d+\)|\(|\)|%|\/|\.{2,})$/i;
const TAB = /^\s*[A-Ga-gEe]?\s*\|[-\d|hpbr/\\~xX.\s]*-[-\d|hpbr/\\~xX.\s]*\|?\s*$/;
const SECAO = /^\s*\[([^\]]+)\]\s*(.*)$/;
const TOM = /^\s*tom\s*:\s*([A-G][#b]?m?)\b/i;

// Linha só de acordes? (pode ter "|", "(2x)", "x2" no meio)
function linhaDeAcordes(linha) {
    const tokens = linha.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return false;
    let acordes = 0;
    for (const t of tokens) {
        if (eAcorde(t)) acordes++;
        else if (!TOKEN_NEUTRO.test(t)) return false;
    }
    return acordes > 0;
}

// Parece já ser ChordPro? (acorde entre colchetes no meio de letra, ou diretivas)
export function pareceChordPro(texto) {
    const t = String(texto ?? '');
    if (/^\s*\{[a-z_]+\s*(:[^}]*)?\}\s*$/im.test(t)) return true;
    const colchetes = t.match(/\[([^\]\n]+)\]/g) ?? [];
    const comAcorde = colchetes.filter((c) => eAcorde(c.slice(1, -1).trim()));
    return comAcorde.length >= 3 && /\S\[[^\]]+\]|\[[^\]]+\]\S/.test(t);
}

// Junta uma linha de acordes com a letra de baixo, pelas colunas
function juntar(acordes, letra) {
    const posicoes = [];
    const re = /\S+/g;
    let m;
    while ((m = re.exec(acordes))) posicoes.push({ col: m.index, txt: m[0] });
    let saida = letra.padEnd(Math.max(letra.length, (posicoes.at(-1)?.col ?? 0)), ' ');
    // Do fim para o começo: inserir não desloca as colunas que faltam
    for (const { col, txt } of posicoes.reverse()) {
        const marca = eAcorde(txt) ? `[${txt}]` : (TOKEN_NEUTRO.test(txt) ? '' : txt);
        if (marca) saida = saida.slice(0, col) + marca + saida.slice(col);
    }
    return saida.replace(/\s+$/, '');
}

const soAcordes = (linha) => linha.trim().split(/\s+/).map((t) => (eAcorde(t) ? `[${t}]` : t)).join(' ');

// Devolve { chordpro, tom } (tom achado na linha "Tom: G", se houver)
export function deColado(texto) {
    const bruto = String(texto ?? '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').replace(/ /g, ' ');
    if (pareceChordPro(bruto)) return { chordpro: bruto.trim(), tom: lerChordPro(bruto).tom };

    const linhas = bruto.split('\n').map((l) => l.replace(/\s+$/, ''));
    const saida = [];
    let tom = null;
    let emTab = false;
    for (let i = 0; i < linhas.length; i++) {
        const linha = linhas[i];
        const tomAqui = TOM.exec(linha);
        if (tomAqui) { tom = tom ?? tomAqui[1]; continue; }

        if (TAB.test(linha)) {
            if (!emTab) { saida.push('{start_of_tab}'); emTab = true; }
            saida.push(linha);
            continue;
        }
        if (emTab) { saida.push('{end_of_tab}'); emTab = false; }

        const secao = SECAO.exec(linha);
        if (secao && !eAcorde(secao[1].trim())) {
            saida.push(`{comment: ${secao[1].trim()}}`);
            const resto = secao[2];
            if (resto && linhaDeAcordes(resto)) saida.push(soAcordes(resto));
            else if (resto) saida.push(resto);
            continue;
        }
        if (linhaDeAcordes(linha)) {
            const proxima = linhas[i + 1];
            const proximaELetra = proxima != null && proxima.trim() && !linhaDeAcordes(proxima) &&
                !TAB.test(proxima) && !SECAO.exec(proxima) && !TOM.test(proxima);
            if (proximaELetra) {
                saida.push(juntar(linha, proxima));
                i++;
            } else {
                saida.push(soAcordes(linha));
            }
            continue;
        }
        saida.push(linha);
    }
    if (emTab) saida.push('{end_of_tab}');
    // Até uma linha vazia seguida: o Cifra Club cola com muitas
    const limpo = saida.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    return { chordpro: limpo, tom: tom ?? primeiroAcorde(limpo) };
}

function primeiroAcorde(chordpro) {
    const m = /\[([^\]]+)\]/.exec(chordpro);
    if (!m || !eAcorde(m[1])) return null;
    const r = /^([A-G][#b]?)(m(?!aj))?/.exec(m[1]);
    return r ? r[1] + (r[2] ?? '') : null;
}

// ---------------------------------------------------------------------------
// ChordPro -> acordes em cima (para editar de novo no formato conhecido)
// ---------------------------------------------------------------------------
export function paraAcordesEmCima(chordpro) {
    const saida = [];
    let tab = false;
    for (const bruta of String(chordpro ?? '').split('\n')) {
        const linha = bruta.replace(/\s+$/, '');
        const d = DIRETIVA.exec(linha.trim());
        if (d) {
            const nome = d[1].toLowerCase();
            if (nome === 'start_of_tab' || nome === 'sot') tab = true;
            else if (nome === 'end_of_tab' || nome === 'eot') tab = false;
            else if (['comment', 'c', 'comment_italic', 'ci'].includes(nome)) saida.push(`[${d[2] ?? ''}]`);
            else if (nome in SECAO_ABRE) saida.push(`[${d[2] || SECAO_ABRE[nome] || 'Parte'}]`);
            else if (nome === 'key') saida.push(`Tom: ${d[2] ?? ''}`);
            continue;
        }
        if (tab || !linha.includes('[')) { saida.push(linha); continue; }

        const partes = partesDaLinha(linha);
        let acordes = '';
        let letra = '';
        for (const { acorde, texto } of partes) {
            if (acorde) {
                // Acorde começa onde a letra está; se o anterior ainda não acabou, empurra
                const col = Math.max(letra.length, acordes.length ? acordes.length + 1 : 0);
                acordes = acordes.padEnd(col, ' ') + acorde;
                letra = letra.padEnd(col, ' ');
            }
            letra += texto;
        }
        saida.push(acordes.replace(/\s+$/, ''));
        if (letra.trim()) saida.push(letra.replace(/\s+$/, ''));
    }
    return saida.join('\n');
}
