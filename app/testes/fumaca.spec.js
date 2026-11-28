// Testes de fumaça: cada um abre uma tela como uma pessoa de verdade usaria
// e confere o essencial. Supabase simulado (simulador.js).
import { test, expect, umaConta, MINISTERIOS, LOUVOR, KIDS } from './simulador.js';

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
    await simular.abrir('#/agenda', umaConta({ titulo: 'pastor' }), { rpc: { pedidos_de_oracao_para_mim: [pedido] } });
    await expect(page.locator('.cabecalho-oracao')).toHaveClass(/tem-pedido/);
    await expect(page.locator('.cabecalho-oracao')).toHaveAttribute('aria-label', 'Pedidos de oração: 1 esperando');
});

test('membro compartilha uma foto depois do culto', async ({ page, simular }) => {
    const espaco = { pode: true, volta_em: '2026-11-29', culto_recente: 'Culto da Família' };
    await simular.abrir('#/inicio', umaConta(), { rpc: { posso_compartilhar: [espaco], compartilhar_no_mural: 'novo' } });
    await page.getByRole('button', { name: /Foi no Culto da Família\?/ }).click();
    await page.locator('#foto-membro').setInputFiles('public/icone-192.png');
    await page.getByLabel('Legenda (opcional)').fill('Que culto!');
    await page.locator('form').getByRole('button', { name: 'Compartilhar' }).click();
    await expect.poll(() => simular.chamadas.find((c) => c.rpc === 'compartilhar_no_mural')?.args)
        .toMatchObject({ p_tipo: 'fotos', p_texto: 'Que culto!', p_referencia: null, p_foto: expect.stringMatching(/^membros\/p-eu\/[0-9a-f-]{36}\.(webp|jpg)$/) });
    // Subiu a foto e a miniatura, na pasta da própria pessoa
    expect(simular.chamadas.filter((c) => c.storage?.includes('/object/mural/membros/p-eu/')).length).toBe(2);
});

test('membro compartilha uma palavra, sem culto recente', async ({ page, simular }) => {
    const espaco = { pode: true, volta_em: '2026-11-29', culto_recente: null };
    await simular.abrir('#/inicio', umaConta(), { rpc: { posso_compartilhar: [espaco], compartilhar_no_mural: 'novo' } });
    await expect(page.getByRole('button', { name: /Foi no/ })).toHaveCount(0);
    await page.locator('.mural-publicar').click();
    await page.getByRole('tab', { name: 'Palavra' }).click();
    await expect(page.locator('#compartilhar-texto')).toHaveAttribute('maxlength', '280');
    await page.getByLabel('Versículo ou mensagem').fill('O Senhor é o meu pastor; nada me faltará.');
    await page.getByLabel('Referência (opcional)').fill('Salmo 23:1');
    await page.locator('form').getByRole('button', { name: 'Compartilhar' }).click();
    await expect.poll(() => simular.chamadas.find((c) => c.rpc === 'compartilhar_no_mural')?.args)
        .toMatchObject({ p_tipo: 'palavra', p_texto: 'O Senhor é o meu pastor; nada me faltará.', p_referencia: 'Salmo 23:1', p_foto: null });
    expect(simular.chamadas.filter((c) => c.storage).length).toBe(0);
});

