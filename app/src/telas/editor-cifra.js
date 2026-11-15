// Editor de cifra (D38), para quem edita música (admin e líderes).
//
// O líder cola do jeito que copia do Cifra Club: acordes numa linha, letra na
// de baixo, "[Refrão]", "Tom: G". A prévia mostra na hora como vai ficar.
// Ao salvar, util/chordpro.js converte para ChordPro, que é o que vai para o
// banco. Para editar de novo, a cifra volta para o formato de acordes em cima:
// ninguém precisa aprender ChordPro (mas quem colar ChordPro também é aceito).
import { h, icone, comCarregando } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { abrirFolha, confirmar, avisar } from '../util/folha.js';
import { mensagemDoBanco } from '../util/erros.js';
import { deColado, paraAcordesEmCima, raiz } from '../util/chordpro.js';
import { termoDeBusca, TONS } from '../util/musica.js';
import { caixaDeAviso } from './moldura.js';
import { desenharCifra } from './cifra.js';

export async function abrirEditorCifra(musica, aoSalvar) {
    const { data, error } = await supabase.from('musica')
        .select('id, titulo, artista, cifra, cifra_tom').eq('id', musica.id).maybeSingle();
    if (error || !data) return avisar(mensagemDoBanco(error, 'Não deu para abrir a música.'));

    const aviso = caixaDeAviso();
    let tom = data.cifra_tom;
    let tomEscolhidoAMao = Boolean(data.cifra_tom);
    let menorAtivo = /m$/.test(tom ?? '');

    const texto = h('textarea', {
        id: 'campo-cifra', class: 'editor-cifra-texto', rows: 14, spellcheck: 'false',
        autocapitalize: 'off', autocomplete: 'off', wrap: 'off',
        placeholder: 'Cole aqui a cifra (acordes em cima da letra, do jeito que vem do Cifra Club).',
    });
    texto.value = data.cifra ? paraAcordesEmCima(data.cifra) : '';

    const cifraClub = h('a', {
        class: 'link-discreto', target: '_blank', rel: 'noopener noreferrer',
        href: `https://www.cifraclub.com.br/?q=${encodeURIComponent(termoDeBusca(data))}`,
    }, icone('externo', 'icone icone-p'), 'Procurar no Cifra Club');

    const fichasTom = h('div', { class: 'fichas fichas-tom' });
    const menor = h('button', { type: 'button', class: 'ficha', 'aria-pressed': String(menorAtivo) }, 'menor (m)');
    const previa = h('div', { class: 'editor-cifra-previa', 'aria-label': 'Prévia da cifra' });
    const salvar = h('button', { type: 'button', class: 'botao-principal botao-largo' }, 'Salvar cifra');
    const tirar = data.cifra && h('button', { type: 'button', class: 'botao-texto-perigo' }, 'Tirar a cifra desta música');

    let espera = null;
    texto.addEventListener('input', () => {
        clearTimeout(espera);
        espera = setTimeout(atualizar, 250);   // não converte a cada tecla
    });
    menor.addEventListener('click', () => {
        menorAtivo = !menorAtivo;
        menor.setAttribute('aria-pressed', String(menorAtivo));
        if (tom) tom = tom.replace(/m$/, '') + (menorAtivo ? 'm' : '');
        tomEscolhidoAMao = true;
        desenharTons();
    });
    salvar.addEventListener('click', () => comCarregando(salvar, enviar));
    tirar?.addEventListener('click', apagar);

    desenharTons();
    atualizar();
    const folha = abrirFolha({
        titulo: `Cifra · ${data.titulo}`,
        conteudo: h('div', { class: 'form' },
            h('p', { class: 'folha-texto folha-texto-pequeno' },
                'Abra a cifra no Cifra Club, escolha a versão que o grupo usa, copie tudo e cole aqui. Pode colar com o título e o "Tom:" junto.'),
            cifraClub,
            h('div', { class: 'campo' }, h('label', { for: 'campo-cifra' }, 'Cifra'), texto),
            h('fieldset', { class: 'campo' },
                h('legend', null, 'Tom em que essa cifra está escrita'),
                h('p', { class: 'campo-dica' }, 'Achei sozinho pelo "Tom:" ou pelo primeiro acorde; confira. No culto, a cifra abre já transposta para o tom do repertório.'),
                fichasTom, menor),
            h('section', { class: 'bloco' }, h('h3', { class: 'bloco-titulo' }, 'Como fica'), previa),
            aviso.elemento,
            salvar,
            tirar && h('div', { class: 'bloco bloco-final' }, tirar),
        ),
    });

    function desenharTons() {
        const raizAtual = tom?.replace(/m$/, '');
        fichasTom.replaceChildren(...TONS.map((t) => {
            const f = h('button', { type: 'button', class: 'ficha', 'aria-pressed': String(raizAtual === t) }, t + (menorAtivo ? 'm' : ''));
            f.addEventListener('click', () => {
                tom = t + (menorAtivo ? 'm' : '');
                tomEscolhidoAMao = true;
                desenharTons();
            });
            return f;
        }));
    }

    // Converte o que está na caixa, acha o tom (se o líder ainda não escolheu)
    // e redesenha a prévia
    function converter() {
        const semCabecalho = tirarCabecalho(texto.value, data);
        return deColado(semCabecalho);
    }
    function atualizar() {
        const { chordpro, tom: achado } = converter();
        if (!tomEscolhidoAMao && achado && raiz(achado) != null) {
            tom = normalizarTom(achado);
            menorAtivo = /m$/.test(tom);
            menor.setAttribute('aria-pressed', String(menorAtivo));
            desenharTons();
        }
        previa.replaceChildren(...(chordpro ? [desenharCifra(chordpro)] : []));
    }

    async function enviar() {
        aviso.limpar();
        const { chordpro } = converter();
        if (!chordpro) return aviso.mostrar('Cole a cifra antes de salvar.');
        if (!/\[[^\]]+\]/.test(chordpro)) return aviso.mostrar('Não achei nenhum acorde. Confira se colou a cifra (e não só a letra).');
        if (!tom) return aviso.mostrar('Escolha o tom em que a cifra está escrita.');
        if (chordpro.length > 30000) return aviso.mostrar('A cifra ficou grande demais. Tire partes repetidas.');
        const { error: erro } = await supabase.from('musica').update({ cifra: chordpro, cifra_tom: tom }).eq('id', data.id);
        if (erro) return aviso.mostrar(mensagemDoBanco(erro));
        folha.fechar();
        avisar('Cifra salva.');
        aoSalvar?.();
    }

    async function apagar() {
        const ok = await confirmar({
            titulo: 'Tirar a cifra?',
            texto: `A música continua no repertório; só a cifra de "${data.titulo}" sai.`,
            botao: 'Tirar', perigo: true,
        });
        if (!ok) return;
        const { error: erro } = await supabase.from('musica').update({ cifra: null, cifra_tom: null }).eq('id', data.id);
        if (erro) return aviso.mostrar(mensagemDoBanco(erro));
        folha.fechar();
        avisar('Cifra tirada.');
        aoSalvar?.();
    }
}

// Escreve a raiz como nos botões de tom do Hub (TONS: C#, Eb, F#, Ab, Bb).
// "Em7" achado no primeiro acorde vira "Em".
const GRAFIA = { 'A#': 'Bb', 'D#': 'Eb', 'G#': 'Ab', Gb: 'F#', Db: 'C#' };
function normalizarTom(tom) {
    const m = /^([A-G][#b]?)(m(?!aj))?/.exec(tom ?? '');
    return m ? (GRAFIA[m[1]] ?? m[1]) + (m[2] ? 'm' : '') : null;
}

// O Cifra Club cola o título e o artista no começo: se as primeiras linhas
// forem exatamente isso, saem (o Hub já mostra os dois)
function tirarCabecalho(texto, musica) {
    const igual = (a, b) => a && b && a.trim().toLowerCase() === b.trim().toLowerCase();
    const linhas = texto.split('\n');
    while (linhas.length && !linhas[0].trim()) linhas.shift();
    if (igual(linhas[0], musica.titulo)) linhas.shift();
    while (linhas.length && !linhas[0].trim()) linhas.shift();
    if (igual(linhas[0], musica.artista)) linhas.shift();
    return linhas.join('\n');
}

