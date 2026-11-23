// Mural da igreja (D68): avisos, fotos do culto e uma palavra, no Início de
// todo mundo. Publica quem cuida da comunicação (pastor, Comunicação, admin);
// o resto da igreja vê, dá Amém ou coração e manda no WhatsApp.
//
// Por que sem comentários? Comentário pede moderação, e ninguém na igreja tem
// tempo (ou quer o papel) de moderar. Amém e coração dizem "vi e me importo"
// sem abrir espaço para discussão no app.
//
// As fotos ficam num bucket PRIVADO: o app pede links assinados (valem uma
// hora) em lote, um pedido só para o mural inteiro. Cada foto sobe em dois
// tamanhos: a miniatura (480 px, ~30 KB) é o que o Início carrega; a grande
// (1600 px) só baixa quando a pessoa abre o visor.
import { h, icone, comCarregando } from '../util/dom.js';
import { supabase } from '../supabase.js';
import { abrirFolha, confirmar, avisar, anunciar } from '../util/folha.js';
import { mensagemDoBanco } from '../util/erros.js';
import { hojeEmBrasilia, somarDias } from '../util/datas.js';
import { reduzirImagem } from '../util/foto.js';
import { avatar, caixaDeAviso } from './moldura.js';
import { interruptor } from './equipe/pecas.js';
import { botaoWhats } from '../util/compartilhar.js';
import { nomeCurto, temCargo } from '../sessao.js';

const LIMITE = 30;      // publicações carregadas
const VISIVEIS = 3;     // o resto em "Ver mais", sem sair da tela
const MAX_FOTOS = 10;
const UMA_HORA = 3600;

const TIPOS = {
    aviso: 'Aviso',
    fotos: 'Fotos do culto',
    palavra: 'Palavra',
};

export const publicaNoMural = (conta) =>
    !!conta?.e_administrador || temCargo(conta, 'comunicacao') || temCargo(conta, 'pastor');

const miniatura = (nome) => nome.replace(/\.(webp|jpg)$/, '-mini.$1');

