-- =============================================================================
-- Migração 23: Culto de Jovens (D41) e escalas que acompanham o grupo (D42)
-- =============================================================================
\set ON_ERROR_STOP 1
reset role;
select id as louvor from public.ministerio where nome = 'Louvor' \gset
select id as g2 from public.grupo where nome = 'G2' \gset
select id as g3 from public.grupo where nome = 'G3' \gset
select id as jovens from public.tipo_culto where nome = 'Culto de Jovens' \gset
select id as p_avu from public.pessoa where apelido = 'Avu' \gset
-- Um sábado daqui a 3 semanas
select (current_date + 21 + ((6 - extract(dow from current_date + 21)::int + 7) % 7))::date as sabado \gset

select teste.ok((select not gerar_sozinho and grupo_padrao_id = :'g3' from public.tipo_culto where id = :'jovens'),
  'D41: Culto de Jovens não é criado sozinho e tem o G3 como padrão');

set role authenticated;
select teste.entrar('lider@teste');
select public.gerar_cultos(current_date + 60);
select teste.ok((select count(*) = 0 from public.culto where tipo_culto_id = :'jovens'),
  'D41: gerar_cultos não cria Culto de Jovens');

select public.criar_culto_do_tipo(:'jovens', :'sabado', null, :'louvor') as culto_jovens \gset
select teste.ok((select horario = '19:30' and nome = 'Culto de Jovens' from public.culto where id = :'culto_jovens'),
  'D41: cria com nome e horário do tipo');
select teste.ok((select count(*) > 0 from public.escala_item i join public.escala e on e.id = i.escala_id
  where e.culto_id = :'culto_jovens' and i.origem_grupo_id = :'g3'),
  'D41: já vem com os membros do G3');
select teste.deve_falhar(format('select public.criar_culto_do_tipo(%L, %L, null, %L)', :'jovens', :'sabado', :'louvor'),
  'D41: não cria dois Cultos de Jovens no mesmo dia');
select teste.entrar('membro@teste');
select teste.deve_falhar(format('select public.criar_culto_do_tipo(%L, %L, null, %L)', :'jovens', (:'sabado'::date + 7)::text, :'louvor'),
  'D41: integrante não cria culto');

-- D42 -------------------------------------------------------------------------
select teste.entrar('lider@teste');
select e.id as escala_jovens from public.escala e where e.culto_id = :'culto_jovens' \gset
insert into public.grupo_membro (grupo_id, pessoa_id, instrumentos) values (:'g3', :'p_avu', '{Teclado}');
select teste.ok((select instrumento_exibido = '{Teclado}' from public.escala_item where escala_id = :'escala_jovens' and pessoa_id = :'p_avu'),
  'D42: entrou no grupo, entra nas escalas em rascunho do grupo, com o instrumento');
update public.grupo_membro set instrumentos = '{Baixo}' where grupo_id = :'g3' and pessoa_id = :'p_avu';
select teste.ok((select instrumento_exibido = '{Baixo}' from public.escala_item where escala_id = :'escala_jovens' and pessoa_id = :'p_avu'),
  'D42: mudou o instrumento no grupo, muda na escala em rascunho');
update public.escala_item set instrumento_exibido = '{Teclado,Voz}' where escala_id = :'escala_jovens' and pessoa_id = :'p_avu';
update public.grupo_membro set instrumentos = '{Violão}' where grupo_id = :'g3' and pessoa_id = :'p_avu';
select teste.ok((select instrumento_exibido = '{Teclado,Voz}' from public.escala_item where escala_id = :'escala_jovens' and pessoa_id = :'p_avu'),
  'D42: ajuste feito à mão no culto não é desfeito');

-- Saiu do grupo: sai da escala em rascunho (inclusive com o ajuste feito à mão,
-- porque ele estava lá pelo grupo)
delete from public.grupo_membro where grupo_id = :'g3' and pessoa_id = :'p_avu';
select teste.ok((select count(*) = 0 from public.escala_item where escala_id = :'escala_jovens' and pessoa_id = :'p_avu'),
  'D42: saiu do grupo, sai da escala em rascunho');

-- Publicada não muda sozinha
update public.escala set estado = 'publicada' where id = :'escala_jovens';
insert into public.grupo_membro (grupo_id, pessoa_id, instrumentos) values (:'g3', :'p_avu', '{Teclado}');
select teste.ok((select count(*) = 0 from public.escala_item where escala_id = :'escala_jovens' and pessoa_id = :'p_avu'),
  'D42: escala publicada não muda sozinha');
reset role;
\warn 'TESTES DO JOVENS E DOS GRUPOS PASSARAM'
