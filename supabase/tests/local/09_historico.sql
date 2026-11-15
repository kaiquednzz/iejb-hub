-- =============================================================================
-- Migração 22 (D39): repertório de culto que já passou é de todo o Louvor.
-- Um culto especial criado aqui, sem escala: o avulso não é "do culto".
-- =============================================================================
\set ON_ERROR_STOP 1
reset role;
select id as louvor from public.ministerio where nome = 'Louvor' \gset
select id as g3 from public.grupo where nome = 'G3' \gset
select id as musica from public.musica order by criado_em limit 1 \gset
-- Culto especial só para este teste (sem escala: ninguém é "do culto"), no futuro
insert into public.culto (nome, data, horario) values ('Culto do teste D39', current_date + 30, '19:00')
returning id as culto \gset
insert into public.repertorio_item (culto_id, ministerio_id, musica_id, posicao)
values (:'culto', :'louvor', :'musica', 1);

set role authenticated;
select teste.entrar('avulso@teste');
select teste.ok((select count(*) = 0 from public.repertorio_item where culto_id = :'culto'),
  'D39: antes do culto, quem não é dele continua sem ver (D36)');

reset role;
update public.culto set data = date '2000-01-09' where id = :'culto';
set role authenticated;
select teste.entrar('avulso@teste');
select teste.ok((select count(*) = 1 from public.repertorio_item where culto_id = :'culto'),
  'D39: depois do culto, todo o Louvor consulta');

reset role;
update public.culto set estado = 'cancelado' where id = :'culto';
set role authenticated;
select teste.entrar('avulso@teste');
select teste.ok((select count(*) = 0 from public.repertorio_item where culto_id = :'culto'),
  'D39: culto cancelado não entra no histórico');
reset role;
\warn 'TESTES DO HISTÓRICO PASSARAM'
