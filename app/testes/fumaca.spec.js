// Testes de fumaça: cada um abre uma tela como uma pessoa de verdade usaria
// e confere o essencial. Supabase simulado (simulador.js).
import { test, expect, umaConta } from './simulador.js';

// Nenhuma tela pode estourar erro no console
test.beforeEach(async ({ page }, info) => {
    info.erros = [];
    page.on('pageerror', (e) => info.erros.push(e.message));
});
test.afterEach(async ({}, info) => {
    expect(info.erros, 'erros de JavaScript na tela').toEqual([]);
});

const PUBLICACAO = {
    id: 'pub-1', tipo: 'aviso', titulo: 'Cantata de Natal', texto: 'Dia 20, às 18h.', referencia: null, fotos: [],
    fixado_ate: '2026-12-20', criado_em: '2026-11-22T12:00:00Z', criado_por: 'p-com',
    autor: { nome: 'Bia Lima', apelido: 'Bia', foto: null }, mural_reacao: [],
};
const PASTORES = [
    { id: 'pr-1', nome: 'Rodrigo Alves', apelido: 'Pr. Rodrigo', foto: null },
    { id: 'pr-2', nome: 'Marcos Lima', apelido: 'Pr. Marcos', foto: null },
];

test('membro sem área: Início abre no mural, sem cartão de escala', async ({ page, simular }) => {
    await simular.abrir('#/inicio', umaConta(), { mural_publicacao: [PUBLICACAO] });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Boa tarde, Ana/);
    await expect(page.locator('.mural-cartao')).toContainText('Cantata de Natal');
    await expect(page.locator('.inicio-compromisso')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Publicar' })).toHaveCount(0); // membro não publica
});

test('reagir com Amém grava a reação', async ({ page, simular }) => {
    await simular.abrir('#/inicio', umaConta(), { mural_publicacao: [PUBLICACAO] });
    const amem = page.locator('.reacao-amem');
    await amem.click();
    await expect(amem).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => simular.chamadas.find((c) => c.tabela?.startsWith('mural_reacao'))?.corpo)
        .toMatchObject({ publicacao_id: 'pub-1', tipo: 'amem' });
});

test('Comunicação publica um aviso no mural', async ({ page, simular }) => {
    await simular.abrir('#/inicio', umaConta({ cargos: ['comunicacao'] }), { rpc: { publicar_no_mural: 'novo' } });
    await page.getByRole('button', { name: 'Publicar' }).click();
    await page.getByLabel('Título').fill('Mutirão de limpeza');
    await page.locator('.mural-form button[type=submit]').click();
    await expect.poll(() => simular.chamadas.find((c) => c.rpc === 'publicar_no_mural')?.args)
        .toMatchObject({ p_tipo: 'aviso', p_titulo: 'Mutirão de limpeza', p_avisar: false });
});

test('primeira vez: boas-vindas e tour, uma vez só', async ({ page, simular }) => {
    await simular.abrir('#/inicio', umaConta(), {}, { primeiraVez: true });
    await page.getByRole('button', { name: 'Me mostra' }).click();
    const proximo = page.locator('.tour-proximo');
    await expect(page.locator('.tour-titulo')).toHaveText('Início');
    while (await proximo.textContent() !== 'Entendi') await proximo.click();
    await proximo.click();
    await expect(page.locator('dialog.tour')).toHaveCount(0);
    await expect(page.locator('dialog')).toHaveCount(0); // nada de pergunta extra no fim
    await page.reload();
    await expect(page.getByRole('button', { name: 'Me mostra' })).toHaveCount(0);
});

test('aniversário se põe em Você', async ({ page, simular }) => {
    await simular.abrir('#/voce', umaConta());
    await page.getByRole('button', { name: /Aniversário/ }).click();
    await page.locator('#aniv-dia').selectOption('15');
    await page.locator('#aniv-mes').selectOption('3');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect.poll(() => simular.chamadas.find((c) => c.rpc === 'definir_meu_aniversario')?.args).toEqual({ p_dia: 15, p_mes: 3 });
    await expect(page.getByRole('button', { name: /Aniversário/ })).toContainText('15 de março');
});