// --- O bloco do Início -------------------------------------------------------
export function blocoMural(conta, { aoCarregar } = {}) {
    const meuId = conta.pessoa?.id;
    const publica = publicaNoMural(conta);
    const lugar = h('section', { class: 'mural-secao', 'aria-labelledby': 'titulo-mural', hidden: !publica });
    const lista = h('ul', { class: 'mural-lista', id: 'lista-mural' });
    let publicacoes = [];
    let links = new Map(); // nome do arquivo → link assinado
    let aberto = false;

    carregar();
    return lugar;

    async function carregar() {
        const { data, error } = await supabase.from('mural_publicacao')
            .select(`id, tipo, titulo, texto, referencia, fotos, fixado_ate, criado_em, criado_por,
                     autor:criado_por ( nome, apelido, foto ), mural_reacao ( pessoa_id, tipo, pessoa:pessoa_id ( nome, apelido, foto ) )`)
            .order('criado_em', { ascending: false })
            .limit(LIMITE);
        if (error) {
            console.error(error);
            return; // sem rede: o mural só não aparece (a escala continua)
        }
        // Fixados (até hoje, inclusive) primeiro; o resto do mais novo pro mais velho
        const hoje = hojeEmBrasilia();
        const fixado = (p) => p.fixado_ate && p.fixado_ate >= hoje;
        publicacoes = [...data.filter(fixado), ...data.filter((p) => !fixado(p))];
        await assinarFotos(publicacoes.flatMap((p) => p.fotos.map(miniatura)));
        desenhar();
        aoCarregar?.();
        focarLink();
    }

    async function assinarFotos(nomes) {
        const faltam = nomes.filter((n) => !links.has(n));
        if (!faltam.length) return;
        const { data } = await supabase.storage.from('mural').createSignedUrls(faltam, UMA_HORA);
        for (const l of data ?? []) if (l.signedUrl) links.set(l.path, l.signedUrl);
    }

    function desenhar() {
        if (!publicacoes.length && !publica) { lugar.hidden = true; return; }
        const cabeca = h('div', { class: 'rotulo-secao-linha' },
            h('h2', { id: 'titulo-mural', class: 'rotulo-secao' }, 'Mural'));
        if (publica) {
            const novo = h('button', { type: 'button', class: 'rotulo-secao-acao mural-publicar' }, icone('mais', 'icone icone-p'), 'Publicar');
            novo.addEventListener('click', () => folhaPublicar(conta, carregar));
            cabeca.append(novo);
        }
        const itens = publicacoes.map((p, i) => h('li', { style: { '--i': Math.min(i, 5) }, hidden: !aberto && i >= VISIVEIS },
            cartao(p)));
        lista.replaceChildren(...itens);

        const partes = [cabeca];
        if (!publicacoes.length) {
            partes.push(h('p', { class: 'mural-vazio' }, 'Nada publicado ainda. O primeiro aviso aparece aqui para a igreja toda.'));
        } else {
            partes.push(lista);
            if (publicacoes.length > VISIVEIS) {
                const mais = h('button', { type: 'button', class: 'botao-texto mural-mais', 'aria-expanded': String(aberto), 'aria-controls': 'lista-mural' },
                    aberto ? 'Ver menos' : `Ver mais (${publicacoes.length - VISIVEIS})`);
                mais.addEventListener('click', () => { aberto = !aberto; desenhar(); });
                partes.push(mais);
            }
        }
        lugar.replaceChildren(...partes);
        lugar.hidden = false;
    }

    // --- Um cartão -----------------------------------------------------------
    function cartao(p) {
        const fixado = p.fixado_ate && p.fixado_ate >= hojeEmBrasilia();
        const corpo = [];
        if (p.tipo === 'palavra') {
            corpo.push(h('blockquote', { class: 'mural-palavra' },
                icone('aspas', 'icone mural-aspas'),
                h('p', { class: 'mural-palavra-texto' }, p.texto),
                p.referencia && h('cite', { class: 'mural-referencia' }, p.referencia)));
            if (p.titulo) corpo.unshift(h('h3', { class: 'mural-titulo' }, p.titulo));
        } else {
            if (p.tipo === 'fotos') corpo.push(mosaico(p));
            if (p.titulo) corpo.push(h('h3', { class: 'mural-titulo' }, p.titulo));
            if (p.texto) corpo.push(textoComLerMais(p.texto));
        }

        const artigo = h('article', { class: `mural-cartao tipo-${p.tipo}${fixado ? ' fixado' : ''}`, id: `mural-${p.id}`, tabindex: -1 },
            h('header', { class: 'mural-topo' },
                h('span', { class: 'mural-chapeu' }, TIPOS[p.tipo]),
                fixado && h('span', { class: 'mural-fixado' }, icone('pino', 'icone icone-p'), 'Fixado'),
                publica && botaoOpcoes(p)),
            corpo,
            h('footer', { class: 'mural-rodape' },
                h('span', { class: 'mural-autor' },
                    avatar(p.autor, 'pessoa-avatar mural-autor-foto'),
                    h('span', { class: 'mural-autor-textos' },
                        h('span', { class: 'mural-autor-nome' }, p.autor ? nomeCurto(p.autor) : 'IEJB'),
                        h('time', { class: 'mural-quando', datetime: p.criado_em }, quandoFoi(p.criado_em)))),
                h('span', { class: 'mural-acoes' },
                    botaoReacao(p, 'amem'),
                    botaoReacao(p, 'coracao'),
                    botaoWhats({ rotulo: 'Mandar no WhatsApp', texto: () => textoDaPublicacao(p), classe: 'mural-whats' }))),
            quemReagiu(p));
        return artigo;
    }

    function mosaico(p) {
        const mostrar = p.fotos.slice(0, 4);
        const resto = p.fotos.length - mostrar.length;
        return h('div', { class: `mural-fotos fotos-${Math.min(p.fotos.length, 4)}` }, mostrar.map((nome, i) => {
            const url = links.get(miniatura(nome));
            const b = h('button', { type: 'button', class: 'mural-foto', 'aria-label': `Abrir foto ${i + 1} de ${p.fotos.length}` },
                url && h('img', { src: url, alt: '', loading: 'lazy', decoding: 'async' }),
                i === mostrar.length - 1 && resto > 0 && h('span', { class: 'mural-foto-mais', 'aria-hidden': 'true' }, `+${resto}`));
            const img = b.querySelector('img');
            img?.addEventListener('load', () => b.classList.add('carregou'));
            b.addEventListener('click', () => abrirVisor(p, i, b));
            return b;
        }));
    }

    // --- Amém e coração ------------------------------------------------------
    function botaoReacao(p, tipo) {
        const minha = () => p.mural_reacao.some((r) => r.pessoa_id === meuId && r.tipo === tipo);
        const total = () => p.mural_reacao.filter((r) => r.tipo === tipo).length;
        const nome = tipo === 'amem' ? 'Amém' : 'Coração';
        const numero = h('span', { class: 'reacao-n' });
        const b = h('button', { type: 'button', class: `reacao reacao-${tipo}` },
            tipo === 'amem' ? h('span', { class: 'reacao-amem-texto' }, 'Amém') : icone('coracao', 'icone reacao-coracao'),
            numero);
        function pintar() {
            b.setAttribute('aria-pressed', String(minha()));
            b.setAttribute('aria-label', `${nome}${total() ? `, ${total()}` : ''}`);
            numero.textContent = total() || '';
        }
        pintar();
        b.addEventListener('click', async () => {
            if (!meuId || b.dataset.ocupado) return;
            b.dataset.ocupado = '1';
            const dar = !minha();
            // Otimista: muda na hora (o toque responde) e desfaz se o banco recusar
            if (dar) p.mural_reacao.push({ pessoa_id: meuId, tipo, pessoa: conta.pessoa });
            else p.mural_reacao = p.mural_reacao.filter((r) => !(r.pessoa_id === meuId && r.tipo === tipo));
            pintar();
            p.aoMudarReacao?.();
            if (dar) {
                b.classList.remove('reagiu');
                void b.offsetWidth; // reinicia o "pulo"
                b.classList.add('reagiu');
                navigator.vibrate?.(8);
            }
            const { error } = dar
                ? await supabase.from('mural_reacao').insert({ publicacao_id: p.id, tipo })
                : await supabase.from('mural_reacao').delete().match({ publicacao_id: p.id, pessoa_id: meuId, tipo });
            delete b.dataset.ocupado;
            if (error) {
                if (dar) p.mural_reacao = p.mural_reacao.filter((r) => !(r.pessoa_id === meuId && r.tipo === tipo));
                else p.mural_reacao.push({ pessoa_id: meuId, tipo, pessoa: conta.pessoa });
                pintar();
                p.aoMudarReacao?.();
                avisar('Não deu certo. Confira a internet.');
            }
        });
        return b;
    }

    // --- Quem reagiu -----------------------------------------------------------
    // "Bia, João e mais 3": os rostos e os nomes de quem deu Amém ou coração.
    // Tocando, abre a lista completa, separada por reação. Eu primeiro ("Você").
    function quemReagiu(p) {
        const linha = h('button', { type: 'button', class: 'mural-quem', hidden: true });
        p.aoMudarReacao = () => {
            const pessoas = pessoasQueReagiram(p);
            linha.hidden = pessoas.length === 0;
            if (!pessoas.length) return;
            const nomes = pessoas.map((x) => (x.id === meuId ? 'Você' : nomeCurto(x)));
            const texto = nomes.length <= 2 ? juntarNomes(nomes) : `${nomes.slice(0, 2).join(', ')} e mais ${nomes.length - 2}`;
            linha.replaceChildren(
                h('span', { class: 'mural-quem-rostos', 'aria-hidden': 'true' }, pessoas.slice(0, 3).map((x) => avatar(x, 'pessoa-avatar mural-quem-rosto'))),
                h('span', { class: 'mural-quem-texto' }, texto));
            linha.setAttribute('aria-label', `Quem reagiu: ${texto}. Ver todos`);
        };
        p.aoMudarReacao();
        linha.addEventListener('click', () => folhaQuemReagiu(p));
        return linha;
    }

    // Cada pessoa uma vez (quem deu Amém e coração conta uma vez), eu primeiro
    function pessoasQueReagiram(p, tipo = null) {
        const vistos = new Map();
        for (const r of p.mural_reacao) {
            if (tipo && r.tipo !== tipo) continue;
            if (!vistos.has(r.pessoa_id)) vistos.set(r.pessoa_id, { id: r.pessoa_id, ...(r.pessoa ?? { nome: 'Alguém' }) });
        }
        return [...vistos.values()].sort((a, b) => (b.id === meuId) - (a.id === meuId));
    }

    function folhaQuemReagiu(p) {
        const grupo = (tipo, titulo) => {
            const pessoas = pessoasQueReagiram(p, tipo);
            if (!pessoas.length) return null;
            return h('section', { class: 'reagiram-grupo' },
                h('h3', { class: 'reagiram-titulo' },
                    tipo === 'amem' ? h('span', { class: 'reagiram-amem' }, 'Amém') : icone('coracao', 'icone reagiram-coracao'),
                    h('span', { class: 'reagiram-n' }, String(pessoas.length)), h('span', { class: 'sr-only' }, titulo)),
                h('ul', { class: 'reagiram-lista' }, pessoas.map((x) => h('li', null,
                    avatar(x, 'pessoa-avatar'), h('span', null, x.id === meuId ? 'Você' : nomeCurto(x))))));
        };
        abrirFolha({
            titulo: 'Quem reagiu',
            conteudo: h('div', { class: 'reagiram' }, [grupo('amem', 'deram Amém'), grupo('coracao', 'deram coração')].filter(Boolean)),
        });
    }

    // --- Opções de quem publica ---------------------------------------------
    function botaoOpcoes(p) {
        const b = h('button', { type: 'button', class: 'botao-icone mural-opcoes', 'aria-label': 'Opções da publicação' }, icone('reticencias'));
        b.addEventListener('click', () => folhaOpcoes(p));
        return b;
    }

    function folhaOpcoes(p) {
        const hoje = hojeEmBrasilia();
        const fixado = p.fixado_ate && p.fixado_ate >= hoje;
        const aviso = caixaDeAviso();
        const data = h('input', { type: 'date', id: 'mural-fixar-ate', min: hoje, value: p.fixado_ate && p.fixado_ate >= hoje ? p.fixado_ate : somarDias(hoje, 7) });
        const fixar = h('button', { type: 'button', class: 'botao-principal botao-largo' }, icone('pino', 'icone icone-p'), fixado ? 'Mudar a data' : 'Fixar no topo');
        // null (e não false) quando não tem: false?.addEventListener quebra
        const soltar = fixado ? h('button', { type: 'button', class: 'botao-secundario botao-largo' }, 'Tirar do topo') : null;
        const editar = h('button', { type: 'button', class: 'botao-secundario botao-largo' }, 'Editar o texto');
        const apagar = h('button', { type: 'button', class: 'botao-perigo botao-largo' }, icone('lixeira', 'icone icone-p'), 'Apagar');

        const folha = abrirFolha({
            titulo: p.titulo || TIPOS[p.tipo],
            conteudo: h('div', { class: 'form' },
                editar,
                h('hr', { class: 'mural-separador' }),
                h('div', { class: 'campo' },
                    h('label', { for: 'mural-fixar-ate' }, 'Fica no topo até'),
                    data),
                fixar, soltar, aviso.elemento,
                h('hr', { class: 'mural-separador' }),
                apagar),
        });

        fixar.addEventListener('click', () => comCarregando(fixar, async () => {
            if (!data.value || data.value < hoje) return aviso.mostrar('Escolha um dia de hoje em diante.');
            if (await mudar({ fixado_ate: data.value })) { folha.fechar(); avisar('Fixado no topo.'); }
        }));
        soltar?.addEventListener('click', () => comCarregando(soltar, async () => {
            if (await mudar({ fixado_ate: null })) { folha.fechar(); avisar('Saiu do topo.'); }
        }));
        editar.addEventListener('click', () => { folha.fechar(); folhaEditar(p); });
        apagar.addEventListener('click', async () => {
            folha.fechar();
            const ok = await confirmar({
                titulo: 'Apagar do mural?',
                texto: 'Some para a igreja toda, com as fotos e as reações. Não dá para desfazer.',
                botao: 'Apagar', perigo: true,
            });
            if (!ok) return;
            const { error } = await supabase.from('mural_publicacao').delete().eq('id', p.id);
            if (error) return avisar(mensagemDoBanco(error));
            if (p.fotos.length) supabase.storage.from('mural').remove([...p.fotos, ...p.fotos.map(miniatura)]);
            avisar('Apagado do mural.');
            carregar();
        });

        async function mudar(valores) {
            return gravar(p, valores, aviso);
        }
    }

    // Editar: só o texto (título, texto, referência). Tipo e fotos ficam
    // como foram publicados (D68).
    function folhaEditar(p) {
        const aviso = caixaDeAviso();
        const titulo = h('input', { id: 'editar-titulo', maxlength: 80, value: p.titulo ?? '', autocomplete: 'off' });
        const texto = h('textarea', { id: 'editar-texto', class: 'campo-texto', rows: 5, maxlength: 1000 }, p.texto ?? '');
        const referencia = h('input', { id: 'editar-referencia', maxlength: 60, value: p.referencia ?? '', autocomplete: 'off' });
        const salvar = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, 'Salvar');
        const form = h('form', { class: 'form', novalidate: true },
            h('div', { class: 'campo' }, h('label', { for: 'editar-titulo' }, p.tipo === 'aviso' ? 'Título' : 'Título (opcional)'), titulo),
            h('div', { class: 'campo' }, h('label', { for: 'editar-texto' }, p.tipo === 'palavra' ? 'A palavra' : 'Texto (opcional)'), texto),
            p.tipo === 'palavra' && h('div', { class: 'campo' }, h('label', { for: 'editar-referencia' }, 'Referência (opcional)'), referencia),
            aviso.elemento, salvar);
        const folha = abrirFolha({ titulo: 'Editar publicação', conteudo: form });
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            aviso.limpar();
            const valores = {
                titulo: titulo.value.trim() || null,
                texto: texto.value.trim() || null,
                referencia: p.tipo === 'palavra' ? (referencia.value.trim() || null) : p.referencia,
            };
            if (p.tipo === 'aviso' && !valores.titulo) return aviso.mostrar('O aviso precisa de título.');
            if (p.tipo === 'palavra' && !valores.texto) return aviso.mostrar('Escreva a palavra.');
            comCarregando(salvar, async () => {
                if (await gravar(p, valores, aviso)) { folha.fechar(); avisar('Publicação atualizada.'); }
            });
        });
    }

    async function gravar(p, valores, aviso) {
        const { error } = await supabase.from('mural_publicacao').update(valores).eq('id', p.id);
        if (error) { aviso.mostrar(mensagemDoBanco(error)); return false; }
        carregar();
        return true;
    }

    // --- Visor de fotos ------------------------------------------------------
    async function abrirVisor(p, inicio, origem) {
        await assinarFotos(p.fotos);
        abrirVisorDeFotos({ titulo: p.titulo || TIPOS.fotos, urls: p.fotos.map((n) => links.get(n) ?? links.get(miniatura(n))), inicio, origem });
    }

    // Link do WhatsApp (#/mural/<id>): rola até o cartão e acende ele
    function focarLink() {
        const m = /^#\/mural\/([\w-]+)$/.exec(location.hash);
        if (!m) return;
        history.replaceState(null, '', '#/inicio');
        const i = publicacoes.findIndex((p) => p.id === m[1]);
        if (i < 0) return avisar('Esse aviso não está mais no mural.');
        if (i >= VISIVEIS && !aberto) { aberto = true; desenhar(); }
        const alvo = document.getElementById(`mural-${m[1]}`);
        if (!alvo) return;
        setTimeout(() => {
            alvo.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
            alvo.focus({ preventScroll: true });
            alvo.classList.add('destacado');
        }, 350);
    }
}

