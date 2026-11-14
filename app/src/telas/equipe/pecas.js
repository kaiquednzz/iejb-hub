// Peças reaproveitadas entre Pedidos, Pessoas e Grupos.
import { h, icone, comCarregando } from '../../util/dom.js';
import { avatar, trocarFoto } from '../../util/foto.js';
import { avisar } from '../../util/folha.js';
import { chave } from './dados.js';

// Escolha de instrumentos: fichas que ligam/desligam com um toque, mais um
// campo para escrever um que não está na lista.
// aria-pressed diz ao leitor de tela se cada ficha está marcada.
export function seletorInstrumentos({ sugestoes, marcados = [], rotulo = 'Instrumentos' }) {
    const escolhidos = new Map(marcados.map((i) => [chave(i), i]));
    const todas = new Map(sugestoes.map((i) => [chave(i), i]));
    marcados.forEach((i) => { if (!todas.has(chave(i))) todas.set(chave(i), i); });

    const fichas = h('div', { class: 'fichas' });
    const campoOutro = h('input', {
        type: 'text', class: 'fichas-outro-campo', placeholder: 'Outro instrumento',
        'aria-label': 'Outro instrumento', enterkeyhint: 'done', autocapitalize: 'sentences',
    });
    const botaoOutro = h('button', { type: 'button', class: 'fichas-outro-botao', 'aria-label': 'Adicionar instrumento' }, icone('mais'));

    function desenhar() {
        fichas.replaceChildren(...[...todas.entries()].map(([k, nome]) => {
            const ficha = h('button', {
                type: 'button', class: 'ficha', 'aria-pressed': String(escolhidos.has(k)),
            }, escolhidos.has(k) && icone('certo', 'icone ficha-certo'), nome);
            ficha.addEventListener('click', () => {
                if (escolhidos.has(k)) escolhidos.delete(k); else escolhidos.set(k, nome);
                desenhar();
                fichas.querySelectorAll('.ficha')[[...todas.keys()].indexOf(k)]?.focus();
            });
            return ficha;
        }));
    }

    function adicionarOutro() {
        const nome = campoOutro.value.trim().replace(/\s+/g, ' ');
        if (!nome) return;
        const k = chave(nome);
        if (!todas.has(k)) todas.set(k, nome[0].toLocaleUpperCase('pt-BR') + nome.slice(1));
        escolhidos.set(k, todas.get(k));
        campoOutro.value = '';
        desenhar();
    }
    botaoOutro.addEventListener('click', adicionarOutro);
    // Enter no campo adiciona o instrumento, em vez de enviar o formulário
    campoOutro.addEventListener('keydown', (evento) => {
        if (evento.key === 'Enter') { evento.preventDefault(); adicionarOutro(); }
    });

    desenhar();
    return {
        elemento: h('fieldset', { class: 'campo campo-fichas' },
            h('legend', null, rotulo),
            fichas,
            h('div', { class: 'fichas-outro' }, campoOutro, botaoOutro),
        ),
        // Na ordem em que aparecem (a primeira marcada vem primeiro)
        valores: () => [...todas.keys()].filter((k) => escolhidos.has(k)).map((k) => escolhidos.get(k)),
        // Para trocar as marcações quando outra pessoa é escolhida (tela Grupos)
        marcar(lista) {
            escolhidos.clear();
            lista.forEach((i) => { if (!todas.has(chave(i))) todas.set(chave(i), i); escolhidos.set(chave(i), todas.get(chave(i))); });
            desenhar();
        },
    };
}

// Interruptor estilo iOS. É um checkbox de verdade (role=switch): funciona
// com teclado e leitor de tela, e o visual é só CSS.
export function interruptor({ rotulo, descricao, ligado, aoMudar }) {
    const entrada = h('input', { type: 'checkbox', role: 'switch', class: 'interruptor-entrada' });
    entrada.checked = ligado;
    entrada.addEventListener('change', async () => {
        entrada.disabled = true;
        const deuCerto = await aoMudar(entrada.checked);
        if (!deuCerto) entrada.checked = !entrada.checked; // volta se o banco recusou
        entrada.disabled = false;
    });
    return h('label', { class: 'interruptor' },
        h('span', { class: 'interruptor-textos' },
            h('span', { class: 'interruptor-rotulo' }, rotulo),
            descricao && h('span', { class: 'interruptor-descricao' }, descricao),
        ),
        entrada,
        h('span', { class: 'interruptor-trilho', 'aria-hidden': 'true' }),
    );
}

