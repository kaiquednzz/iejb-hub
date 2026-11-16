-- =============================================================================
-- Migração 28: testemunha da contagem (D61)
-- =============================================================================
-- Depois do 13: g2 é tesouraria, membro é pastor.
\set ON_ERROR_STOP 1
reset role;
select id as caixa from public.conta_financeira where ativa order by tipo = 'dinheiro' desc limit 1 \gset
select pessoa_id as p_mem from public.conta where login = 'membro@teste' \gset
select pessoa_id as p_gabi from public.conta where login = 'g2@teste' \gset
select count(*) as n0 from public.lancamento \gset

set role authenticated;
select teste.entrar('g2@teste');
select teste.deve_falhar(format(
  'insert into public.contagem (modo, data, conta_id, dizimos_centavos, ofertas_centavos, contado_por) values (''qr'', current_date, %L, 100, 0, %L)',
  :'caixa', :'p_gabi'), 'D61: contagem com QR não nasce por insert direto (sem segredo)');

-- QR ---------------------------------------------------------------------------
select r->>'token' as tok, r->>'contagem' as cid from (select public.pedir_testemunha(current_date, null, :'caixa', 30000, 12550) r) x \gset
select teste.ok(:'tok' ~ '^[0-9a-f]{64}$', 'D61: o QR leva um segredo de 64 caracteres');
reset role;
select teste.ok((select token_hash <> :'tok' and token_hash is not null from public.contagem where id = :'cid'), 'D61: o segredo não fica guardado, só o hash');

set role anon;
select public.testemunha_abrir(:'tok') as aberto \gset
select teste.ok((:'aberto'::jsonb ->> 'situacao') = 'ok', 'D61: a testemunha abre sem login');
select teste.ok(not (:'aberto'::jsonb ?| array['dizimos', 'ofertas', 'total', 'dizimos_centavos']), 'D61: a testemunha não vê o valor de quem contou');
select teste.ok((public.testemunha_abrir(repeat('a', 64)) ->> 'situacao') = 'invalido', 'D61: segredo inventado não abre nada');
select teste.ok((public.testemunha_abrir('x'' or 1=1 --') ->> 'situacao') = 'invalido', 'D61: lixo no segredo não abre nada');
select teste.deve_falhar(format('select public.pedir_testemunha(current_date, null, %L, 100, 0)', :'caixa'), 'D61: sem login não gera QR');
select teste.deve_falhar('select public.contar_sozinha(current_date, null, null, 100, 0)', 'D61: sem login não lança');

select public.testemunha_conferir(:'tok', 'Dona Cida', 30000, 12000) as errado \gset
select teste.ok((:'errado'::jsonb ->> 'situacao') = 'nao_bateu', 'D61: valor diferente não entra no caixa');
select teste.ok((:'errado'::jsonb ->> 'dizimos')::boolean and not (:'errado'::jsonb ->> 'ofertas')::boolean, 'D61: diz em qual parte não bateu');
select teste.ok(not (:'errado'::jsonb ? 'esperado'), 'D61: mesmo errando, não revela o valor certo');
select teste.ok((public.testemunha_conferir(:'tok', 'Dona Cida', 30000, 12550) ->> 'situacao') = 'bateu', 'D61: bateu, conferida');
select teste.ok((public.testemunha_conferir(:'tok', 'Dona Cida', 30000, 12550) ->> 'situacao') = 'invalido', 'D61: o QR não serve uma segunda vez');
select teste.ok((public.testemunha_abrir(:'tok') ->> 'situacao') = 'invalido', 'D61: depois de usado, o QR não abre mais');

reset role;
select teste.ok((select count(*) = :n0 + 2 from public.lancamento), 'D61: dízimos e ofertas entraram no caixa');
select teste.ok((select estado = 'conferida' and modo = 'qr' and testemunha_nome = 'Dona Cida' and token_hash is null
                 from public.contagem where id = :'cid'), 'D61: fica registrado quem testemunhou');
select teste.ok(exists (select 1 from public.aviso a join public.aviso_destinatario d on d.aviso_id = a.id
                        where a.tipo = 'contagem_decidida' and d.pessoa_id = :'p_gabi' and a.resumo like 'Dona Cida%'),
  'D61: quem contou recebe o aviso de que bateu');

