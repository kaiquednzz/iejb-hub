// Função de servidor "enviar-push" (D18, D25).
//
//   GET  → devolve a chave pública VAPID (o app precisa dela para se inscrever).
//   POST → entrega os avisos pendentes. Chamada a cada minuto pelo pg_cron,
//          só quando tem aviso esperando (privado.tem_push_pendente).
//
// Por que não exige login? Ela só entrega o que JÁ está na fila, e reservar
// é atômico (ninguém recebe duas vezes). Chamar à toa não vaza nada (a resposta
// é só um número) e não cria aviso nenhum.
//
// Chaves VAPID: geradas aqui na primeira chamada e guardadas em chave_push,
// que só a chave de serviço lê. A chave privada nunca sai do servidor.
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as webpush from 'jsr:@negrel/webpush@0.5';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (status: number, corpo: unknown) =>
    new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const sistema = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
});

const TITULOS: Record<string, string> = {
    escala_alterada: 'Escala do Louvor',
    repertorio_alterado: 'Repertório atualizado',
    culto_cancelado: 'Culto cancelado',
    solicitacao_nova: 'Pedido de alteração',
    solicitacao_decidida: 'Seu pedido de alteração',
};

// Lê o par de chaves; se ainda não existe, cria e guarda (uma vez na vida)
async function chaves(): Promise<{ par: CryptoKeyPair; publica: string }> {
    const { data } = await sistema.from('chave_push').select('publica, privada').eq('id', 1).maybeSingle();
    if (data) {
        return { par: await webpush.importVapidKeys(data.privada), publica: data.publica };
    }
    const par = await webpush.generateVapidKeys({ extractable: true });
    const publica = await webpush.exportApplicationServerKey(par);
    const privada = await webpush.exportVapidKeys(par);
    // "do nothing": se duas chamadas criarem ao mesmo tempo, vale a primeira
    await sistema.from('chave_push').upsert({ id: 1, publica, privada }, { onConflict: 'id', ignoreDuplicates: true });
    return chaves();
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    try {
        const { par, publica } = await chaves();
        if (req.method === 'GET') return json(200, { chave: publica });
        if (req.method !== 'POST') return json(405, { erro: 'Método não permitido.' });

        const { data: entregas, error } = await sistema.rpc('reservar_pushes', { p_limite: 200 });
        if (error) throw error;
        if (!entregas?.length) return json(200, { enviados: 0 });

        const servidor = await webpush.ApplicationServer.new({
            contactInformation: 'https://app.iejb.com.br',
            vapidKeys: par,
        });

        let enviados = 0;
        await Promise.all(entregas.map(async (e: Record<string, string>) => {
            const mensagem = JSON.stringify({
                titulo: TITULOS[e.tipo] ?? 'IEJB Hub',
                corpo: e.resumo,
                url: '/#/escala',
                // Mesma escala = mesma notificação: a mais nova substitui a antiga
                tag: e.escala_id ? `escala-${e.escala_id}` : e.tipo,
            });
            try {
                await servidor.subscribe({
                    endpoint: e.endpoint,
                    keys: { p256dh: e.chave_p256dh, auth: e.chave_auth },
                }).pushTextMessage(mensagem, {
                    ttl: 60 * 60 * 24, // se o celular estiver desligado, entrega em até 1 dia
                    // deno-lint-ignore no-explicit-any
                    urgency: 'high' as any,
                } as webpush.PushMessageOptions);
                enviados++;
            } catch (erro) {
                if (erro instanceof webpush.PushMessageError && erro.isGone()) {
                    // Inscrição não existe mais (app desinstalado, permissão tirada)
                    await sistema.from('dispositivo_push').update({ ativo: false }).eq('id', e.dispositivo_id);
                } else {
                    await sistema.from('aviso_destinatario')
                        .update({ push_erro: String(erro).slice(0, 300) }).eq('id', e.destinatario_id);
                }
            }
        }));
        return json(200, { enviados, tentativas: entregas.length });
    } catch (erro) {
        console.error(erro);
        return json(500, { erro: 'Falha ao enviar.' });
    }
});