function textoComLerMais(texto) {
    const p = h('p', { class: 'mural-texto' }, texto);
    if (texto.length < 260 && texto.split('\n').length < 5) return p;
    p.classList.add('cortado');
    const ler = h('button', { type: 'button', class: 'botao-texto mural-ler', 'aria-expanded': 'false' }, 'Ler tudo');
    ler.addEventListener('click', () => {
        const abrir = p.classList.toggle('cortado') === false;
        ler.setAttribute('aria-expanded', String(abrir));
        ler.textContent = abrir ? 'Mostrar menos' : 'Ler tudo';
    });
    return [p, ler];
}

// "agora", "há 5 min", "há 3 h", "ontem", "há 4 dias", "12 de nov."
function quandoFoi(iso) {
    const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (min < 2) return 'agora';
    if (min < 60) return `há ${min} min`;
    if (min < 60 * 24) return `há ${Math.round(min / 60)} h`;
    const dias = Math.round(min / (60 * 24));
    if (dias === 1) return 'ontem';
    if (dias < 7) return `há ${dias} dias`;
    return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
}

// A mensagem do WhatsApp: o essencial e o link para ver no Hub (as fotos são
// privadas, então elas não vão: quem é da igreja vê pelo app).
//
//   *Cantata de Natal*
//   Dia 20, às 19h. Traga a família!
//
//   📲 Ver no IEJB Hub
//   https://app.iejb.com.br/#/mural/<id>
export function textoDaPublicacao(p) {
    const linhas = [];
    if (p.tipo === 'palavra') {
        if (p.titulo) linhas.push(`*${p.titulo}*`, '');
        linhas.push(`_${p.texto}_`);
        if (p.referencia) linhas.push(`*${p.referencia}*`);
    } else {
        if (p.titulo) linhas.push(`*${p.titulo}*`);
        if (p.texto) linhas.push(p.texto);
        if (p.tipo === 'fotos') linhas.push(`📷 ${p.fotos.length} ${p.fotos.length === 1 ? 'foto' : 'fotos'} no app`);
    }
    linhas.push('', '📲 Ver no IEJB Hub', `${location.origin}/#/mural/${p.id}`);
    return linhas.join('\n');
}

