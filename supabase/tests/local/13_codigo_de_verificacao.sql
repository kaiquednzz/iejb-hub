-- =============================================================================
-- Migrações 27 e 31: o código do app autenticador entrou (D57) e saiu.
-- Depois da 31, a senha basta para o financeiro e para os cargos.
-- =============================================================================
\set ON_ERROR_STOP 1
reset role;
select count(*) as n_lanc from public.lancamento \gset
select pessoa_id as p_avu from public.conta where login = 'avulso@teste' \gset

set role authenticated;
select teste.entrar_so_com_senha('g2@teste');
select teste.ok((select count(*) = :n_lanc from public.lancamento), 'D57 revogada: tesouraria vê o financeiro só com a senha');
select teste.entrar_so_com_senha('lider@teste');
insert into public.cargo_pessoa (pessoa_id, cargo) values (:'p_avu', 'pastor');
reset role;
select teste.ok(exists (select 1 from public.cargo_pessoa where pessoa_id = :'p_avu' and cargo = 'pastor'), 'D57 revogada: admin dá cargo só com a senha');
delete from public.cargo_pessoa where pessoa_id = :'p_avu' and cargo = 'pastor';
set role authenticated;
select teste.entrar_so_com_senha('avulso@teste');
select teste.ok((select count(*) = 0 from public.lancamento), 'quem não tem cargo continua sem ver o financeiro');
select teste.deve_falhar(format('insert into public.cargo_pessoa (pessoa_id, cargo) values (%L, ''tesouraria'')', :'p_avu'),
  'quem não é admin continua sem se dar cargo');

\echo 'TESTES DO FINANCEIRO SEM CÓDIGO PASSARAM'