// Linha de pessoa numa lista. Vira botão quando tocar nela faz alguma coisa.
export function linhaPessoa({ pessoa, detalhe, selos = [], aoTocar, sou }) {
    const conteudo = [
        avatar(pessoa),
        h('span', { class: 'linha-textos' },
            h('span', { class: 'linha-nome' },
                pessoa.apelido || pessoa.nome,
                sou && h('span', { class: 'linha-voce' }, ' · você')),
            (pessoa.apelido || detalhe) && h('span', { class: 'linha-detalhe' },
                [pessoa.apelido && pessoa.nome, detalhe].filter(Boolean).join(' · ')),
        ),
        selos.length > 0 && h('span', { class: 'linha-selos' }, selos),
        aoTocar && icone('seta', 'icone icone-p linha-seta'),
    ];
    if (!aoTocar) return h('li', { class: 'linha' }, h('div', { class: 'linha-caixa' }, conteudo));
    const botao = h('button', { type: 'button', class: 'linha-caixa linha-tocavel' }, conteudo);
    botao.addEventListener('click', aoTocar);
    return h('li', { class: 'linha' }, botao);
}

export function selo(texto, tipo) {
    return h('span', { class: `selo${tipo ? ` selo-${tipo}` : ''}` }, texto);
}

export function vazio(titulo, texto, acao) {
    return h('div', { class: 'estado-vazio' },
        h('div', { class: 'estado-vazio-icone', 'aria-hidden': 'true' }, icone('pessoas')),
        h('p', { class: 'estado-vazio-titulo' }, titulo),
        texto && h('p', { class: 'estado-vazio-texto' }, texto),
        acao,
    );
}

// Senha temporária fácil de ditar: "acorde-4821". O admin passa para a
// pessoa e ela troca no primeiro login, então não precisa ser enorme, só
// imprevisível (crypto, não Math.random).
const PALAVRAS = ['acorde', 'melodia', 'louvor', 'salmo', 'canto', 'hino', 'harpa', 'coral', 'ritmo', 'cifra', 'tempo', 'graca'];
export function gerarSenhaTemporaria() {
    const n = crypto.getRandomValues(new Uint32Array(2));
    return `${PALAVRAS[n[0] % PALAVRAS.length]}-${String(n[1] % 10000).padStart(4, '0')}`;
}

// Mensagem pronta para mandar no WhatsApp com o acesso
export function mensagemDeAcesso(email, senha) {
    return `Seu acesso ao IEJB Hub (escalas do Louvor):\n${location.origin}\n\nE-mail: ${email}\nSenha temporária: ${senha}\n\nNo primeiro acesso o app pede pra você criar a sua senha.`;
}

// Foto de perfil dentro da folha: o círculo grande + escolher/tirar.
// A compressão acontece no aparelho (util/foto.js) antes de subir.
export function blocoFoto(pessoa, aoMudar) {
    let atual = pessoa;
    const lugar = h('div', { class: 'foto-lugar' }, avatar(pessoa, 'pessoa-avatar avatar-grande'));
    const entrada = h('input', { type: 'file', accept: 'image/*', class: 'sr-only', tabindex: -1, 'aria-hidden': 'true' });
    const escolher = h('button', { type: 'button', class: 'botao-secundario botao-pequeno' }, pessoa.foto ? 'Trocar foto' : 'Pôr foto');
    const tirar = h('button', { type: 'button', class: 'link-discreto', hidden: !pessoa.foto }, 'Tirar foto');

    escolher.addEventListener('click', () => entrada.click());
    entrada.addEventListener('change', () => {
        const arquivo = entrada.files?.[0];
        entrada.value = '';
        if (arquivo) mudar(arquivo);
    });
    tirar.addEventListener('click', () => mudar(null));

    async function mudar(arquivo) {
        const botao = arquivo ? escolher : tirar;
        await comCarregando(botao, async () => {
            try {
                const caminho = await trocarFoto(atual, arquivo);
                atual = { ...atual, foto: caminho };
                lugar.replaceChildren(avatar(atual, 'pessoa-avatar avatar-grande'));
                lugar.firstChild.classList.add('foto-nova');
                escolher.textContent = caminho ? 'Trocar foto' : 'Pôr foto';
                tirar.hidden = !caminho;
                aoMudar?.(caminho);
            } catch (erro) {
                console.error(erro);
                avisar(/size|large|grande/i.test(erro?.message ?? '') ? 'A foto ficou grande demais. Tente outra.' : 'Não deu para trocar a foto. Tente de novo.');
            }
        });
    }

    return h('div', { class: 'bloco-foto' }, lugar, h('div', { class: 'foto-acoes' }, escolher, tirar), entrada);
}