// --- Visor (tela cheia, deslizar entre as fotos) ----------------------------
export function abrirVisorDeFotos({ titulo, urls, inicio = 0, origem }) {
    const contador = h('p', { class: 'visor-contador', 'aria-live': 'polite' });
    const trilho = h('div', { class: 'visor-trilho' }, urls.map((url, i) =>
        h('figure', { class: 'visor-quadro' },
            h('img', { src: url, alt: `Foto ${i + 1} de ${urls.length}`, decoding: 'async', loading: Math.abs(i - inicio) <= 1 ? 'eager' : 'lazy' }))));
    const fechar = h('button', { type: 'button', class: 'visor-fechar', 'aria-label': 'Fechar' }, icone('fechar'));
    const anterior = h('button', { type: 'button', class: 'visor-seta visor-anterior', 'aria-label': 'Foto anterior' }, icone('seta'));
    const proxima = h('button', { type: 'button', class: 'visor-seta visor-proxima', 'aria-label': 'Próxima foto' }, icone('seta'));
    const dialogo = h('dialog', { class: 'visor', 'aria-label': titulo },
        h('header', { class: 'visor-topo' }, h('p', { class: 'visor-titulo' }, titulo), contador, fechar),
        trilho,
        urls.length > 1 && [anterior, proxima]);
    document.body.append(dialogo);

    let atual = inicio;
    const ir = (i, suave = true) => {
        atual = Math.max(0, Math.min(urls.length - 1, i));
        trilho.scrollTo({ left: atual * trilho.clientWidth, behavior: suave ? 'smooth' : 'instant' });
    };
    const pintar = () => {
        contador.textContent = `${atual + 1} de ${urls.length}`;
        anterior.disabled = atual === 0;
        proxima.disabled = atual === urls.length - 1;
    };
    trilho.addEventListener('scroll', () => {
        const i = Math.round(trilho.scrollLeft / trilho.clientWidth);
        if (i !== atual) { atual = i; pintar(); }
    }, { passive: true });
    anterior.addEventListener('click', () => ir(atual - 1));
    proxima.addEventListener('click', () => ir(atual + 1));
    dialogo.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') ir(atual - 1);
        if (e.key === 'ArrowRight') ir(atual + 1);
    });

    function sair() {
        let feito = false;
        const terminar = () => { if (feito) return; feito = true; dialogo.close(); dialogo.remove(); origem?.focus({ preventScroll: true }); };
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return terminar();
        dialogo.classList.add('saindo');
        dialogo.addEventListener('animationend', terminar, { once: true });
        setTimeout(terminar, 350);
    }
    fechar.addEventListener('click', sair);
    dialogo.addEventListener('cancel', (e) => { e.preventDefault(); sair(); });
    // Puxar a foto para baixo fecha (o gesto de "jogar fora" do iPhone)
    let y0 = null;
    trilho.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; }, { passive: true });
    trilho.addEventListener('touchend', (e) => {
        if (y0 != null && e.changedTouches[0].clientY - y0 > 110) sair();
        y0 = null;
    });

    dialogo.showModal();
    ir(inicio, false);
    pintar();
    fechar.focus();
}

