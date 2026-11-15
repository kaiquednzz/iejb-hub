// Tela da cifra (D38): abre já no tom do culto e passa pelas músicas na
// ordem do repertório.
//
//   abrirCifras({ itens: [{ musica, tom }], inicio, titulo })
//     itens: só as músicas que têm cifra, na ordem do repertório
//     tom:   o tom do culto (repertorio_item.tom); sem ele, fica o da cifra
//
// A cifra vem da cópia no aparelho (instantâneo e funciona sem sinal) e é
// atualizada pela rede quando a música mudou. Ferramentas do músico: trocar o
// tom (+/−), tamanho da letra, "só letra" (para quem canta), rolagem
// automática e tela sempre acesa enquanto a cifra está aberta.
//
// É um <dialog> próprio, de tela inteira, e não uma folha: no ensaio a cifra
// precisa de todo o espaço da tela.
import { h, icone } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { lerChordPro, emPalavras, transporAcorde, distancia, tomMovido, raiz } from '../util/chordpro.js';
import { cifrasGuardadas, guardarCifras } from '../offline.js';

const PREF = 'iejb-hub:cifra-pref';
const TAMANHOS = [14, 16, 18, 20, 23, 26];
const VELOCIDADES = [12, 20, 30, 42, 56];   // pixels por segundo

function lerPref() {
    try { return { tamanho: 2, soLetra: false, velocidade: 1, ...JSON.parse(localStorage.getItem(PREF)) }; } catch { return { tamanho: 2, soLetra: false, velocidade: 1 }; }
}
function gravarPref(p) { try { localStorage.setItem(PREF, JSON.stringify(p)); } catch { /* sem armazenamento */ } }

// ---------------------------------------------------------------------------
// Desenho (usado também pela prévia do editor)
// ---------------------------------------------------------------------------
// n: semitons para transpor; tomFinal: decide sustenido ou bemol
export function desenharCifra(chordpro, n = 0, tomFinal = null) {
    const cifra = lerChordPro(chordpro);
    const linhas = cifra.linhas.map((linha) => {
        if (linha.tipo === 'vazia') return h('div', { class: 'cifra-vazia' });
        if (linha.tipo === 'secao') return h('p', { class: 'cifra-secao' }, linha.texto);
        if (linha.tipo === 'tab') return h('pre', { class: 'cifra-tab' }, linha.texto || ' ');

        const temAcorde = linha.partes.some((p) => p.acorde);
        const classe = `cifra-linha${linha.refrao ? ' cifra-refrao' : ''}`;
        if (!temAcorde) return h('p', { class: `${classe} cifra-sem-acorde` }, linha.partes.map((p) => p.texto).join(''));

        const soAcordes = linha.partes.every((p) => !p.texto.trim());
        return h('p', { class: `${classe}${soAcordes ? ' cifra-so-acordes' : ''}` },
            emPalavras(linha.partes).map(({ acorde, texto }) => h('span', { class: 'cifra-seg' },
                h('span', { class: 'cifra-ac' }, acorde ? transporAcorde(acorde, n, tomFinal) : ' '),
                h('span', { class: 'cifra-tx' }, texto || ' '))));
    });
    return h('div', { class: 'cifra-corpo' }, linhas);
}

// ---------------------------------------------------------------------------
// Buscar a cifra: cópia do aparelho primeiro, rede para atualizar
// ---------------------------------------------------------------------------
async function obterCifra(musica) {
    const guardada = cifrasGuardadas()[musica.id];
    if (guardada && guardada.atualizado_em === musica.atualizado_em) return guardada;
    const { data, error } = await supabase.from('musica')
        .select('id, cifra, cifra_tom, atualizado_em').eq('id', musica.id).maybeSingle();
    if (data?.cifra) return data;
    if (guardada) return guardada;   // sem rede: a cópia antiga ainda serve
    throw error ?? new Error('Essa música ainda não tem cifra.');
}