test('pedir oração escolhendo o pastor, sem nome', async ({ page, simular }) => {
    await simular.abrir('#/oracao', umaConta(), { rpc: { pastores_da_igreja: PASTORES, pedir_oracao: 'novo' } });
    await page.getByRole('button', { name: /Pr\. Rodrigo/ }).click();
    await page.getByLabel('Seu pedido').fill('Pela minha família.');
    await page.getByRole('switch', { name: /Não mostrar meu nome/ }).click();
    await page.getByRole('button', { name: 'Mandar pedido' }).click();
    await expect.poll(() => simular.chamadas.find((c) => c.rpc === 'pedir_oracao')?.args)
        .toEqual({ p_texto: 'Pela minha família.', p_pastores: ['pr-1'], p_anonimo: true });
});

test('com um pastor só, ele já vem escolhido', async ({ page, simular }) => {
    await simular.abrir('#/oracao', umaConta(), { rpc: { pastores_da_igreja: PASTORES.slice(0, 1), pedir_oracao: 'novo' } });
    await expect(page.getByRole('button', { name: /Pr\. Rodrigo/ })).toHaveAttribute('aria-pressed', 'true');
});

test('pastor vê o pedido sem nome e marca que orou', async ({ page, simular }) => {
    const pedido = { id: 'o-1', texto: 'Pelo emprego.', anonimo: true, autor_nome: null, autor_apelido: null, autor_foto: null,
        criado_em: '2026-11-23T12:00:00Z', orado_em: null, orado_por_nome: null };
    await simular.abrir('#/oracao', umaConta({ cargos: ['pastor'] }), { rpc: { pedidos_de_oracao_para_mim: [pedido], pastores_da_igreja: [] } });
    await expect(page.locator('.oracao-quem-nome')).toHaveText('Sem nome');
    await page.getByRole('button', { name: 'Orei por você' }).click();
    await expect.poll(() => simular.chamadas.find((c) => c.rpc === 'marcar_orei')?.args).toEqual({ p_pedido: 'o-1' });
});

test('admin abre o QR de convite', async ({ page, simular }) => {
    await simular.abrir('#/pessoas', umaConta({ admin: true }), { pessoa: [] });
    await page.getByRole('button', { name: 'Convidar com QR' }).click();
    await expect(page.getByRole('img', { name: /QR code do convite/ })).toBeVisible();
    await expect(page.locator('.convite-link')).toContainText('?convite=1');
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog.convite')).toHaveCount(0);
});

test('aniversário de amanhã aparece no Início', async ({ page, simular }) => {
    await simular.abrir('#/inicio', umaConta(), {
        pessoa: [{ id: 'p-2', nome: 'João Pedro', apelido: null, foto: null, aniversario_dia: 24, aniversario_mes: 11 }],
    });
    await expect(page.locator('.aniversario-faixa')).toContainText('Amanhã é aniversário de João!');
});

test('as quatro abas abrem, cada uma com um só título principal', async ({ page, simular }) => {
    await simular.abrir('#/inicio', umaConta({ louvor: true }));
    for (const [aba, rota] of [['Agenda', '#/agenda'], ['Ministérios', '#/ministerios'], ['Você', '#/voce'], ['Início', '#/inicio']]) {
        await page.locator('.barra-abas').getByRole('link', { name: aba }).click();
        await expect(page).toHaveURL(new RegExp(`${rota}$`));
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.locator('.barra-abas [aria-current="page"]')).toContainText(aba);
    }
});

test('botões de WhatsApp são só o logo, com nome para leitor de tela', async ({ page, simular }) => {
    await simular.abrir('#/inicio', umaConta(), { mural_publicacao: [PUBLICACAO] });
    const whats = page.locator('.mural-whats');
    await expect(whats).toHaveAttribute('aria-label', 'Mandar no WhatsApp');
    await expect(whats).toHaveText('');
});
