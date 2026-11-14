// Quem está usando o app e em que pé está a conta dele.
//
// Importante: isto aqui decide só QUAL TELA mostrar. Não é segurança.
// Mesmo que alguém altere o JS no navegador e force a tela da escala,
// o banco (RLS) devolve vazio para conta pendente. A tela é conveniência;
// a trava de verdade está no Postgres.
import { supabase } from './supabase.js';

export async function carregarConta(idUsuario) {
    const { data, error } = await supabase
        .from('conta')
        .select('id, login, estado, e_administrador, senha_temporaria, nome_informado, pessoa:pessoa_id (id, nome, apelido)')
        .eq('id', idUsuario)
        .maybeSingle();

    if (error) return { erro: error };
    // Não deveria acontecer: o gatilho criar_conta cria a linha junto com o usuário
    if (!data) return { erro: new Error('Conta não encontrada.') };
    return { conta: data };
}

// Como a pessoa quer ser chamada: apelido, senão o primeiro nome
export function nomeCurto(pessoa, reserva = '') {
    if (!pessoa) return reserva;
    return pessoa.apelido?.trim() || pessoa.nome.trim().split(/\s+/)[0];
}

// Traduz os erros do Supabase Auth que a pessoa pode ver
export function mensagemDeErro(erro) {
    const texto = erro?.message ?? '';
    if (/invalid login credentials/i.test(texto)) return 'E-mail ou senha incorretos.';
    if (/email not confirmed/i.test(texto)) return 'Este e-mail ainda não foi liberado. Fale com o administrador do Hub.';
    if (/user already registered/i.test(texto)) return 'Já existe um pedido com este e-mail. Tente entrar.';
    if (/password should be at least/i.test(texto)) return 'A senha precisa ter pelo menos 8 caracteres.';
    if (/different from the old password/i.test(texto)) return 'A nova senha precisa ser diferente da atual.';
    if (/rate limit|too many/i.test(texto)) return 'Muitas tentativas seguidas. Espere um pouco e tente de novo.';
    if (/fetch|network/i.test(texto)) return 'Sem conexão com o servidor. Confira sua internet.';
    return 'Algo deu errado. Tente de novo em instantes.';
}
