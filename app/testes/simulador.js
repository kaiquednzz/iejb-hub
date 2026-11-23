// Supabase de mentira para os testes: responde as chamadas do app com dados
// fixos e guarda o que o app mandou (chamadas), para o teste conferir.
//
// Tabela: dados[nome] (lista). Função (rpc): dados.rpc[nome] (valor ou
// função que recebe os argumentos). O que não estiver nos dados volta vazio.
import { test as base, expect } from '@playwright/test';

const PROJETO = 'hqalztygktkabwybmdyl';
export const HOJE = '2026-11-23T15:00:00-03:00';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function sessao(id) {
    const exp = Math.floor(Date.now() / 1000) + 10 * 365 * 86400;
    const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: id, exp, role: 'authenticated', aal: 'aal1' })}.assinatura`;
    return { access_token: token, refresh_token: 'r', token_type: 'bearer', expires_in: exp, expires_at: exp,
        user: { id, email: `${id}@teste`, aud: 'authenticated', role: 'authenticated' } };
}

// Uma conta pronta: membro (sem área), com ministério, cargos, admin...
export function umaConta({ nome = 'Ana Souza', apelido = null, admin = false, louvor = false, lider = false, cargos = [], aniversario = null } = {}) {
    const pessoa = {
        id: 'p-eu', nome, apelido, foto: null,
        aniversario_dia: aniversario?.[0] ?? null, aniversario_mes: aniversario?.[1] ?? null,
        membro_ministerio: louvor ? [{ e_lider: lider, ativo: true }] : [],
        cargo_pessoa: cargos.map((cargo) => ({ cargo })),
    };
    return { id: 'c-eu', login: 'ana@teste', estado: 'ativa', e_administrador: admin, senha_temporaria: false,
        nome_informado: nome, apresentou_em: '2026-11-01T10:00:00Z', foto_informada: null, criado_em: '2026-11-01T10:00:00Z', pessoa };
}

export const test = base.extend({
    simular: async ({ page }, usar) => {
        const chamadas = [];
        let dados = {};
        const responder = (rota, corpo, status = 200) =>
            rota.fulfill({ status, contentType: 'application/json', body: JSON.stringify(corpo) });

        await page.clock.install({ time: new Date(HOJE) });
        // App "instalado" (no celular o Hub pede para instalar antes de entrar)
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'standalone', { get: () => true });
            const mm = window.matchMedia.bind(window);
            window.matchMedia = (q) => (q.includes('standalone')
                ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }
                : mm(q));
        });

        await page.route(`https://${PROJETO}.supabase.co/**`, async (rota) => {
            const req = rota.request();
            const url = new URL(req.url());
            const caminho = url.pathname;
            const metodo = req.method();
            const corpo = req.postDataJSON?.() ?? null;

            if (caminho.startsWith('/auth/v1/')) {
                if (caminho.endsWith('/user')) return responder(rota, sessao(dados.conta.id).user);
                return responder(rota, sessao(dados.conta.id));
            }
            if (caminho.startsWith('/functions/v1/')) return responder(rota, { chave: 'BCHAVE' });
            if (caminho.startsWith('/storage/v1/')) {
                chamadas.push({ storage: caminho, metodo });
                if (caminho.includes('/object/sign/')) return responder(rota, (corpo?.paths ?? []).map((p) => ({ path: p, signedURL: `/object/sign/x/${p}?t=1` })));
                return responder(rota, { Key: 'ok' });
            }
            const rest = caminho.replace('/rest/v1/', '');
            if (rest.startsWith('rpc/')) {
                const nome = rest.slice(4);
                chamadas.push({ rpc: nome, args: corpo });
                const v = dados.rpc?.[nome];
                return responder(rota, typeof v === 'function' ? v(corpo) : (v ?? null));
            }
            if (metodo !== 'GET' && metodo !== 'HEAD') {
                chamadas.push({ tabela: rest, metodo, corpo, filtro: url.search });
                return rota.fulfill({ status: metodo === 'POST' ? 201 : 204, body: '' });
            }
            if (rest === 'conta') {
                // A conta da sessão (select único) ou a lista de pedidos (admin)
                const unica = url.searchParams.get('id') || url.searchParams.get('select')?.includes('pessoa:pessoa_id');
                return responder(rota, unica ? [dados.conta] : (dados.pedidos ?? []));
            }
            const lista = dados[rest] ?? [];
            const umSo = (req.headers().accept ?? '').includes('vnd.pgrst.object');
            if (metodo === 'HEAD') return rota.fulfill({ status: 200, headers: { 'content-range': `0-0/${lista.length}` }, body: '' });
            return responder(rota, umSo ? (lista[0] ?? null) : lista);
        });

        await usar({
            chamadas,
            // Abre o app já logado com essa conta e esses dados
            async abrir(hash, conta, outros = {}, { primeiraVez = false } = {}) {
                dados = { conta, ...outros };
                await page.addInitScript(([chave, valor, contaId, tour]) => {
                    localStorage.setItem(chave, valor);
                    localStorage.setItem('iejb-agenda-assinada', '1');
                    sessionStorage.setItem('iejb-abriu', '1');
                    if (!tour) localStorage.setItem(`iejb-tour-v2-visto-${contaId}`, 'x');
                }, [`sb-${PROJETO}-auth-token`, JSON.stringify(sessao(conta.id)), conta.id, primeiraVez]);
                await page.goto(`/${hash}`);
            },
        });
    },
});

export { expect };
