-- =============================================================================
-- Migração 15 (D32): o líder de grupo muda pessoas e instrumentos sozinho,
-- nos cultos publicados do grupo dele, e o líder de louvor é avisado.
-- Dados: fim do 04/05. Gabi (g2@teste) lidera o G2 = Gabi + Mem.
-- "lider@teste" é líder de louvor.
-- =============================================================================
\set ON_ERROR_STOP 1

reset role;
select id as louvor from public.ministerio where nome = 'Louvor' \gset
select id as g2 from public.grupo where nome = 'G2' \gset
select id as g3 from public.grupo where nome = 'G3' \gset
select id as p_gabi  from public.pessoa where apelido = 'Gabi' \gset
select id as p_gui   from public.pessoa where apelido = 'Gui' \gset
select id as p_mem   from public.pessoa where apelido = 'Mem' \gset
select id as p_avu   from public.pessoa where apelido = 'Avu' \gset
select id as p_lider from public.pessoa where apelido = 'Líder' \gset
-- A escala publicada do G2 que tem o Avu na mesa (criada no cenário 04)
select e.id as escala, e.culto_id as culto from public.escala e
join public.escala_grupo eg on eg.escala_id = e.id and eg.grupo_id = :'g2'
join public.escala_item i on i.escala_id = e.id and i.pessoa_id = :'p_avu' and 'Mesa' = any (i.instrumento_exibido)
where e.estado = 'publicada' limit 1 \gset
-- Dois cultos livres: um vai ser do G3 (publicado), outro do G2 em rascunho
select public.gerar_cultos(current_date + 60);
select array_agg(id order by data) as livres from (
  select c.id, c.data from public.culto c
  where c.tem_louvor and c.estado = 'ativo' and not exists (select 1 from public.escala e where e.culto_id = c.id)
  order by c.data limit 2) x \gset
reset role;
set role authenticated;
select teste.entrar('lider@teste');
select public.definir_grupos_do_culto((:'livres'::uuid[])[1], :'louvor', array[:'g3']::uuid[]) as escala_g3 \gset
update public.escala set estado = 'publicada' where id = :'escala_g3';
select public.definir_grupos_do_culto((:'livres'::uuid[])[2], :'louvor', array[:'g2']::uuid[]) as escala_rascunho \gset

reset role;
select public.processar_avisos_pendentes(interval '0 seconds');   -- limpa o que já estava pendente
set role authenticated;

-- O que o líder do G2 pode
select teste.entrar('g2@teste');
update public.escala_item set instrumento_exibido = '{voz}' where escala_id = :'escala' and pessoa_id = :'p_mem';
select teste.ok((select instrumento_exibido = '{voz}' from public.escala_item where escala_id = :'escala' and pessoa_id = :'p_mem'),
  'D32: líder do grupo muda o instrumento de alguém no culto do grupo dele');
insert into public.escala_item (escala_id, pessoa_id, instrumento_exibido) values (:'escala', :'p_gui', '{teclado}');
select teste.ok((select count(*) = 1 from public.escala_item where escala_id = :'escala' and pessoa_id = :'p_gui'),
  'D32: líder do grupo inclui alguém de fora do grupo (substituição)');
delete from public.escala_item where escala_id = :'escala' and pessoa_id = :'p_gabi';
select teste.ok((select count(*) = 0 from public.escala_item where escala_id = :'escala' and pessoa_id = :'p_gabi'),
  'D32: líder do grupo tira alguém (até ele mesmo)');

-- O que continua só com o líder de louvor
select teste.deve_falhar(format('delete from public.escala_item where escala_id = %L and pessoa_id = %L', :'escala', :'p_avu'),
  'D32: líder do grupo não tira quem está na mesa');
select teste.deve_falhar(format($$update public.escala_item set instrumento_exibido = '{voz,Mesa}' where escala_id = %L and pessoa_id = %L$$, :'escala', :'p_mem'),
  'D32: líder do grupo não põe ninguém na mesa');
select teste.deve_falhar(format('select public.definir_mesa(%L, %L, %L)', :'culto', :'louvor', :'p_mem'),
  'D32: líder do grupo não troca a mesa');
select teste.deve_falhar(format('select public.definir_grupos_do_culto(%L, %L, array[%L]::uuid[])', :'culto', :'louvor', :'g3'),
  'D32: líder do grupo não troca o grupo do culto');
select teste.ok((select count(*) = 1 from public.escala_grupo where escala_id = :'escala' and grupo_id = :'g2'),
  'e a tentativa de trocar o grupo não deixou nada pela metade');
select teste.deve_falhar(format($$insert into public.escala_item (escala_id, pessoa_id, instrumento_exibido) values (%L, %L, '{voz}')$$, :'escala_g3', :'p_avu'),
  'D32: só no culto em que o grupo dele está escalado');
select teste.deve_falhar(format($$insert into public.escala_item (escala_id, pessoa_id, instrumento_exibido) values (%L, %L, '{voz}')$$, :'escala_rascunho', :'p_avu'),
  'D32: rascunho continua só com o líder de louvor');
select teste.deve_falhar(format($$insert into public.solicitacao_alteracao (escala_id, texto) values (%L, 'trocar')$$, :'escala'),
  'D32: o pedido de alteração saiu');

-- Avisos
reset role;
select public.processar_avisos_pendentes(interval '0 seconds');
select a.id as aviso, a.resumo from public.aviso a where a.escala_id = :'escala' order by a.criado_em desc limit 1 \gset
select teste.ok(:'resumo' like 'Escala atualizada por Gabi:%', 'D32: o aviso diz quem mudou');
select teste.ok((select count(*) = 1 from public.aviso_destinatario where aviso_id = :'aviso' and pessoa_id = :'p_lider'),
  'D32: o líder de louvor é avisado da mudança do líder de grupo');
select teste.ok((select count(*) = 1 from public.aviso_destinatario where aviso_id = :'aviso' and pessoa_id = :'p_gabi'),
  'quem saiu também é avisado');

-- Mudança feita pelo próprio líder de louvor: aviso normal, sem "por"
set role authenticated;
select teste.entrar('lider@teste');
delete from public.escala_item where escala_id = :'escala' and pessoa_id = :'p_gui';
reset role;
select public.processar_avisos_pendentes(interval '0 seconds');
select a.id as aviso2, a.resumo as resumo2 from public.aviso a where a.escala_id = :'escala' order by a.criado_em desc limit 1 \gset
select teste.ok(:'resumo2' like 'Escala atualizada: %', 'mudança do líder de louvor não traz "por"');
select teste.ok((select count(*) = 0 from public.aviso_destinatario where aviso_id = :'aviso2' and pessoa_id = :'p_lider'),
  'e o líder de louvor não é avisado da própria mudança');


-- Migração 16: nome de quem entra com Google
insert into auth.users (email, raw_user_meta_data) values ('google@teste', '{"full_name": "Maria do Google", "avatar_url": "https://x"}');
select teste.ok((select nome_informado = 'Maria do Google' from public.conta where login = 'google@teste'),
  'quem entra com Google chega com o nome no pedido de acesso');
\warn 'TESTES DO LÍDER DE GRUPO PASSARAM'
