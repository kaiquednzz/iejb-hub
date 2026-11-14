// Notificações push no aparelho (D18, D25).
//
// No iPhone o push só existe com o app instalado na tela de início (iOS 16.4+),
// e a permissão só pode ser pedida num toque da pessoa. Por isso não pedimos
// sozinhos ao abrir: a tela mostra um cartão "Ativar avisos".
import { supabase } from '../supabase.js';

const CHAVE_LOCAL = 'iejb-hub-chave-push';

export function suportaPush() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// 'sem-suporte' | 'negado' | 'ativo' | 'pode-ativar'
export function estadoDoPush() {
    if (!suportaPush()) return 'sem-suporte';
    if (Notification.permission === 'denied') return 'negado';
    if (Notification.permission === 'granted') return 'ativo';
    return 'pode-ativar';
}

// Pede a permissão (precisa vir de um toque) e inscreve o aparelho.
// Devolve 'granted', 'denied' ou 'default' (fechou a pergunta sem responder).
export async function ativarPush() {
    const resposta = await Notification.requestPermission();
    if (resposta === 'granted') await inscrever();
    return resposta;
}

// Ao abrir o app com permissão dada: garante que a inscrição existe e está
// registrada na conta logada (o navegador pode trocar o endereço de push).
export async function sincronizarPush() {
    if (estadoDoPush() !== 'ativo') return;
    try { await inscrever(); } catch (erro) { console.warn('Push:', erro); }
}

// Ao sair da conta: este aparelho para de receber os avisos dela
export async function removerAparelho() {
    if (!suportaPush()) return;
    try {
        const registro = await navigator.serviceWorker.getRegistration();
        const inscricao = await registro?.pushManager.getSubscription();
        if (!inscricao) return;
        await supabase.from('dispositivo_push').delete().eq('endpoint', inscricao.endpoint);
        await inscricao.unsubscribe();
    } catch (erro) {
        console.warn('Push:', erro);
    }
}

async function inscrever() {
    const registro = await navigator.serviceWorker.ready;
    let inscricao = await registro.pushManager.getSubscription();
    if (!inscricao) {
        inscricao = await registro.pushManager.subscribe({
            userVisibleOnly: true, // obrigatório: todo push vira notificação visível
            applicationServerKey: base64UrlParaBytes(await chavePublica()),
        });
    }
    const { endpoint, keys } = inscricao.toJSON();
    const { error } = await supabase.rpc('registrar_aparelho', {
        p_endpoint: endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth,
    });
    if (error) throw error;
}

async function chavePublica() {
    const guardada = localStorage.getItem(CHAVE_LOCAL);
    if (guardada) return guardada;
    const { data, error } = await supabase.functions.invoke('enviar-push', { method: 'GET' });
    if (error || !data?.chave) throw error ?? new Error('Sem chave de push');
    localStorage.setItem(CHAVE_LOCAL, data.chave);
    return data.chave;
}

function base64UrlParaBytes(texto) {
    const base64 = (texto + '='.repeat((4 - (texto.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}
