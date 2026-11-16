// Recebe os avisos da CSP do app (Content-Security-Policy-Report-Only).
//
// Enquanto a CSP está "em teste", o navegador não bloqueia nada: só manda
// pra cá um aviso do que TERIA bloqueado. A função não guarda nada no banco,
// só escreve no log da função (Supabase > Edge Functions > csp > Logs).
// Quando o log passar uns dias vazio, a CSP pode passar a valer
// (CSP_VALENDO = true em app/vite.config.js).
//
// Aberta (verify_jwt desligado) porque o navegador manda o aviso sem token.
// Pior caso de abuso: alguém enche o log. Por isso corta o tamanho e não
// devolve nada.

Deno.serve(async (req) => {
    if (req.method !== 'POST') return new Response(null, { status: 405 });
    try {
        const texto = (await req.text()).slice(0, 2000);
        const corpo = JSON.parse(texto);
        // Formato antigo (report-uri): { "csp-report": {...} }
        const r = corpo['csp-report'] ?? corpo;
        console.log(JSON.stringify({
            diretiva: r['violated-directive'] ?? r['effective-directive'],
            bloqueado: r['blocked-uri'],
            pagina: r['document-uri'],
            linha: r['line-number'],
            amostra: r['script-sample'],
            navegador: (req.headers.get('user-agent') ?? '').slice(0, 160),
        }));
    } catch {
        console.log('aviso de CSP ilegível');
    }
    return new Response(null, { status: 204 });
});
