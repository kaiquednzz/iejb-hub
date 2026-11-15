// Testes do util/chordpro.js. Rodar: node app/src/util/chordpro.test.mjs
// (letra de exemplo inventada)
import assert from 'node:assert/strict';
import {
    eAcorde, distancia, tomMovido, transporAcorde, lerChordPro, emPalavras,
    deColado, paraAcordesEmCima, pareceChordPro,
} from './chordpro.js';

let ok = 0;
const teste = (nome, fn) => { fn(); ok++; console.log(`ok  ${nome}`); };

teste('reconhece acordes comuns de cifra brasileira', () => {
    for (const a of ['G', 'Em', 'D/F#', 'C9', 'Am7', 'G7M', 'F#m7(b5)', 'A7(4)', 'E7(9)', 'Bb', 'Ebm', 'Dsus4', 'C#m7', 'G/B', 'Bº', 'C7M(9)', 'A4', 'D2', 'Gm6', 'E5']) {
        assert.ok(eAcorde(a), a);
    }
});
teste('não confunde palavra com acorde', () => {
    for (const p of ['Dia', 'Deus', 'Bom', 'Cristo', 'Amor', 'Glória', 'E,', 'Ao', 'Fé', 'Ba']) assert.ok(!eAcorde(p), p);
});
teste('distância entre tons pelo caminho curto', () => {
    assert.equal(distancia('G', 'A'), 2);
    assert.equal(distancia('G', 'E'), -3);
    assert.equal(distancia('C', 'F#'), 6);
    assert.equal(distancia('Em', 'Gm'), 3);
});
teste('tom movido mantém menor e escolhe bemol ou sustenido', () => {
    assert.equal(tomMovido('G', 3), 'Bb');
    assert.equal(tomMovido('G', 4), 'B');
    assert.equal(tomMovido('C', 1), 'Db');
    assert.equal(tomMovido('E', -1), 'Eb');
    assert.equal(tomMovido('Em', 1), 'Fm');
    assert.equal(tomMovido('Am', 1), 'Bbm');
    assert.equal(tomMovido('D', 4), 'F#');
});
teste('transpõe acorde com baixo e extensões', () => {
    assert.equal(transporAcorde('D/F#', 2, 'A'), 'E/G#');
    assert.equal(transporAcorde('F#m7(b5)', -2, 'C'), 'Em7(b5)');
    assert.equal(transporAcorde('G7M', 3, 'Bb'), 'Bb7M');
    assert.equal(transporAcorde('C9', 0, 'C'), 'C9');
    assert.equal(transporAcorde('A#m', 0, 'C'), 'A#m');
});

const COLADO = `Canção de Teste
Fulano de Tal
Tom: G

[Intro] G  D/F#  Em  C

[Primeira Parte]

G              D/F#
  Quando o dia amanhece
Em             C
  Eu vou cantar de novo
G         D
Tudo é graça, tudo é luz

[Refrão]

C        G      D
Santo, santo, santo
    Em    C   D   G
Pra sempre cantarei

E|-----3-----|
B|---3---3---|
G|-0-------0-|

[Final] C  D  G
`;

teste('cola do Cifra Club e vira ChordPro', () => {
    const { chordpro, tom } = deColado(COLADO);
    assert.equal(tom, 'G');
    assert.ok(chordpro.includes('{comment: Intro}'));
    assert.ok(chordpro.includes('[G] [D/F#] [Em] [C]'));
    assert.ok(chordpro.includes('{comment: Refrão}'));
    assert.ok(chordpro.includes('[G]  Quando o dia [D/F#]amanhece'), chordpro);
    assert.ok(chordpro.includes('[C]Santo, sa[G]nto, sa[D]nto'), chordpro);
    assert.ok(chordpro.includes('{start_of_tab}') && chordpro.includes('{end_of_tab}'));
    assert.ok(!chordpro.includes('Tom: G'));
});
teste('acorde depois do fim da letra não some', () => {
    const { chordpro } = deColado('G       D        A\nCurto');
    assert.equal(chordpro, '[G]Curto   [D]         [A]');
});
teste('ChordPro colado direto é aceito como está', () => {
    const cp = '{title: X}\n{key: A}\n[A]Uma [E]linha de [D]teste';
    assert.ok(pareceChordPro(cp));
    assert.deepEqual(deColado(cp), { chordpro: cp, tom: 'A' });
});
teste('lê ChordPro em linhas e partes', () => {
    const c = lerChordPro('{title: X}\n{key: G}\n{soc}\n[G]Santo, [D]santo\n{eoc}\n\nfim');
    assert.equal(c.titulo, 'X');
    assert.equal(c.tom, 'G');
    assert.equal(c.linhas[0].tipo, 'secao');
    assert.deepEqual(c.linhas[1].partes, [{ acorde: 'G', texto: 'Santo, ' }, { acorde: 'D', texto: 'santo' }]);
    assert.equal(c.linhas[1].refrao, true);
    assert.equal(c.linhas.at(-1).refrao, false);
});
teste('em palavras: o acorde fica com a primeira palavra', () => {
    assert.deepEqual(emPalavras([{ acorde: 'G', texto: 'Quando o dia ' }]), [
        { acorde: 'G', texto: 'Quando ' }, { acorde: null, texto: 'o ' }, { acorde: null, texto: 'dia ' },
    ]);
});
teste('ida e volta: colar, converter, editar de novo', () => {
    const { chordpro } = deColado(COLADO);
    const deVolta = paraAcordesEmCima(chordpro);
    assert.ok(deVolta.includes('[Refrão]'));
    // Converter de novo dá o mesmo ChordPro (o líder edita sem estragar nada)
    assert.equal(deColado(deVolta).chordpro, chordpro);
});

console.log(`\n${ok} testes passaram`);
