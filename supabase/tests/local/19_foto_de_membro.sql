-- =============================================================================
-- Migração: membro posta foto do último culto (D70)
-- =============================================================================
\set ON_ERROR_STOP 1
reset role;
select pessoa_id as p_cida from public.conta where login = 'so-membro@teste' \gset
select pessoa_id as p_g3   from public.conta where login = 'g3@teste' \gset
-- Um culto que começou há 3 horas (aceita fotos) e um de 3 dias atrás (fechado)
insert into public.culto (nome, data, horario)
values ('Culto de Agora', ((now() - interval '3 hours') at time zone 'America/Sao_Paulo')::date,
        ((now() - interval '3 hours') at time zone 'America/Sao_Paulo')::time)
returning id as c_agora \gset
insert into public.culto (nome, data, horario)
values ('Culto Velho', ((now() - interval '3 days') at time zone 'America/Sao_Paulo')::date, '18:00')
returning id as c_velho \gset
select 'membros/' || :'p_cida' || '/22222222-2222-2222-2222-222222222222.webp' as foto_cida \gset
select 'membros/' || :'p_g3' || '/33333333-3333-3333-3333-333333333333.webp' as foto_g3 \gset

set role authenticated;
select teste.entrar('so-membro@teste');
select teste.ok((select id = :'c_agora' and not ja_postei from public.culto_para_foto()), 'D70: o culto de agora aceita foto');
select public.postar_foto_do_culto(:'c_agora', :'foto_cida', 'Que culto!') as pub_cida \gset
select teste.ok((select de_membro and culto_id = :'c_agora' and texto = 'Que culto!' from public.mural_publicacao where id = :'pub_cida'),
  'D70: membro posta a foto do culto');
select teste.ok((select ja_postei from public.culto_para_foto()), 'D70: o app sabe que ela já postou');
select teste.deve_falhar(format('select public.postar_foto_do_culto(%L, %L)', :'c_agora', :'foto_cida'), 'D70: uma foto por pessoa por culto');
select teste.deve_falhar(format('select public.postar_foto_do_culto(%L, %L)', :'c_velho', :'foto_cida'), 'D70: culto de 3 dias atrás já fechou');
select teste.deve_falhar(format('select public.postar_foto_do_culto(%L, %L)', :'c_agora', :'foto_g3'), 'D70: não posta foto da pasta de outra pessoa');
select teste.deve_falhar(format('select public.postar_foto_do_culto(%L, %L, %L)', :'c_agora', :'foto_cida', repeat('a', 141)), 'D70: legenda até 140');

-- O autor mexe só na legenda
update public.mural_publicacao set texto = 'Que culto abençoado!' where id = :'pub_cida';
select teste.ok((select texto = 'Que culto abençoado!' from public.mural_publicacao where id = :'pub_cida'), 'D70: o autor edita a legenda');
select teste.deve_falhar(format('update public.mural_publicacao set fixado_ate = current_date + 5 where id = %L', :'pub_cida'), 'D70: o autor não fixa');
select teste.deve_falhar(format('update public.mural_publicacao set guardar = true where id = %L', :'pub_cida'), 'D70: o autor não marca guardar');

select teste.entrar('g3@teste');
update public.mural_publicacao set texto = 'Hackeado' where id = :'pub_cida';
delete from public.mural_publicacao where id = :'pub_cida';
reset role;
select teste.ok((select texto = 'Que culto abençoado!' from public.mural_publicacao where id = :'pub_cida'), 'D70: outro membro não edita nem apaga');
set role authenticated;

select teste.entrar('avulso@teste'); -- Comunicação
update public.mural_publicacao set guardar = true where id = :'pub_cida';
select teste.ok((select guardar from public.mural_publicacao where id = :'pub_cida'), 'D70: a Comunicação marca guardar');

select teste.entrar('g3@teste');
select public.postar_foto_do_culto(:'c_agora', :'foto_g3') as pub_g3 \gset
select teste.ok((select texto is null from public.mural_publicacao where id = :'pub_g3'), 'D70: legenda é opcional');
delete from public.mural_publicacao where id = :'pub_g3';
reset role;
select teste.ok(not exists (select 1 from public.mural_publicacao where id = :'pub_g3'), 'D70: o autor apaga a dele');

-- Limpeza dos 90 dias
set role authenticated;
select teste.entrar('g3@teste');
select public.postar_foto_do_culto(:'c_agora', :'foto_g3') as pub_g3b \gset
reset role;
update public.mural_publicacao set criado_em = now() - interval '91 days' where id in (:'pub_cida', :'pub_g3b');
select teste.ok((select array_agg(id) = array[:'pub_g3b']::uuid[] from public.fotos_de_membro_vencidas()),
  'D70: aos 90 dias vence a foto não guardada (a guardada fica)');
set role authenticated;
select teste.entrar('so-membro@teste');
select teste.deve_falhar('select * from public.fotos_de_membro_vencidas()', 'D70: só a limpeza (chave de serviço) vê a lista');

-- O publicar de quem publica continua igual
select teste.entrar('avulso@teste');
select public.publicar_no_mural('aviso', 'Ainda funciona') as pub_aviso \gset
update public.mural_publicacao set fixado_ate = current_date + 3 where id = :'pub_aviso';
reset role;
select teste.ok((select fixado_ate = current_date + 3 from public.mural_publicacao where id = :'pub_aviso'), 'D70: quem publica ainda fixa');
