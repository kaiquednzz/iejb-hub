// Dinheiro no financeiro: o banco guarda CENTAVOS (inteiro). A tela mostra e
// lê em reais. Nunca se faz conta com número quebrado (0,1 + 0,2 ≠ 0,3).

const REAIS = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const reais = (centavos) => REAIS.format((Number(centavos) || 0) / 100);

// "1.234,56", "1234,5", "50", "R$ 12,00" → centavos. Inválido → null.
export function lerReais(texto) {
    const limpo = String(texto ?? '').replace(/[R$\s]/g, '');
    if (!limpo) return null;
    // Com vírgula: padrão brasileiro (ponto é milhar). Sem vírgula: ponto pode ser decimal.
    const normal = limpo.includes(',')
        ? limpo.replace(/\./g, '').replace(',', '.')
        : (/^\d+\.\d{1,2}$/.test(limpo) ? limpo : limpo.replace(/\./g, ''));
    if (!/^\d+(\.\d{1,2})?$/.test(normal)) return null;
    const [inteiro, decimal = ''] = normal.split('.');
    return Number(inteiro) * 100 + Number(decimal.padEnd(2, '0'));
}

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const nomeDoMes = (iso) => {
    const [a, m] = iso.split('-').map(Number);
    const nome = MESES[m - 1];
    return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${a}`;
};
export const primeiroDoMes = (iso) => `${iso.slice(0, 7)}-01`;
export function somarMeses(iso, n) {
    const [a, m] = iso.split('-').map(Number);
    const d = new Date(Date.UTC(a, m - 1 + n, 1));
    return d.toISOString().slice(0, 10);
}
export const dataCurta = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export const FORMAS = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão', transferencia: 'TED/transferência', boleto: 'Boleto', outro: 'Outro' };

export const nomeDe = (pessoa) => pessoa?.apelido || pessoa?.nome?.split(' ')[0] || 'Alguém';