// --- Publicar ---------------------------------------------------------------
function folhaPublicar(conta, aoPublicar) {
    let tipo = 'aviso';
    let fotos = []; // { arquivo, url (prévia local) }
    const aviso = caixaDeAviso();

    const segmentos = h('div', { class: 'segmentos mural-tipos', role: 'tablist', 'aria-label': 'O que publicar', style: { '--n': 3 } });
    const titulo = h('input', { id: 'mural-titulo', name: 'titulo', maxlength: 80, autocomplete: 'off' });
    const texto = h('textarea', { id: 'mural-texto', name: 'texto', class: 'campo-texto', rows: 4, maxlength: 1000 });
    const referencia = h('input', { id: 'mural-referencia', name: 'referencia', maxlength: 60, autocomplete: 'off', placeholder: 'Ex.: Salmo 23:1' });
    const rotuloTitulo = h('label', { for: 'mural-titulo' });
    const rotuloTexto = h('label', { for: 'mural-texto' });
    const campoTitulo = h('div', { class: 'campo' }, rotuloTitulo, titulo);
    const campoTexto = h('div', { class: 'campo' }, rotuloTexto, texto);
    const campoReferencia = h('div', { class: 'campo' }, h('label', { for: 'mural-referencia' }, 'Referência (opcional)'), referencia);

    const escolher = h('input', { type: 'file', accept: 'image/*', multiple: true, class: 'sr-only', id: 'mural-escolher-fotos' });
    const grade = h('ul', { class: 'mural-escolhidas' });
    const contadorFotos = h('p', { class: 'campo-dica', 'aria-live': 'polite' });
    const campoFotos = h('div', { class: 'campo' },
        h('span', { class: 'campo-rotulo' }, 'Fotos'),
        grade,
        h('label', { for: 'mural-escolher-fotos', class: 'botao-secundario botao-largo mural-escolher' }, icone('imagem', 'icone icone-p'), 'Escolher fotos'),
        escolher, contadorFotos);

    const hoje = hojeEmBrasilia();
    const dataFixar = h('input', { type: 'date', id: 'mural-fixar', min: hoje, value: somarDias(hoje, 7) });
    const campoFixar = h('div', { class: 'campo', hidden: true }, h('label', { for: 'mural-fixar' }, 'Fica no topo até'), dataFixar);
    let fixar = false;
    let avisar_ = false;
    const chaveFixar = interruptor({ rotulo: 'Fixar no topo', descricao: 'Fica em primeiro até o dia escolhido', ligado: false,
        aoMudar: (v) => { fixar = v; campoFixar.hidden = !v; return true; } });
    const chaveAvisar = interruptor({ rotulo: 'Notificar a igreja', descricao: 'Chega no celular de todo mundo. Use só no que é importante.', ligado: false,
        aoMudar: (v) => { avisar_ = v; return true; } });

    const enviar = h('button', { type: 'submit', class: 'botao-principal botao-largo' }, 'Publicar');
    const form = h('form', { class: 'form mural-form', novalidate: true },
        segmentos, campoFotos, campoTitulo, campoTexto, campoReferencia,
        chaveFixar, campoFixar, chaveAvisar, aviso.elemento, enviar);

    const folha = abrirFolha({ titulo: 'Publicar no mural', conteudo: form, aoFechar: () => fotos.forEach((f) => URL.revokeObjectURL(f.url)) });

    function desenharTipo() {
        const TIPOS_DO_FORM = [['aviso', 'Aviso'], ['fotos', 'Fotos'], ['palavra', 'Palavra']];
        segmentos.style.setProperty('--ativo', TIPOS_DO_FORM.findIndex(([id]) => id === tipo));
        segmentos.replaceChildren(...TIPOS_DO_FORM.map(([id, nome]) => {
            const b = h('button', { type: 'button', role: 'tab', 'aria-selected': String(id === tipo) }, nome);
            b.addEventListener('click', () => { tipo = id; aviso.limpar(); desenharTipo(); });
            return b;
        }));
        campoFotos.hidden = tipo !== 'fotos';
        campoReferencia.hidden = tipo !== 'palavra';
        rotuloTitulo.textContent = tipo === 'palavra' ? 'Título (opcional)' : tipo === 'fotos' ? 'Do que são as fotos?' : 'Título';
        titulo.placeholder = tipo === 'fotos' ? 'Ex.: Culto da Família' : tipo === 'aviso' ? 'Ex.: Cantata de Natal' : '';
        rotuloTexto.textContent = tipo === 'palavra' ? 'A palavra' : 'Texto (opcional)';
    }
    desenharTipo();

    function desenharFotos() {
        grade.replaceChildren(...fotos.map((f, i) => {
            const tirar = h('button', { type: 'button', class: 'mural-escolhida-tirar', 'aria-label': `Tirar a foto ${i + 1}` }, icone('fechar', 'icone icone-p'));
            tirar.addEventListener('click', () => { URL.revokeObjectURL(f.url); fotos.splice(i, 1); desenharFotos(); });
            return h('li', { class: 'mural-escolhida' }, h('img', { src: f.url, alt: '' }), tirar);
        }));
        contadorFotos.textContent = fotos.length ? `${fotos.length} de ${MAX_FOTOS} fotos` : `Até ${MAX_FOTOS} fotos.`;
    }
    desenharFotos();

    escolher.addEventListener('change', () => {
        const novas = [...escolher.files].filter((a) => a.type.startsWith('image/'));
        const cabem = MAX_FOTOS - fotos.length;
        if (novas.length > cabem) avisar(`Cabem só ${MAX_FOTOS} fotos. Fiquei com as ${cabem} primeiras.`);
        fotos.push(...novas.slice(0, cabem).map((arquivo) => ({ arquivo, url: URL.createObjectURL(arquivo) })));
        escolher.value = '';
        desenharFotos();
    });

    function problema() {
        const t = titulo.value.trim();
        const x = texto.value.trim();
        if (tipo === 'aviso' && !t) return 'Escreva o título do aviso.';
        if (tipo === 'fotos' && !fotos.length) return 'Escolha pelo menos uma foto.';
        if (tipo === 'palavra' && !x) return 'Escreva a palavra.';
        if (fixar && (!dataFixar.value || dataFixar.value < hoje)) return 'Escolha até quando fica no topo.';
        return null;
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        aviso.limpar();
        const erro = problema();
        if (erro) return aviso.mostrar(erro);
        comCarregando(enviar, publicar);
    });

    async function publicar() {
        const subidas = [];
        try {
            // Sobe as fotos antes (grande e miniatura); se publicar falhar, apaga
            for (const [i, f] of fotos.entries()) {
                enviar.textContent = `Enviando foto ${i + 1} de ${fotos.length}…`;
                const [grande, mini] = await Promise.all([reduzirImagem(f.arquivo, 1600), reduzirImagem(f.arquivo, 480)]);
                const nome = `${crypto.randomUUID()}.${grande.type === 'image/webp' ? 'webp' : 'jpg'}`;
                for (const [caminho, blob] of [[nome, grande], [miniatura(nome), mini]]) {
                    const { error } = await supabase.storage.from('mural').upload(caminho, blob, { contentType: blob.type, upsert: false });
                    if (error) throw error;
                    subidas.push(caminho);
                }
            }
            enviar.textContent = 'Publicando…';
            const { error } = await supabase.rpc('publicar_no_mural', {
                p_tipo: tipo,
                p_titulo: titulo.value.trim() || null,
                p_texto: texto.value.trim() || null,
                p_referencia: tipo === 'palavra' ? (referencia.value.trim() || null) : null,
                p_fotos: subidas.filter((n) => !n.includes('-mini.')),
                p_fixado_ate: fixar ? dataFixar.value : null,
                p_avisar: avisar_,
            });
            if (error) throw error;
            folha.fechar();
            avisar(avisar_ ? 'Publicado. A igreja vai receber a notificação.' : 'Publicado no mural.');
            anunciar('Publicado no mural.');
            aoPublicar();
        } catch (erro) {
            console.error(erro);
            if (subidas.length) supabase.storage.from('mural').remove(subidas);
            enviar.textContent = 'Publicar';
            aviso.mostrar(mensagemDoBanco(erro, erro?.message?.startsWith('A imagem') ? erro.message : 'Não deu para publicar. Tente de novo.'));
        }
    }
}

const juntarNomes = (nomes) => (nomes.length < 2 ? nomes[0] : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`);