test('quem já compartilhou na semana não vê convite nem botão', async ({ page, simular }) => {
    const espaco = { pode: false, volta_em: '2026-11-29', culto_recente: 'Culto da Família' };
    await simular.abrir('#/inicio', umaConta(), { mural_publicacao: [PUBLICACAO], rpc: { posso_compartilhar: [espaco] } });
    await expect(page.locator('.mural-cartao')).toHaveCount(1);
    await expect(page.getByRole('button', { name: /Foi no/ })).toHaveCount(0);
    await expect(page.locator('.mural-publicar')).toHaveCount(0);
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
    await simular.abrir('#/oracao', umaConta({ titulo: 'pastor' }), { rpc: { pedidos_de_oracao_para_mim: [pedido], pastores_da_igreja: [] } });
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

// --- Cadastro da igreja toda (D71) ------------------------------------------
const PESSOAS = [
    { id: 'p-1', nome: 'Gabi Rocha', apelido: 'Gabi', instrumentos: ['Voz'], ativa: true, foto: null, titulo: 'membro',
        membro_ministerio: [{ ministerio_id: LOUVOR, e_lider: false, ativo: true }], cargo_pessoa: [], conta: null },
    { id: 'p-2', nome: 'Bia Lima', apelido: 'Tia Bia', instrumentos: [], ativa: true, foto: null, titulo: 'diaconisa',
        membro_ministerio: [{ ministerio_id: KIDS, e_lider: true, ativo: true }], cargo_pessoa: [], conta: null },
    { id: 'p-3', nome: 'Seu Antônio', apelido: null, instrumentos: [], ativa: true, foto: null, titulo: 'presbitero',
        membro_ministerio: [], cargo_pessoa: [], conta: null },
];

test('Louvor mostra só quem é do Louvor; Pessoas mostra a igreja toda', async ({ page, simular }) => {
    await simular.abrir('#/equipe', umaConta({ admin: true, louvor: true, lider: true }), { pessoa: PESSOAS, ministerio: MINISTERIOS });
    await page.getByRole('tab', { name: 'Pessoas' }).click();
    await expect(page.locator('.linha-pessoa, .mural-pessoa, .lista-linhas li')).toHaveCount(1);
    await page.goto('/#/pessoas');
    await page.getByRole('tab', { name: 'Cadastro' }).click();
    await expect(page.locator('.lista-linhas li')).toHaveCount(3);
    await expect(page.locator('.lista-linhas')).toContainText('Diaconisa · Kids');
    await page.getByRole('button', { name: 'Kids', exact: true }).click();
    await expect(page.locator('.lista-linhas li')).toHaveCount(1);
    await page.getByRole('button', { name: 'Sem área' }).click();
    await expect(page.locator('.lista-linhas')).toContainText('Seu Antônio');
});

test('admin cadastra presbítero no Kids, com Gmail de convite', async ({ page, simular }) => {
    await simular.abrir('#/pessoas', umaConta({ admin: true }), {
        pessoa: PESSOAS, ministerio: MINISTERIOS, rpc: { cadastrar_pessoa: 'p-novo', definir_email_de_convite: 'esperando' },
    });
    await page.getByRole('tab', { name: 'Cadastro' }).click();
    await page.getByRole('button', { name: 'Cadastrar pessoa' }).click();
    await page.getByLabel('Nome completo').fill('João Batista');
    await page.getByLabel('Título na igreja').selectOption('presbitero');
    await page.getByRole('checkbox', { name: 'Kids' }).check();
    await expect(page.getByText('O que toca ou canta no Louvor')).toBeHidden(); // instrumento é coisa do Louvor
    await page.getByLabel('Gmail para entrar').fill('Joao.Batista@gmail.com');
    await page.getByRole('button', { name: 'Cadastrar', exact: true }).click();
    await expect.poll(() => simular.chamadas.find((c) => c.rpc === 'cadastrar_pessoa')?.args)
        .toMatchObject({ p_nome: 'João Batista', p_titulo: 'presbitero', p_ministerios: [KIDS] });
    await expect.poll(() => simular.chamadas.find((c) => c.rpc === 'definir_email_de_convite')?.args)
        .toEqual({ p_pessoa: 'p-novo', p_email: 'joao.batista@gmail.com' });
});

test('primeiro acesso oferece os ministérios que existem e o título', async ({ page, simular }) => {
    await simular.abrir('#/inicio', umaConta({ estado: 'pendente', apresentou: false }), {
        rpc: { ministerios_para_escolher: MINISTERIOS.map(({ id, nome }) => ({ id, nome })), apresentar_me: null },
    });
    await page.getByLabel('Como quer ser chamado?').fill('Maria');
    await page.getByLabel('Tem algum cargo na igreja?').selectOption('diaconisa');
    await page.getByRole('button', { name: 'Kids', exact: true }).click();
    await expect(page.getByRole('group', { name: 'Toca ou canta o quê?' })).toBeHidden();
    await page.getByRole('button', { name: 'Enviar e entrar na fila' }).click();
    await expect.poll(() => simular.chamadas.find((c) => c.rpc === 'apresentar_me')?.args)
        .toMatchObject({ p_nome: 'Maria', p_titulo: 'diaconisa', p_ministerios: [KIDS], p_cargos: [], p_instrumentos: [] });
});

test('Ministérios mostra o Kids e a página dele lista quem serve', async ({ page, simular }) => {
    const kids = { id: KIDS, nome: 'Kids', ativo: true, membro_ministerio: [
        { e_lider: true, ativo: true, pessoa: { id: 'p-2', nome: 'Bia Lima', apelido: 'Tia Bia', foto: null, titulo: 'diaconisa', ativa: true } },
        { e_lider: false, ativo: true, pessoa: { id: 'p-4', nome: 'Carla Dias', apelido: null, foto: null, titulo: 'membro', ativa: true } },
    ] };
    await simular.abrir('#/ministerios', umaConta(), { ministerio: [kids] });
    await page.getByRole('link', { name: /Kids/ }).click();
    await expect(page).toHaveURL(new RegExp(`#/ministerio/${KIDS}$`));
    await expect(page.locator('h1')).toHaveText('Kids');
    await expect(page.locator('.mural').first()).toContainText('Tia Bia');
    await expect(page.locator('.mural').nth(1)).toContainText('Carla');
    await expect(page.locator('.barra-abas [aria-current="page"]')).toContainText('Ministérios');
});

test('pastor sem "vê o caixa" não vê o Financeiro', async ({ page, simular }) => {
    await simular.abrir('#/ministerios', umaConta({ titulo: 'pastor' }), {});
    await expect(page.getByRole('link', { name: /Financeiro/ })).toHaveCount(0);
    await expect(page.locator('.carteirinha, body')).toBeTruthy();
});

test('quem tem "vê o caixa" vê o Financeiro', async ({ page, simular }) => {
    await simular.abrir('#/ministerios', umaConta({ cargos: ['ve_financeiro'] }), {});
    await expect(page.getByRole('link', { name: /Financeiro/ })).toHaveCount(1);
});


// --- Cultos da igreja e eventos do site (D73) --------------------------------
const culto = (id, nome, data, horario, escalado = false) => ({
    id, nome, rotulo: null, data, horario, estado: 'ativo',
    escala: escalado ? [{ estado: 'publicada', escala_item: [{ pessoa_id: 'p-eu', instrumento_exibido: ['Violão'], saiu_em: null,
        pessoa: { nome: 'Ana Souza', apelido: null, foto: null } }] }] : [],
    repertorio_item: [],
});
const evento = (titulo, data, horario, extra = {}) => ({
    titulo, destaque: null, categoria: 'Culto especial', descricao: 'Venha!', data, data_fim: null, horario,
    local_nome: null, local_cidade: null, link_inscricao: null, imagem: null, ...extra,
});

test('Agenda: evento no horário de um culto aparece uma vez só, com o nome do evento', async ({ page, simular }) => {
    await simular.abrir('#/agenda', umaConta(), {
        culto: [culto('c1', 'Culto da Família', '2026-11-29', '18:00:00'), culto('c2', 'Culto de Oração', '2026-12-01', '19:30:00')],
        rpc: { eventos_do_site: [
            evento('Cantata de Natal', '2026-11-29', '18:00:00'),
            evento('Grudão', '2026-11-29', '18:00:00', { local_nome: 'Chácara', local_cidade: 'Pirapora' }), // fora da igreja: é outro encontro
        ] },
    });
    const linhas = page.locator('.agenda-mes .item-lista');
    await expect(linhas).toHaveCount(3);
    await expect(page.getByText('Culto da Família')).toHaveCount(0);
    await page.getByRole('button', { name: /Cantata de Natal/ }).click();
    await expect(page.locator('.folha')).toContainText('Venha!');
});

test('Início: o próximo culto leva o nome do evento e o "Vem aí" não repete', async ({ page, simular }) => {
    await simular.abrir('#/inicio', umaConta(), {
        culto: [culto('c1', 'Culto da Família', '2026-11-29', '18:00:00')],
        rpc: { eventos_do_site: [evento('Cantata de Natal', '2026-11-29', '18:00:00'), evento('Confraternização', '2026-11-28', '19:00:00', { local_nome: 'Sítio', local_cidade: 'Araçariguama' })] },
    });
    await expect(page.locator('.compromisso-titulo')).toHaveText('Cantata de Natal');
    await expect(page.locator('.inicio-eventos')).toContainText('Confraternização');
    await expect(page.locator('.inicio-eventos')).not.toContainText('Cantata de Natal');
});

test('Início: quem toca amanhã vê a capa mesmo com outro culto antes', async ({ page, simular }) => {
    // Hoje é segunda 23/11 às 15h; a EBD de terça cedo vem antes do culto em que a pessoa toca
    await simular.abrir('#/inicio', umaConta({ louvor: true }), {
        culto: [culto('c0', 'EBD', '2026-11-24', '09:00:00'), culto('c1', 'Culto de Oração', '2026-11-24', '19:30:00', true)],
    });
    await expect(page.locator('.inicio-dia')).toContainText('Amanhã você toca');
    await expect(page.locator('.dia-titulo')).toHaveText('Culto de Oração');
});

test('Aparência: escolher Escuro vale na hora e fica salvo', async ({ page, simular }) => {
    await simular.abrir('#/voce', umaConta());
    await page.getByRole('button', { name: 'Escuro' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'escuro');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0C0A0A');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'escuro');
    await expect(page.getByRole('button', { name: 'Escuro' })).toHaveAttribute('aria-pressed', 'true');
});

// --- Datas especiais (D79) ---------------------------------------------------
test('Natal: o Início ganha o cartão da época e a saudação', async ({ page, simular }) => {
    await simular.abrir('?epoca=natal#/inicio', umaConta());
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Feliz Natal, Ana');
    await expect(page.locator('.epoca')).toContainText('Lucas 2:11');
    await expect(page.locator('.epoca-chuva')).toHaveCount(1); // dia de festa: chuva na 1ª abertura
});

test('fora de época não aparece nada; desligar os enfeites esconde', async ({ page, simular }) => {
    await simular.abrir('#/inicio', umaConta());
    await expect(page.locator('.epoca')).toHaveCount(0); // 23/11 não é data especial
    await page.goto('/?epoca=pascoa#/voce');
    await page.getByRole('switch', { name: /Enfeites das datas especiais/ }).uncheck({ force: true });
    await page.goto('/?epoca=pascoa#/inicio');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Boa tarde, Ana/);
    await expect(page.locator('.epoca')).toHaveCount(0);
});
