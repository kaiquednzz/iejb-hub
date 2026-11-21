// Imagem da escala do mês para o WhatsApp (redesign v2, fase 2).
// Desenhada num <canvas> no próprio celular, no layout de boletim: faixa da
// IEJB, "Escala de Novembro" em Playfair itálica, uma linha por culto (data,
// nome, grupos, mesa) com filetes finos. 1080 × 1350 (4:5): o tamanho que o
// WhatsApp e o status mostram inteiro. Nenhum dado sai do celular para gerar.
const L = 1080;
const A = 1350;
const VERMELHO = '#8F0D0B';
const CREME = '#FDFAF5';
const TINTA = '#1F1513';
const TINTA_2 = '#5C5150';
const FILETE = '#E6DACB';
const DIA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const TEXTO = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Arial, sans-serif';

// linhas: [{ data: 'AAAA-MM-DD', titulo, detalhe, cancelado }]
export async function desenharEscalaDoMes({ mes, linhas }) {
    // A fonte precisa estar carregada antes de desenhar no canvas
    await Promise.all([
        document.fonts.load('700 96px "Playfair Display"'),
        document.fonts.load('italic 700 96px "Playfair Display"'),
    ]).catch(() => {});

    const c = document.createElement('canvas');
    c.width = L;
    c.height = A;
    const g = c.getContext('2d');
    g.fillStyle = CREME;
    g.fillRect(0, 0, L, A);

    // Faixa vermelha do topo
    g.fillStyle = VERMELHO;
    g.fillRect(0, 0, L, 300);
    g.fillStyle = 'rgba(255,255,255,0.82)';
    g.font = `600 30px ${TEXTO}`;
    espacado(g, 'IEJB · MINISTÉRIO DE LOUVOR', 80, 108, 4);
    g.fillStyle = '#fff';
    g.font = 'italic 700 104px "Playfair Display", Georgia, serif';
    g.fillText(`Escala de ${mes}`, 76, 232, L - 152);

    // Linhas do mês: altura dividida pelo espaço disponível
    const topo = 360;
    const base = A - 150;
    const n = Math.max(linhas.length, 1);
    const altura = Math.min(132, (base - topo) / n);
    const escala = altura / 132;
    linhas.forEach((linha, i) => {
        const y = topo + i * altura;
        if (i > 0) { g.fillStyle = FILETE; g.fillRect(80, y, L - 160, 2); }
        const d = new Date(`${linha.data}T12:00:00Z`);
        const meio = y + altura / 2;
        // Data: dia grande + dia da semana
        g.fillStyle = linha.cancelado ? TINTA_2 : VERMELHO;
        g.font = `700 ${Math.round(64 * escala)}px "Playfair Display", Georgia, serif`;
        g.textAlign = 'center';
        g.fillText(String(d.getUTCDate()).padStart(2, '0'), 140, meio + 6 * escala);
        g.font = `600 ${Math.round(22 * escala)}px ${TEXTO}`;
        g.fillText(DIA[d.getUTCDay()], 140, meio + 38 * escala);
        g.textAlign = 'left';
        // Título e detalhe
        g.fillStyle = linha.cancelado ? TINTA_2 : TINTA;
        g.font = `600 ${Math.round(40 * escala)}px ${TEXTO}`;
        g.fillText(linha.titulo, 240, meio - 4 * escala, L - 320);
        if (linha.cancelado) {
            const w = Math.min(g.measureText(linha.titulo).width, L - 320);
            g.fillRect(240, meio - 18 * escala, w, 3);
        }
        g.fillStyle = TINTA_2;
        g.font = `400 ${Math.round(30 * escala)}px ${TEXTO}`;
        g.fillText(linha.detalhe, 240, meio + 36 * escala, L - 320);
    });

    // Rodapé
    g.fillStyle = FILETE;
    g.fillRect(80, A - 120, L - 160, 2);
    g.fillStyle = TINTA_2;
    g.font = `400 28px ${TEXTO}`;
    g.fillText('Quem toca o quê e o repertório: app.iejb.com.br', 80, A - 64);

    return new Promise((ok) => c.toBlob(ok, 'image/png'));
}

function espacado(g, texto, x, y, espaco) {
    for (const letra of texto) {
        g.fillText(letra, x, y);
        x += g.measureText(letra).width + espaco;
    }
}

// Compartilha a imagem (no celular abre a lista com o WhatsApp); sem esse
// recurso (computador), baixa o arquivo.
export async function compartilharImagem(blob, nome, texto) {
    const arquivo = new File([blob], nome, { type: 'image/png' });
    if (navigator.canShare?.({ files: [arquivo] })) {
        try {
            await navigator.share({ files: [arquivo], text: texto });
            return 'compartilhada';
        } catch (erro) {
            if (erro.name === 'AbortError') return 'cancelada';
        }
    }
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: nome });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return 'baixada';
}
