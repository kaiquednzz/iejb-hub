// Configuração do Vite. O único extra é o plugin de cabeçalhos de segurança.
//
// O Cloudflare (Workers com arquivos estáticos) lê dist/_headers e manda
// esses cabeçalhos em cada resposta. O arquivo é GERADO aqui no build, e não
// escrito à mão, por causa da CSP: o index.html tem um <style> e um <script>
// inline (a abertura precisa aparecer antes de qualquer arquivo baixar), e a
// CSP só libera inline pelo hash exato do conteúdo. Se alguém mexer na
// abertura, o hash muda sozinho no próximo build. Escrito à mão, ficaria
// velho e a abertura quebraria sem ninguém perceber.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';

// Enquanto CSP_VALENDO for false, a CSP vai como "Report-Only": o navegador
// só avisa no console o que ela bloquearia, sem bloquear. Depois de uns dias
// sem aviso nenhum, troca pra true e a CSP passa a valer de verdade.
// (Na prévia local ela já vale, pra pegar erro antes de subir.)
const CSP_VALENDO = false;

const hash = (texto) => `'sha256-${createHash('sha256').update(texto).digest('base64')}'`;
const inlines = (html, tag) => [...html.matchAll(new RegExp(`<${tag}(?![^>]*\\bsrc=)[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))]
    .map((m) => m[1]).filter((c) => c.trim());

function politica(html, supabase) {
    const host = new URL(supabase).host;
    return [
        "default-src 'self'",
        `script-src 'self' ${inlines(html, 'script').map(hash).join(' ')}`,
        `style-src 'self' ${inlines(html, 'style').map(hash).join(' ')}`,
        // Fotos da equipe e imagens de evento (Storage) e as que vêm do site
        `img-src 'self' data: blob: https://${host} https://iejb.com.br`,
        "font-src 'self'",
        // Banco/Auth/funções; e a checagem de senha vazada (util/senha.js)
        `connect-src 'self' https://${host} wss://${host} https://api.pwnedpasswords.com`,
        "worker-src 'self'",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        // Enquanto está em teste, cada aviso vai pro log da função `csp`
        ...(CSP_VALENDO ? [] : [`report-uri https://${host}/functions/v1/csp`]),
    ].join('; ');
}

function cabecalhos(html, supabase, valendo) {
    return {
        [valendo ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only']: politica(html, supabase),
        // Ninguém pode pôr o Hub dentro de um iframe (clickjacking). Vale já,
        // independente da CSP estar em teste.
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Cross-Origin-Opener-Policy': 'same-origin',
    };
}

function cabecalhosDeSeguranca(supabase) {
    let gerados = null;
    const ler = (dir) => readFileSync(resolve(dir, 'index.html'), 'utf8');
    return {
        name: 'iejb-cabecalhos',
        writeBundle(opcoes) {
            const c = cabecalhos(ler(opcoes.dir), supabase, CSP_VALENDO);
            const linhas = ['/*', ...Object.entries(c).map(([k, v]) => `  ${k}: ${v}`),
                // Arquivos com hash no nome nunca mudam: cache de um ano
                '', '/assets/*', '  Cache-Control: public, max-age=31536000, immutable',
                // O service worker tem que ser conferido sempre
                '', '/sw.js', '  Cache-Control: no-cache', ''];
            writeFileSync(resolve(opcoes.dir, '_headers'), linhas.join('\n'));
        },
        // `vite preview` não lê _headers: aplica os mesmos cabeçalhos aqui,
        // com a CSP VALENDO, pra qualquer bloqueio aparecer no teste local.
        configurePreviewServer(server) {
            server.middlewares.use((req, res, next) => {
                gerados ??= cabecalhos(ler(server.config.build.outDir), supabase, true);
                for (const [k, v] of Object.entries(gerados)) {
                    if (k !== 'Strict-Transport-Security') res.setHeader(k, v);
                }
                next();
            });
        },
    };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd());
    return { plugins: [cabecalhosDeSeguranca(env.VITE_SUPABASE_URL)] };
});
