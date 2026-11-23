// Testes de fumaça: cada um abre uma tela como uma pessoa de verdade usaria
// e confere o essencial. Supabase simulado (simulador.js).
import { test, expect, umaConta } from './simulador.js';

// Nenhuma tela pode estourar erro no console
test.beforeEach(async ({ page }, info) => {
    info.erros = [];
    page.on('pageerror', (e) => info.erros.push(e.message));
});
test.afterEach(async ({ page }, info) => {
    expect(info.erros, 'erros de JavaScript na tela').toEqual([]);
    // "null", "false" ou "undefined" escritos na tela = condição sem filtro
    const texto = await page.locator('body').innerText();
    expect(texto, 'valor vazio vazou para a tela').not.toMatch(/\b(null|false|undefined)\b/);
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

test('quem publica edita o texto do aviso', async ({ page, simular }) => {
    await simular.abrir('#/inicio', umaConta({ cargos: ['comunicacao'] }), { mural_publicacao: [PUBLICACAO] });
    await page.getByRole('button', { name: 'Opções da publicação' }).click();
    await page.getByRole('button', { name: 'Editar o texto' }).click();
    await page.getByLabel('Título').fill('Cantata de Natal: mudou o horário');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect.poll(() => simular.chamadas.find((c) => c.tabela?.startsWith('mural_publicacao') && c.metodo === 'PATCH')?.corpo)
        .toMatchObject({ titulo: 'Cantata de Natal: mudou o horário', texto: 'Dia 20, às 18h.' });
});

test('oração fica no cabeçalho, ao lado do avatar', async ({ page, simular }) => {
    await simular.abrir('#/agenda', umaConta(), { rpc: { pastores_da_igreja: PASTORES } });
    await page.getByRole('link', { name: 'Pedidos de oração' }).click();
    await expect(page).toHaveURL(/#\/oracao$/);
    await expect(page.locator('.cabecalho-oracao')).toHaveCount(0); // na própria tela, some
});

test('pastor com pedido esperando vê o pontinho', async ({ page, simular }) => {
    const pedido = { id: 'o-1', texto: 'Oi.', anonimo: false, autor_nome: 'Ana', autor_apelido: null, autor_foto: null,
        criado_em: '2026-11-23T12:00:00Z', orado_em: null, orado_por_nome: null };
    await simular.abrir('#/agenda', umaConta({ cargos: ['pastor'] }), { rpc: { pedidos_de_oracao_para_mim: [pedido] } });
    await expect(page.locator('.cabecalho-oracao')).toHaveClass(/tem-pedido/);
    await expect(page.locator('.cabecalho-oracao')).toHaveAttribute('aria-label', 'Pedidos de oração: 1 esperando');
});

test('membro posta uma foto do último culto', async ({ page, simular }) => {
    const culto = { id: 'cu-1', nome: 'Culto da Família', data: '2026-11-22', horario: '18:00:00', ja_postei: false };
    await simular.abrir('#/inicio', umaConta(), { rpc: { culto_para_foto: [culto], postar_foto_do_culto: 'novo' } });
    await page.getByRole('button', { name: /Foi no Culto da Família\?/ }).click();
    await page.locator('#foto-membro').setInputFiles('public/icone-192.png');
    await page.getByLabel('Legenda').fill('Que culto!');
    await page.getByRole('button', { name: 'Postar' }).click();
    await expect.poll(() => simular.chamadas.find((c) => c.rpc === 'postar_foto_do_culto')?.args)
        .toMatchObject({ p_culto: 'cu-1', p_legenda: 'Que culto!', p_foto: expect.stringMatching(/^membros\/p-eu\/[0-9a-f-]{36}\.(webp|jpg)$/) });
    // Subiu a foto e a miniatura, na pasta da própria pessoa
    expect(simular.chamadas.filter((c) => c.storage?.includes('/object/mural/membros/p-eu/')).length).toBe(2);
});

test('quem já postou não vê o convite de novo', async ({ page, simular }) => {
    const culto = { id: 'cu-1', nome: 'Culto da Família', data: '2026-11-22', horario: '18:00:00', ja_postei: true };
    await simular.abrir('#/inicio', umaConta(), { mural_publicacao: [PUBLICACAO], rpc: { culto_para_foto: [culto] } });
    await expect(page.locator('.mural-cartao')).toHaveCount(1);
    await expect(page.getByRole('button', { name: /Foi no/ })).toHaveCount(0);
});

test('o autor da foto só edita a legenda e apaga', async ({ page, simular }) => {
    const minha = { ...PUBLICACAO, id: 'pub-m', tipo: 'fotos', titulo: null, texto: 'Que culto!', fixado_ate: null,
        fotos: ['membros/p-eu/44444444-4444-4444-4444-444444444444.webp'], de_membro: true, guardar: false,
        criado_por: 'p-eu', culto: { nome: 'Culto da Família' }, autor: { nome: 'Ana Souza', apelido: null, foto: null } };
    await simular.abrir('#/inicio', umaConta(), { mural_publicacao: [minha, PUBLICACAO] });
    await expect(page.locator('#mural-pub-m .mural-chapeu')).toHaveText('Foto · Culto da Família');
    await expect(page.getByRole('button', { name: 'Opções da publicação' })).toHaveCount(1); // só na dela
    await page.getByRole('button', { name: 'Opções da publicação' }).click();
    await expect(page.getByRole('button', { name: 'Fixar no topo' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Editar a legenda' }).click();
    await page.getByLabel('Legenda (opcional)').fill('Que culto abençoado!');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect.poll(() => simular.chamadas.find((c) => c.metodo === 'PATCH')?.corpo).toEqual({ texto: 'Que culto abençoado!' });
});

test('mostra quem reagiu', async ({ page, simular }) => {
    const comReacoes = { ...PUBLICACAO, mural_reacao: [
        { pessoa_id: 'a', tipo: 'amem', pessoa: { nome: 'Bia Lima', apelido: 'Bia', foto: null } },
        { pessoa_id: 'b', tipo: 'coracao', pessoa: { nome: 'João Pedro', apelido: null, foto: null } },
        { pessoa_id: 'a', tipo: 'coracao', pessoa: { nome: 'Bia Lima', apelido: 'Bia', foto: null } },
        { pessoa_id: 'c', tipo: 'amem', pessoa: { nome: 'Carla Dias', apelido: null, foto: null } },
    ] };
    await simular.abrir('#/inicio', umaConta(), { mural_publicacao: [comReacoes] });
    await expect(page.locator('.mural-quem-texto')).toHaveText('Bia, João e mais 1');
    await page.locator('.mural-amem, .reacao-amem').first().click(); // eu dou Amém: viro o primeiro
    await expect(page.locator('.mural-quem-texto')).toHaveText('Você, Bia e mais 2');
    await page.locator('.mural-quem').click();
    await expect(page.locator('.reagiram-grupo')).toHaveCount(2);
    await expect(page.locator('.reagiram-grupo').first()).toContainText('Carla');
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

test('o balão do tour nunca sai da tela, nem rolando', async ({ page, simular }) => {
    const longo = { ...PUBLICACAO, texto: 'Texto comprido. '.repeat(60) };
    await simular.abrir('#/inicio', umaConta(), { mural_publicacao: [longo, { ...PUBLICACAO, id: 'pub-2' }] }, { primeiraVez: true });
    await page.getByRole('button', { name: 'Me mostra' }).click();
    await page.locator('.tour-proximo').click();
    await expect(page.locator('.tour-titulo')).toHaveText('Mural');
    await page.waitForTimeout(700);
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(300);
    const caixa = await page.locator('.tour-balao').boundingBox();
    const tela = page.viewportSize();
    expect(caixa.y).toBeGreaterThanOrEqual(0);
    expect(caixa.y + caixa.height).toBeLessThanOrEqual(tela.height);
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
