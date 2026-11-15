-- =============================================================================
-- Migração 20 (D38): cifra e tom da cifra na música.
-- =============================================================================
\set ON_ERROR_STOP 1
reset role;
select id as musica from public.musica order by criado_em limit 1 \gset
set role authenticated;

select teste.entrar('g3@teste');   -- líder de grupo edita música
update public.musica set cifra = '[G]Uma [D]linha', cifra_tom = 'G' where id = :'musica';
reset role;
select teste.ok((select cifra_tom = 'G' from public.musica where id = :'musica'), 'D38: líder de grupo salva a cifra');

set role authenticated;
select teste.deve_falhar(format($$update public.musica set cifra = '[G]x', cifra_tom = null where id = %L$$, :'musica'),
  'D38: cifra sem tom não entra');
select teste.deve_falhar(format($$update public.musica set cifra_tom = 'H' where id = %L$$, :'musica'),
  'D38: tom precisa ser um tom (C a B, # ou b, m)');
select teste.deve_falhar(format($$update public.musica set cifra = repeat('x', 30001) where id = %L$$, :'musica'),
  'D38: cifra tem limite de tamanho');

select teste.entrar('membro@teste');   -- integrante lê, não edita
select teste.ok((select cifra is not null from public.musica where id = :'musica'), 'D38: integrante lê a cifra');
update public.musica set cifra = '[A]mudei', cifra_tom = 'A' where id = :'musica';
reset role;
select teste.ok((select cifra_tom = 'G' from public.musica where id = :'musica'), 'D38: integrante não muda a cifra');
\warn 'TESTES DAS CIFRAS PASSARAM'
