-- =============================================================================
-- Membro compartilha no mural: foto ou palavra, uma vez por semana (D70, D72)
-- =============================================================================
\set ON_ERROR_STOP 1
reset role;
select pessoa_id as p_cida from public.conta where login = 'so-membro@teste' \gset
select pessoa_id as p_g3   from public.conta where login = 'g3@teste' \gset
-- Um culto que começou há 3 horas: a foto leva o nome dele
insert into public.culto (nome, data, horario)
values ('Culto de Agora', ((now() - interval '3 hours') at time zone 'America/Sao_Paulo')::date,
        ((now() - interval '3 hours') at time zone 'America/Sao_Paulo')::time)
returning id as c_agora \gset
select 'membros/' || :'p_cida' || '/22222222-2222-2222-2222-222222222222.webp' as foto_cida \gset
select 'membros/' || :'p_g3' || '/33333333-3333-3333-3333-333333333333.webp' as foto_g3 \gset

-- O domingo da semana
select teste.ok(privado.domingo_da_semana('2026-11-22 10:00-03') = '2026-11-22'
            and privado.domingo_da_semana('2026-11-28 23:30-03') = '2026-11-22'
            and privado.domingo_da_semana('2026-11-29 00:10-03') = '2026-11-29',
  'D72: a semana vai de domingo a sábado, no horário de Brasília');

set role authenticated;
select teste.entrar('so-membro@teste');
select teste.ok((select pode and culto_recente = 'Culto de Agora' from public.posso_compartilhar()), 'D72: pode compartilhar e o app sabe do culto recente');
select public.compartilhar_no_mural('fotos', 'Que culto!', null, :'foto_cida') as pub_cida \gset
select teste.ok((select de_membro and tipo = 'fotos' and culto_id = :'c_agora' and texto = 'Que culto!' and semana is not null
                 from public.mural_publicacao where id = :'pub_cida'),
  'D72: membro posta a foto, com o nome do culto');
select teste.ok((select not pode from public.posso_compartilhar()), 'D72: o app sabe que ela já compartilhou');
select teste.deve_falhar(format('select public.compartilhar_no_mural(%L, %L)', 'palavra', 'Deus é fiel'), 'D72: um post por semana, de qualquer tipo');
select teste.deve_falhar(format('select public.compartilhar_no_mural(%L, %L)', 'aviso', 'Oi'), 'D72: membro não posta aviso');

-- As regras de cada tipo (com a semana da Cida liberada)
reset role;
update public.mural_publicacao set semana = semana - 7 where id = :'pub_cida';
set role authenticated;
select teste.entrar('so-membro@teste');
select teste.deve_falhar(format('select public.compartilhar_no_mural(%L, null, null, %L)', 'fotos', :'foto_g3'), 'D70: não posta foto da pasta de outra pessoa');
select teste.deve_falhar(format('select public.compartilhar_no_mural(%L, %L, null, %L)', 'fotos', repeat('a', 141), :'foto_cida'), 'D70: legenda até 140');
select teste.deve_falhar(format('select public.compartilhar_no_mural(%L)', 'palavra'), 'D72: palavra precisa de texto');
select teste.deve_falhar(format('select public.compartilhar_no_mural(%L, %L)', 'palavra', repeat('a', 281)), 'D72: palavra até 280');
select teste.deve_falhar(format('select public.compartilhar_no_mural(%L, %L, null, %L)', 'palavra', 'Amém', :'foto_cida'), 'D72: palavra vai sem foto');
select public.compartilhar_no_mural('palavra', 'O Senhor é o meu pastor; nada me faltará.', 'Salmo 23:1') as pub_palavra \gset
select teste.ok((select tipo = 'palavra' and referencia = 'Salmo 23:1' and fotos = '{}' and culto_id is null
                 from public.mural_publicacao where id = :'pub_palavra'),
  'D72: membro compartilha uma palavra com referência');

-- O autor mexe só no texto
update public.mural_publicacao set texto = 'Que culto abençoado!' where id = :'pub_cida';
select teste.ok((select texto = 'Que culto abençoado!' from public.mural_publicacao where id = :'pub_cida'), 'D70: o autor edita a legenda');
update public.mural_publicacao set referencia = 'Sl 23:1' where id = :'pub_palavra';
select teste.ok((select referencia = 'Sl 23:1' from public.mural_publicacao where id = :'pub_palavra'), 'D72: o autor edita a referência da palavra');
select teste.deve_falhar(format('update public.mural_publicacao set texto = %L where id = %L', repeat('a', 281), :'pub_palavra'), 'D72: editar não passa de 280');
select teste.deve_falhar(format('update public.mural_publicacao set titulo = %L where id = %L', 'Título', :'pub_palavra'), 'D72: post de membro não tem título');
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
select public.compartilhar_no_mural('fotos', null, null, :'foto_g3') as pub_g3 \gset
select teste.ok((select texto is null from public.mural_publicacao where id = :'pub_g3'), 'D70: legenda é opcional');
delete from public.mural_publicacao where id = :'pub_g3';
reset role;
select teste.ok(not exists (select 1 from public.mural_publicacao where id = :'pub_g3'), 'D70: o autor apaga o dele');
set role authenticated;
select teste.entrar('g3@teste');
select teste.ok((select pode from public.posso_compartilhar()), 'D72: apagou, libera de novo na mesma semana');

-- Limpeza dos 90 dias
select public.compartilhar_no_mural('fotos', null, null, :'foto_g3') as pub_g3b \gset
reset role;
update public.mural_publicacao set criado_em = now() - interval '91 days' where id in (:'pub_cida', :'pub_g3b', :'pub_palavra');
select teste.ok((select array_agg(id order by id) = (select array_agg(x order by x) from unnest(array[:'pub_g3b', :'pub_palavra']::uuid[]) x)
                 from public.fotos_de_membro_vencidas()),
  'D72: aos 90 dias vencem a foto e a palavra não guardadas (a guardada fica)');
set role authenticated;
select teste.entrar('so-membro@teste');
select teste.deve_falhar('select * from public.fotos_de_membro_vencidas()', 'D70: só a limpeza (chave de serviço) vê a lista');

-- O publicar de quem publica continua igual
select teste.entrar('avulso@teste');
select public.publicar_no_mural('aviso', 'Ainda funciona') as pub_aviso \gset
update public.mural_publicacao set fixado_ate = current_date + 3 where id = :'pub_aviso';
reset role;
select teste.ok((select fixado_ate = current_date + 3 from public.mural_publicacao where id = :'pub_aviso'), 'D70: quem publica ainda fixa');