-- Limite de tentativas, vencimento e QR novo --------------------------------------
set role authenticated;
select teste.entrar('g2@teste');
select r->>'token' as tok2, r->>'contagem' as cid2 from (select public.pedir_testemunha(current_date, null, :'caixa', 5000, 0) r) x \gset
set role anon;
select public.testemunha_conferir(:'tok2', 'Zé', 1, 0), public.testemunha_conferir(:'tok2', 'Zé', 2, 0), public.testemunha_conferir(:'tok2', 'Zé', 3, 0),
       public.testemunha_conferir(:'tok2', 'Zé', 4, 0), public.testemunha_conferir(:'tok2', 'Zé', 6, 0);
select teste.ok((public.testemunha_conferir(:'tok2', 'Zé', 5000, 0) ->> 'situacao') = 'esgotado', 'D61: depois de 5 tentativas o QR trava (nem o valor certo passa)');
set role authenticated;
select teste.entrar('g2@teste');
select public.renovar_testemunha(:'cid2') as tok3 \gset
set role anon;
select teste.ok((public.testemunha_abrir(:'tok2') ->> 'situacao') = 'invalido', 'D61: QR novo desliga o antigo');
reset role;
update public.contagem set token_expira_em = now() - interval '1 minute' where id = :'cid2';
set role anon;
select teste.ok((public.testemunha_conferir(:'tok3', 'Zé', 5000, 0) ->> 'situacao') = 'vencido', 'D61: QR vencido (15 min) não confere');

-- Quem pode pedir --------------------------------------------------------------
set role authenticated;
select teste.entrar('avulso@teste');
select teste.deve_falhar(format('select public.pedir_testemunha(current_date, null, %L, 100, 0)', :'caixa'), 'D61: quem não é da tesouraria não gera QR');
select teste.entrar('membro@teste');
select teste.deve_falhar(format('select public.contar_sozinha(current_date, null, %L, 100, 0)', :'caixa'), 'D61: pastor (só leitura) não lança contagem');

-- Sem celular (papel) ----------------------------------------------------------
select teste.entrar('g2@teste');
reset role; select count(*) as n1 from public.contagem \gset
set role authenticated; select teste.entrar('g2@teste');
select teste.ok((public.contar_com_testemunha_sem_celular(current_date, null, :'caixa', 8000, 2000, 'Seu Antônio', 8000, 1500) ->> 'bateu')::boolean = false,
  'D61: sem celular, valor diferente avisa na hora');
reset role;
select teste.ok((select count(*) = :n1 from public.contagem), 'D61: e não grava nada até bater');
set role authenticated; select teste.entrar('g2@teste');
select teste.ok((public.contar_com_testemunha_sem_celular(current_date, null, :'caixa', 8000, 2000, 'Seu Antônio', 8000, 2000) ->> 'bateu')::boolean,
  'D61: sem celular, bateu e entrou');
select teste.deve_falhar(format('select public.contar_com_testemunha_sem_celular(current_date, null, %L, 100, 0, '''', 100, 0)', :'caixa'),
  'D61: sem celular precisa do nome da testemunha');
reset role;
select teste.ok(exists (select 1 from public.contagem where modo = 'papel' and testemunha_nome = 'Seu Antônio' and estado = 'conferida'),
  'D61: fica registrado como testemunha sem celular');

-- Sozinha ----------------------------------------------------------------------
select count(*) as n2 from public.lancamento \gset
set role authenticated; select teste.entrar('g2@teste');
select public.contar_sozinha(current_date, null, :'caixa', 7000, 0);
reset role;
select teste.ok((select count(*) = :n2 + 1 from public.lancamento), 'D61: contar sozinha entra no caixa');
select teste.ok(exists (select 1 from public.contagem where modo = 'sozinha' and estado = 'conferida' and conferente_id is null),
  'D61: e fica marcado como sem conferência');
select teste.ok(exists (select 1 from public.aviso a join public.aviso_destinatario d on d.aviso_id = a.id
                        where a.tipo = 'contagem_sem_conferencia' and d.pessoa_id = :'p_mem'),
  'D61: o pastor é avisado');

\echo 'TESTES DA TESTEMUNHA PASSARAM'
