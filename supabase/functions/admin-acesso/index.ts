// Função de servidor "admin-acesso": o que o banco sozinho não consegue fazer.
//
// Criar um usuário de login e trocar a senha de outra pessoa exigem a chave
// de serviço (service_role), que NUNCA pode ir para o app. Ela só existe aqui,
// no servidor do Supabase, injetada como variável de ambiente.
//
// Ações (corpo JSON):
//   { acao: 'criar_acesso',    pessoa_id, email, senha }   RN-10, caminho 1
//   { acao: 'redefinir_senha', conta_id, senha }           RN-65
// Nos dois casos a pessoa recebe senha TEMPORÁRIA e troca no primeiro login.
//
// Segurança em camadas:
//   1. Confere quem chamou pelo token (getUser), não pelo que veio no corpo.
//   2. Exige conta ativa, administradora, com pessoa ativa e sem senha temporária.
//   3. As marcações no banco (aprovar_conta, marcar_senha_temporaria) rodam
//      COM O TOKEN de quem chamou: o próprio banco confere de novo que é admin
//      e grava o nome certo no registro de auditoria.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function resposta(status: number, corpo: Record<string, unknown>) {
    return new Response(JSON.stringify(corpo), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}
const erro = (status: number, mensagem: string) => resposta(status, { erro: mensagem });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return erro(405, 'Método não permitido.');

    const url = Deno.env.get('SUPABASE_URL')!;
    const chaveServico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    // A chave pública que o app mandou (publishable). Serve para falar com o
    // banco "como a pessoa", com o token dela, sujeito ao RLS.
    const chavePublica = req.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY')!;
    if (!token) return erro(401, 'Entre no Hub de novo.');

    const sistema = createClient(url, chaveServico, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const comoQuemChamou = createClient(url, chavePublica, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Quem chamou?
    const { data: { user }, error: erroToken } = await sistema.auth.getUser(token);
    if (erroToken || !user) return erro(401, 'Sessão expirada. Entre no Hub de novo.');

    // 2. É administrador de verdade?
    const { data: eu } = await sistema
        .from('conta')
        .select('estado, e_administrador, senha_temporaria, pessoa:pessoa_id (ativa)')
        .eq('id', user.id)
        .maybeSingle();
    const pessoaAtiva = (eu?.pessoa as { ativa?: boolean } | null)?.ativa;
    if (!eu || eu.estado !== 'ativa' || !eu.e_administrador || eu.senha_temporaria || !pessoaAtiva) {
        return erro(403, 'Apenas administradores podem fazer isso.');
    }

    let corpo: Record<string, string>;
    try {
        corpo = await req.json();
    } catch {
        return erro(400, 'Pedido inválido.');
    }

    const senha = String(corpo.senha ?? '');
    if (senha.length < 8) return erro(400, 'A senha temporária precisa ter pelo menos 8 caracteres.');

    if (corpo.acao === 'criar_acesso') {
        const email = String(corpo.email ?? '').trim().toLowerCase();
        const pessoaId = String(corpo.pessoa_id ?? '');
        if (!EMAIL.test(email)) return erro(400, 'E-mail inválido.');

        const { data: pessoa } = await sistema
            .from('pessoa').select('id, nome, ativa').eq('id', pessoaId).maybeSingle();
        if (!pessoa || !pessoa.ativa) return erro(400, 'Pessoa não encontrada ou desativada.');
        const { count } = await sistema
            .from('conta').select('id', { count: 'exact', head: true }).eq('pessoa_id', pessoaId);
        if (count) return erro(409, 'Essa pessoa já tem acesso.');

        // O gatilho do banco cria a conta (pendente) junto com o usuário
        const { data: criado, error: erroCriar } = await sistema.auth.admin.createUser({
            email,
            password: senha,
            email_confirm: true, // o Hub não manda e-mail (RN-10)
            user_metadata: { nome: pessoa.nome },
        });
        if (erroCriar || !criado.user) {
            const jaExiste = /already|registered|exists/i.test(erroCriar?.message ?? '');
            return erro(jaExiste ? 409 : 400, jaExiste
                ? 'Já existe um acesso com esse e-mail. Veja em Pedidos se a pessoa já pediu.'
                : 'Não foi possível criar o acesso.');
        }

        const { error: erroAprovar } = await comoQuemChamou.rpc('aprovar_conta', {
            p_conta: criado.user.id, p_pessoa: pessoaId, p_senha_temporaria: true,
        });
        if (erroAprovar) {
            // Desfaz: não deixa um login solto sem pessoa
            await sistema.auth.admin.deleteUser(criado.user.id);
            return erro(400, erroAprovar.message);
        }
        return resposta(200, { ok: true });
    }

    if (corpo.acao === 'redefinir_senha') {
        const contaId = String(corpo.conta_id ?? '');
        if (contaId === user.id) return erro(400, 'Para trocar a sua senha, use a opção da sua conta.');

        const { data: alvo } = await sistema
            .from('conta').select('estado').eq('id', contaId).maybeSingle();
        if (!alvo || alvo.estado !== 'ativa') return erro(400, 'Conta não encontrada ou não está ativa.');

        const { error: erroSenha } = await sistema.auth.admin.updateUserById(contaId, { password: senha });
        if (erroSenha) return erro(400, 'Não foi possível trocar a senha.');

        // A troca de senha limpa a marca (gatilho); aqui ela volta: a pessoa
        // vai ter que escolher a própria senha no próximo login.
        const { error: erroMarcar } = await comoQuemChamou.rpc('marcar_senha_temporaria', { p_conta: contaId });
        if (erroMarcar) return erro(400, erroMarcar.message);
        return resposta(200, { ok: true });
    }

    return erro(400, 'Ação desconhecida.');
});
