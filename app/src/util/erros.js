// Traduz erros do banco e da função de servidor para algo que dá para mostrar.
//
// As mensagens que NÓS escrevemos no SQL (raise exception 'Só contas ...') já
// estão em português e são feitas para a pessoa ler. As do próprio Postgres
// ("duplicate key value violates...") não: essas viram um texto genérico.
import { eErroDeRede } from '../offline.js';

const NOSSAS = new Set(['P0001', '23514', '42501', '22023']); // raise exception, check_violation, insufficient_privilege, valor inválido (nossos)

export function mensagemDoBanco(erro, reserva = 'Não deu certo. Tente de novo.') {
    if (!erro) return reserva;
    if (eErroDeRede(erro)) return 'Sem conexão. Confira sua internet e tente de novo.';
    if (NOSSAS.has(erro.code) && erro.message) return erro.message;
    if (erro.code === '23505') return 'Isso já está cadastrado.';
    if (erro.code === '23503') return 'Não dá: isso ainda está sendo usado em outro lugar.';
    if (/row-level security/i.test(erro.message ?? '')) return 'Você não tem permissão para fazer isso.';
    return reserva;
}

// Erro de supabase.functions.invoke: a mensagem útil vem no corpo da resposta
export async function mensagemDaFuncao(erro) {
    try {
        const corpo = await erro.context?.json();
        if (corpo?.erro) return corpo.erro;
    } catch { /* corpo não era JSON */ }
    if (/fetch|network/i.test(erro?.message ?? '')) return 'Sem conexão. Confira sua internet e tente de novo.';
    return 'Não deu certo. Tente de novo.';
}
