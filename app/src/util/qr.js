// QR code desenhado como SVG (D61).
//
// A biblioteca (qrcode-generator, MIT, sem dependências) só calcula quais
// quadradinhos são pretos; o desenho é nosso, com createElementNS, sem
// innerHTML (regra do app) e sem imagem data: (a CSP fica mais simples).
// Margem de 4 módulos em branco em volta: é o mínimo que o padrão pede para a
// câmera achar o código.
import qrcode from 'qrcode-generator';

export function qrSvg(texto, rotulo) {
    const qr = qrcode(0, 'M'); // tamanho automático; correção média (aguenta tela com reflexo)
    qr.addData(texto);
    qr.make();
    const n = qr.getModuleCount();
    const margem = 4;
    const lado = n + margem * 2;
    let d = '';
    for (let l = 0; l < n; l++) {
        for (let c = 0; c < n; c++) {
            if (qr.isDark(l, c)) d += `M${c + margem} ${l + margem}h1v1h-1z`;
        }
    }
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${lado} ${lado}`);
    svg.setAttribute('class', 'qr');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', rotulo);
    svg.setAttribute('shape-rendering', 'crispEdges');
    const fundo = document.createElementNS(ns, 'rect');
    fundo.setAttribute('width', lado);
    fundo.setAttribute('height', lado);
    fundo.setAttribute('fill', '#fff');
    const quadrados = document.createElementNS(ns, 'path');
    quadrados.setAttribute('d', d);
    quadrados.setAttribute('fill', '#1d1d1f');
    svg.append(fundo, quadrados);
    return svg;
}
