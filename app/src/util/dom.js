// Ajudante para montar HTML sem innerHTML.
//
// Por que não innerHTML? Porque nomes, títulos de música e links vêm do banco,
// e qualquer pessoa com conta pode escrever neles. Com innerHTML, um nome como
// <img src=x onerror=...> viraria código rodando no celular dos outros (XSS).
// Aqui todo texto entra como texto (append de string = nó de texto), nunca
// como HTML. É mais seguro por padrão, não depende de lembrar de "escapar".
//
// Uso: h('p', { class: 'nome' }, 'Olá, ', pessoa.nome)

export function h(tag, props, ...filhos) {
    const el = document.createElement(tag);
    for (const [chave, valor] of Object.entries(props ?? {})) {
        if (valor == null || valor === false) continue;
        if (chave === 'class') el.className = valor;
        else if (chave === 'style' && typeof valor === 'object') {
            for (const [p, v] of Object.entries(valor)) el.style.setProperty(p, v);
        } else if (chave.startsWith('on') && typeof valor === 'function') {
            el.addEventListener(chave.slice(2).toLowerCase(), valor);
        } else if (valor === true) el.setAttribute(chave, '');
        else el.setAttribute(chave, String(valor));
    }
    for (const filho of filhos.flat(Infinity)) {
        if (filho == null || filho === false) continue;
        el.append(filho instanceof Node ? filho : String(filho));
    }
    return el;
}

// Ícones em SVG inline (traço simples, herdam a cor do texto).
// Poucos e desenhados aqui: não vale carregar uma biblioteca inteira por 6 ícones.
const ICONES = {
    sair: 'M9 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3M16 17l5-5-5-5M21 12H9',
    musica: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
    externo: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
    relogio: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
    olho: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
    estrela: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
};

export function icone(nome, classe = 'icone') {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', classe);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const caminho = document.createElementNS(ns, 'path');
    caminho.setAttribute('d', ICONES[nome]);
    svg.append(caminho);
    return svg;
}

// Desativa o botão e mostra "carregando" enquanto uma ação assíncrona roda.
// Evita clique duplo (ex.: pedir acesso duas vezes).
export async function comCarregando(botao, acao) {
    botao.disabled = true;
    botao.setAttribute('aria-busy', 'true');
    botao.classList.add('carregando');
    try {
        return await acao();
    } finally {
        botao.disabled = false;
        botao.removeAttribute('aria-busy');
        botao.classList.remove('carregando');
    }
}