// ---------------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------------
export function abrirCifras({ itens, inicio = 0, titulo = '' }) {
    if (!itens.length) return;
    const pref = lerPref();
    let indice = inicio;
    let ajuste = 0;            // semitons além do tom do culto (só nesta abertura)
    let atual = null;          // { cifra, cifra_tom } da música na tela
    let rolando = false;
    let ultimoQuadro = 0;
    let travaTela = null;

    // --- Topo ---------------------------------------------------------------
    const fechar = h('button', { type: 'button', class: 'cifra-botao', 'aria-label': 'Fechar cifra' }, icone('fechar'));
    const nome = h('h2', { class: 'cifra-titulo' });
    const artista = h('p', { class: 'cifra-artista' });
    const posicao = h('p', { class: 'cifra-posicao' });

    // --- Ferramentas -------------------------------------------------------
    const menosTom = h('button', { type: 'button', class: 'cifra-botao', 'aria-label': 'Meio tom abaixo' }, icone('menos'));
    const maisTom = h('button', { type: 'button', class: 'cifra-botao', 'aria-label': 'Meio tom acima' }, icone('mais'));
    const tomTexto = h('span', { class: 'cifra-tom-atual', 'aria-live': 'polite' });
    const tomOrigem = h('span', { class: 'cifra-tom-origem' });
    const voltarTom = h('button', { type: 'button', class: 'cifra-voltar-tom', hidden: true }, 'Voltar ao tom do culto');
    const menor = h('button', { type: 'button', class: 'cifra-botao', 'aria-label': 'Letra menor' }, icone('texto', 'icone icone-p'));
    const maior = h('button', { type: 'button', class: 'cifra-botao', 'aria-label': 'Letra maior' }, icone('texto'));
    const soLetra = h('button', { type: 'button', class: 'cifra-chip', 'aria-pressed': String(pref.soLetra) }, 'Só letra');
    const rolar = h('button', { type: 'button', class: 'cifra-chip cifra-rolar', 'aria-pressed': 'false' }, icone('rolar', 'icone icone-p'), 'Rolar');
    const velocidade = h('button', { type: 'button', class: 'cifra-chip', 'aria-label': 'Velocidade da rolagem' });

    // --- Corpo e rodapé ----------------------------------------------------
    const corpo = h('div', { class: 'cifra-rolagem', tabindex: 0 });
    const anterior = h('button', { type: 'button', class: 'cifra-navegar' }, icone('seta', 'icone seta-esquerda'), h('span', { class: 'cifra-navegar-texto' }));
    const proxima = h('button', { type: 'button', class: 'cifra-navegar cifra-navegar-proxima' }, h('span', { class: 'cifra-navegar-texto' }), icone('seta'));

    const dialogo = h('dialog', { class: 'cifra-tela', 'aria-label': 'Cifra' },
        h('header', { class: 'cifra-topo' },
            fechar,
            h('div', { class: 'cifra-cabeca' }, nome, artista),
            posicao),
        h('div', { class: 'cifra-ferramentas' },
            h('div', { class: 'cifra-grupo cifra-grupo-tom' }, menosTom,
                h('span', { class: 'cifra-tom' }, tomTexto, tomOrigem), maisTom),
            h('div', { class: 'cifra-grupo' }, menor, maior),
            soLetra, rolar, velocidade),
        voltarTom,
        corpo,
        h('footer', { class: 'cifra-rodape' }, anterior, proxima),
    );
    document.body.append(dialogo);
    aplicarPref();
    dialogo.showModal();
    manterTelaAcesa();
    mostrar(indice, 0);

    // --- Eventos -----------------------------------------------------------
    fechar.addEventListener('click', () => dialogo.close());
    dialogo.addEventListener('close', () => {
        pararRolagem();
        travaTela?.release?.().catch(() => {});
        document.removeEventListener('visibilitychange', aoVoltar);
        dialogo.remove();
    });
    menosTom.addEventListener('click', () => { ajuste--; redesenhar(); });
    maisTom.addEventListener('click', () => { ajuste++; redesenhar(); });
    voltarTom.addEventListener('click', () => { ajuste = 0; redesenhar(); });
    menor.addEventListener('click', () => { pref.tamanho = Math.max(0, pref.tamanho - 1); aplicarPref(); });
    maior.addEventListener('click', () => { pref.tamanho = Math.min(TAMANHOS.length - 1, pref.tamanho + 1); aplicarPref(); });
    soLetra.addEventListener('click', () => { pref.soLetra = !pref.soLetra; aplicarPref(); });
    velocidade.addEventListener('click', () => { pref.velocidade = (pref.velocidade + 1) % VELOCIDADES.length; aplicarPref(); });
    rolar.addEventListener('click', () => (rolando ? pararRolagem() : comecarRolagem()));
    anterior.addEventListener('click', () => mostrar(indice - 1, -1));
    proxima.addEventListener('click', () => mostrar(indice + 1, 1));
    // Mexeu na tela com o dedo: a rolagem automática para (quem toca assume)
    corpo.addEventListener('touchstart', pararRolagem, { passive: true });
    corpo.addEventListener('wheel', pararRolagem, { passive: true });
    dialogo.addEventListener('keydown', (e) => {
        if (e.target.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
        if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); mostrar(indice + 1, 1); }
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); mostrar(indice - 1, -1); }
        if (e.key === ' ') { e.preventDefault(); rolando ? pararRolagem() : comecarRolagem(); }
    });

    // --- Funções -----------------------------------------------------------
    function aplicarPref() {
        dialogo.style.setProperty('--cifra-tamanho', `${TAMANHOS[pref.tamanho]}px`);
        dialogo.classList.toggle('so-letra', pref.soLetra);
        soLetra.setAttribute('aria-pressed', String(pref.soLetra));
        menor.disabled = pref.tamanho === 0;
        maior.disabled = pref.tamanho === TAMANHOS.length - 1;
        velocidade.textContent = `${pref.velocidade + 1}×`;
        velocidade.setAttribute('aria-label', `Velocidade da rolagem: ${pref.velocidade + 1} de ${VELOCIDADES.length}`);
        gravarPref(pref);
    }

    async function mostrar(novo, direcao) {
        if (novo < 0 || novo >= itens.length) return;
        indice = novo;
        ajuste = 0;
        pararRolagem();
        const { musica } = itens[indice];
        nome.textContent = musica.titulo;
        artista.textContent = musica.artista ?? '';
        posicao.textContent = itens.length > 1 ? `${indice + 1} de ${itens.length}` : '';
        anterior.hidden = indice === 0;
        proxima.hidden = indice === itens.length - 1;
        anterior.querySelector('.cifra-navegar-texto').textContent = itens[indice - 1]?.musica.titulo ?? '';
        proxima.querySelector('.cifra-navegar-texto').textContent = itens[indice + 1]?.musica.titulo ?? '';

        corpo.replaceChildren(h('p', { class: 'cifra-carregando' }, 'Abrindo a cifra…'));
        try {
            atual = await obterCifra(musica);
        } catch (erro) {
            atual = null;
            corpo.replaceChildren(h('p', { class: 'cifra-carregando' },
                navigator.onLine ? (erro.message || 'Não deu para abrir a cifra.') : 'Sem internet, e essa cifra ainda não foi guardada no aparelho.'));
            return;
        }
        if (indice !== novo) return;   // trocou de música enquanto carregava
        redesenhar(direcao);
        corpo.scrollTo({ top: 0 });
    }

    function redesenhar(direcao = 0) {
        if (!atual) return;
        const tomDoCulto = raiz(itens[indice].tom) != null ? itens[indice].tom : atual.cifra_tom;
        const n = distancia(atual.cifra_tom, tomDoCulto) + ajuste;
        const tomNaTela = tomMovido(atual.cifra_tom, n);
        tomTexto.textContent = tomNaTela;
        tomOrigem.textContent = ajuste === 0
            ? (raiz(itens[indice].tom) != null ? 'tom do culto' : 'tom da cifra')
            : `culto em ${tomMovido(atual.cifra_tom, n - ajuste)}`;
        voltarTom.hidden = ajuste === 0;
        const desenho = desenharCifra(atual.cifra, n, tomNaTela);
        if (direcao) desenho.classList.add(direcao > 0 ? 'entra-direita' : 'entra-esquerda');
        corpo.replaceChildren(desenho);
    }

    // Rolagem automática: requestAnimationFrame, com o passo pelo tempo real
    // (fica igual em tela de 60 ou 120 Hz)
    function comecarRolagem() {
        if (!atual) return;
        rolando = true;
        rolar.setAttribute('aria-pressed', 'true');
        rolar.replaceChildren(icone('pausa', 'icone icone-p'), 'Pausar');
        ultimoQuadro = 0;
        let sobra = 0;
        const passo = (agora) => {
            if (!rolando) return;
            if (ultimoQuadro) {
                sobra += (VELOCIDADES[pref.velocidade] * (agora - ultimoQuadro)) / 1000;
                const inteiro = Math.floor(sobra);   // scrollTop só anda pixel inteiro em alguns aparelhos
                if (inteiro) { corpo.scrollTop += inteiro; sobra -= inteiro; }
                if (corpo.scrollTop + corpo.clientHeight >= corpo.scrollHeight - 1) return pararRolagem();
            }
            ultimoQuadro = agora;
            requestAnimationFrame(passo);
        };
        requestAnimationFrame(passo);
    }
    function pararRolagem() {
        if (!rolando) return;
        rolando = false;
        rolar.setAttribute('aria-pressed', 'false');
        rolar.replaceChildren(icone('rolar', 'icone icone-p'), 'Rolar');
    }

    // Tela acesa enquanto a cifra está aberta (o celular no pedestal não pode
    // apagar no meio da música). O sistema solta a trava quando o app sai da
    // frente; ao voltar, pede de novo.
    async function manterTelaAcesa() {
        try { travaTela = await navigator.wakeLock?.request('screen'); } catch { /* sem suporte: segue */ }
        document.addEventListener('visibilitychange', aoVoltar);
    }
    function aoVoltar() {
        if (document.visibilityState === 'visible' && dialogo.open) manterTelaAcesa();
    }
}

// Depois que a escala carrega: guarda no aparelho as cifras de todos os
// repertórios que a pessoa vê, para o ensaio sem sinal. Só baixa o texto
// das que mudaram desde a última vez.
export async function guardarCifrasDosCultos(cultos) {
    const musicas = new Map();
    for (const culto of cultos) {
        for (const item of culto.repertorio_item ?? []) {
            if (item.musica?.cifra_tom) musicas.set(item.musica.id, item.musica);
        }
    }
    const guardadas = cifrasGuardadas();
    const mantidas = [];
    const buscar = [];
    for (const m of musicas.values()) {
        const g = guardadas[m.id];
        if (g && g.atualizado_em === m.atualizado_em) mantidas.push(g);
        else buscar.push(m.id);
    }
    let novas = [];
    if (buscar.length) {
        const { data, error } = await supabase.from('musica')
            .select('id, cifra, cifra_tom, atualizado_em').in('id', buscar);
        if (error) return;   // fica a cópia antiga; tenta de novo na próxima carga
        novas = data.filter((m) => m.cifra);
    }
    guardarCifras([...mantidas, ...novas]);
}
