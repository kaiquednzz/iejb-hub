// Entrar com Google (D33).
//
// No iPhone, com o app instalado, o Google abre num navegador por cima do app
// e, ao terminar, o endereço volta para app.iejb.com.br e a navegação volta
// para o app (comportamento do iOS desde a versão 12.2). Antes de pôr no ar
// para todos, isso foi testado no iPhone do Kaique.
import { supabase } from '../supabase.js';

const URL_SUPABASE = import.meta.env.VITE_SUPABASE_URL;
const CHAVE = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const ERRO_GUARDADO = 'iejb-hub-erro-login';

// O botão só aparece se o Google estiver ligado no painel do Supabase.
// Sem isso, tocar levaria a uma página de erro em JSON, sem volta para o app.
let promessaAtivo;
export function googleAtivo() {
    promessaAtivo ??= fetch(`${URL_SUPABASE}/auth/v1/settings`, { headers: { apikey: CHAVE } })
        .then((r) => (r.ok ? r.json() : {}))
        .then((config) => !!config.external?.google)
        .catch(() => false);
    return promessaAtivo;
}

export async function entrarComGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${location.origin}/`,
            // Sempre mostra a escolha de conta (celular com mais de uma conta Google)
            queryParams: { prompt: 'select_account' },
        },
    });
    if (error) throw error;
}

// Ao voltar do Google: tira ?code= / ?error= do endereço (não fica no
// histórico nem é salvo como atalho) e guarda o erro, se houver, para a
// tela de entrar mostrar.
export function limparRetornoDoGoogle() {
    const params = new URLSearchParams(location.search);
    if (!params.has('code') && !params.has('error')) return;
    const erro = params.get('error_description');
    if (erro) sessionStorage.setItem(ERRO_GUARDADO, erro);
    history.replaceState(null, '', location.pathname + location.hash);
}

export function erroDoGoogle() {
    const erro = sessionStorage.getItem(ERRO_GUARDADO);
    sessionStorage.removeItem(ERRO_GUARDADO);
    if (!erro) return null;
    if (/cancel|denied/i.test(erro)) return 'Login com Google cancelado.';
    return 'Não deu para entrar com Google. Tente de novo ou use e-mail e senha.';
}
