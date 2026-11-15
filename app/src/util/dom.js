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
    // Os mesmos símbolos que a pessoa vai procurar no próprio celular
    compartilhar: 'M12 3v12M8 7l4-4 4 4M6 10H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-1',
    adicionar: 'M12 8v8M8 12h8M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z',
    reticencias: 'M5 12h.01M12 12h.01M19 12h.01',
    menu: 'M12 5h.01M12 12h.01M12 19h.01',
    celular: 'M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM11 18h2',
    copiar: 'M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
    certo: 'M5 12.5l4.5 4.5L19 7',
    baixar: 'M12 4v12M7 11l5 5 5-5M5 20h14',
    calendario: 'M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
    pessoas: 'M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
    fechar: 'M6 6l12 12M18 6L6 18',
    mais: 'M12 5v14M5 12h14',
    seta: 'M9 6l6 6-6 6',
    chave: 'M12 15a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM10.8 12.2L20 3M17 6l3 3M14 9l2 2',
    escudo: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z',
    montar: 'M4 6h10M4 12h7M4 18h10M17 9l3 3-3 3M14 12h6',
    fone: 'M3 14v-2a9 9 0 0 1 18 0v2M21 15v3a2 2 0 0 1-2 2h-1v-6h3zM3 15v3a2 2 0 0 0 2 2h1v-6H3z',
    play: 'M7 4.5v15l12-7.5z',
    sino: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
    mensagem: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l.9-4.4A8 8 0 1 1 21 12zM8 10h8M8 14h5',
    cifra: 'M7 3h7l4 4v14H7zM14 3v4h4M10 11h5M10 14.5h5M10 18h3',
    menos: 'M5 12h14',
    texto: 'M4 18l4.5-12L13 18M5.5 14h6M15.5 18v-5.5a2.5 2.5 0 0 1 5 0V18M15.5 15h5',
    rolar: 'M12 4v14M7 13l5 5 5-5',
    pausa: 'M8 5v14M16 5v14',
    megafone: 'M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1zM16.5 9a4 4 0 0 1 0 6M7 14l1.5 5H11l-1-4.3',
    imagem: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM4 16l5-5 4 4 2-2 5 5M15.5 8.5h.01',
    lixeira: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    local: 'M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    whatsapp: 'M4 20l1.3-3.9A8 8 0 1 1 8 19zM9 9.5c.3 2.5 2.5 4.7 5 5l1.2-1.2 2 .9c-.3 1.4-1.4 2-2.8 1.8C11 15.5 8.5 13 8 10.6 7.8 9.2 8.4 8.1 9.8 7.8l.9 2z',
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
