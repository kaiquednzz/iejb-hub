-- =============================================================================
-- Migração 27: o financeiro e os cargos pedem o código do app (D57)
-- =============================================================================
-- Depois do cenário 11: g2 é tesouraria, membro é pastor, lider é admin.
\set ON_ERROR_STOP 1
reset role;
select pessoa_id as p_gabi from public.conta where login = 'g2@teste' \gset
select pessoa_id as p_avu from public.conta where login = 'avulso@teste' \gset
select id as conta_avu from public.conta where login = 'avulso@teste' \gset
select count(*) as n_lanc from public.lancamento \gset
select id as uma_conta from public.conta_financeira limit 1 \gset
select id as uma_cat from public.categoria_financeira where tipo = 'saida' limit 1 \gset

set role authenticated;

-- Tesouraria só com a senha: não vê nem lança
select teste.entrar_so_com_senha('g2@teste');
select teste.ok((select count(*) = 0 from public.lancamento), 'D57: tesouraria sem código não vê os lançamentos');
select teste.ok((select count(*) = 0 from public.conta_financeira), 'D57: tesouraria sem código não vê as contas');
select teste.ok((select (public.resumo_financeiro(current_date) ->> 'entradas')::bigint = 0), 'D57: o resumo sai zerado sem código');
select teste.deve_falhar(format(
  'insert into public.lancamento (tipo, valor_centavos, data, forma, conta_id, categoria_id, criado_por) values (''saida'', 100, current_date, ''pix'', %L, %L, %L)',
  :'uma_conta', :'uma_cat', :'p_gabi'), 'D57: tesouraria sem código não lança');
select teste.ok((select count(*) = 0 from public.quem_pode_conferir()), 'D57: sem código não lista conferentes');

-- Com o código, volta tudo
select teste.entrar('g2@teste');
select teste.ok((select count(*) = :n_lanc from public.lancamento), 'D57: com código a tesouraria vê tudo');
insert into public.lancamento (tipo, valor_centavos, data, forma, conta_id, categoria_id, criado_por)
values ('saida', 100, current_date, 'pix', :'uma_conta', :'uma_cat', :'p_gabi');
select teste.ok((select count(*) = :n_lanc + 1 from public.lancamento), 'D57: o mesmo lançamento passa com código');

-- Pastor só com a senha
select teste.entrar_so_com_senha('membro@teste');
select teste.ok((select count(*) = 0 from public.lancamento), 'D57: pastor sem código não vê');
select teste.entrar('membro@teste');
select teste.ok((select count(*) = :n_lanc + 1 from public.lancamento), 'D57: pastor com código vê');

-- Admin só com a senha não mexe em cargo nem em administrador
select teste.entrar_so_com_senha('lider@teste');
select teste.deve_falhar(format('insert into public.cargo_pessoa (pessoa_id, cargo) values (%L, ''tesouraria'')', :'p_avu'),
  'D57: admin sem código não dá cargo');
select teste.deve_falhar(format('select public.definir_administrador(%L, true)', :'conta_avu'),
  'D57: admin sem código não cria outro admin');
reset role;
select count(*) as n_cargos from public.cargo_pessoa \gset
set role authenticated;
select teste.entrar_so_com_senha('lider@teste');
delete from public.cargo_pessoa where cargo = 'comunicacao';
reset role;
select teste.ok((select count(*) = :n_cargos from public.cargo_pessoa), 'D57: admin sem código não tira cargo');

-- Com o código, o admin consegue
set role authenticated;
select teste.entrar('lider@teste');
insert into public.cargo_pessoa (pessoa_id, cargo) values (:'p_avu', 'pastor');
select public.definir_administrador(:'conta_avu', true);
select public.definir_administrador(:'conta_avu', false);
reset role;
select teste.ok(exists (select 1 from public.cargo_pessoa where pessoa_id = :'p_avu' and cargo = 'pastor'), 'D57: admin com código dá cargo');
delete from public.cargo_pessoa where pessoa_id = :'p_avu' and cargo = 'pastor';

-- O que não é dinheiro continua só com a senha
set role authenticated;
select teste.entrar_so_com_senha('membro@teste');
select teste.ok((select count(*) > 0 from public.culto), 'D57: a escala não pede código');

\echo 'TESTES DO CÓDIGO DE VERIFICAÇÃO PASSARAM'
