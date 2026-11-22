-- =============================================================================
-- Migração: Mural da igreja (D68)
-- =============================================================================
\set ON_ERROR_STOP 1
reset role;
select pessoa_id as p_mem  from public.conta where login = 'membro@teste' \gset
select pessoa_id as p_avu  from public.conta where login = 'avulso@teste' \gset
select pessoa_id as p_g2   from public.conta where login = 'g2@teste' \gset
select pessoa_id as p_kai  from public.conta where login = 'kaique@teste' \gset
-- membro = pastor, avulso = Comunicação, g2 = só tesouraria (não publica)
delete from public.cargo_pessoa where pessoa_id in (:'p_mem', :'p_avu', :'p_g2');
insert into public.cargo_pessoa (pessoa_id, cargo) values (:'p_mem', 'pastor'), (:'p_avu', 'comunicacao'), (:'p_g2', 'tesouraria');
\set foto1 '11111111-1111-1111-1111-111111111111.webp'

set role authenticated;

-- Quem publica ---------------------------------------------------------------
select teste.entrar('avulso@teste');
select public.publicar_no_mural('aviso', '  Cantata de Natal ', 'Dia 20, às 19h.', null, '{}', current_date + 30, true) as pub_aviso \gset
select teste.ok((select titulo = 'Cantata de Natal' from public.mural_publicacao where id = :'pub_aviso'), 'D68: Comunicação publica (e o título vem limpo)');

select teste.entrar('membro@teste');
select public.publicar_no_mural('palavra', null, 'O Senhor é o meu pastor; nada me faltará.', 'Salmo 23:1') as pub_palavra \gset
select teste.ok(:'pub_palavra' is not null, 'D68: o pastor publica');

-- (a esta altura dos cenários, o administrador é o lider@teste)
select teste.entrar('lider@teste');
select public.publicar_no_mural('fotos', 'Culto de domingo', null, null, array[:'foto1']) as pub_fotos \gset
select teste.ok(:'pub_fotos' is not null, 'D68: o administrador publica');

select teste.entrar('g2@teste');
select teste.deve_falhar('select public.publicar_no_mural(''aviso'', ''Oi'')', 'D68: tesouraria não publica');
select teste.entrar('g3@teste');
select teste.deve_falhar('select public.publicar_no_mural(''aviso'', ''Oi'')', 'D68: membro sem cargo não publica');
select teste.deve_falhar('insert into public.mural_publicacao (tipo, titulo, criado_por) values (''aviso'', ''Oi'', privado.minha_pessoa_id())',
  'D68: ninguém grava direto na tabela, só pelo publicar');
select teste.entrar('pendente@teste');
select teste.deve_falhar('select public.publicar_no_mural(''aviso'', ''Oi'')', 'D68: conta pendente não publica');

-- O mínimo de cada tipo ------------------------------------------------------
select teste.entrar('avulso@teste');
select teste.deve_falhar('select public.publicar_no_mural(''aviso'', ''  '')', 'D68: aviso sem título não passa');
select teste.deve_falhar('select public.publicar_no_mural(''fotos'', ''Sem foto'')', 'D68: fotos sem foto não passa');
select teste.deve_falhar('select public.publicar_no_mural(''palavra'')', 'D68: palavra sem texto não passa');
select teste.deve_falhar(format('select public.publicar_no_mural(''aviso'', ''Com foto'', null, null, array[%L])', :'foto1'),
  'D68: foto só em publicação de fotos');
select teste.deve_falhar('select public.publicar_no_mural(''fotos'', ''X'', null, null, array[''../fotos/alguem.webp''])',
  'D68: nome de foto esquisito não passa');
select teste.deve_falhar(format('select public.publicar_no_mural(''fotos'', ''X'', null, null, array_fill(%L::text, array[11]))', :'foto1'),
  'D68: no máximo 10 fotos');
select teste.deve_falhar('select public.publicar_no_mural(''aviso'', ''Velho'', null, null, ''{}'', current_date - 2)',
  'D68: não fixa até uma data que já passou');
select teste.deve_falhar(format('select public.publicar_no_mural(''aviso'', %L)', repeat('a', 81)), 'D68: título de até 80 letras');

-- Quem vê --------------------------------------------------------------------
select teste.entrar('g3@teste');
select teste.ok((select count(*) = 3 from public.mural_publicacao), 'D68: membro aprovado vê o mural');
select teste.entrar('pendente@teste');
select teste.ok((select count(*) = 0 from public.mural_publicacao), 'D68: conta pendente não vê nada');
reset role;
set role anon;
select teste.deve_falhar('select 1 from public.mural_publicacao', 'D68: sem login não vê nada');
reset role;
set role authenticated;

-- Editar, fixar e apagar -----------------------------------------------------
select teste.entrar('g3@teste');
update public.mural_publicacao set titulo = 'Hackeado' where id = :'pub_aviso';
reset role;
select teste.ok((select titulo = 'Cantata de Natal' from public.mural_publicacao where id = :'pub_aviso'), 'D68: membro não edita');
set role authenticated;
select teste.entrar('membro@teste');
update public.mural_publicacao set fixado_ate = null where id = :'pub_aviso';
reset role;
select teste.ok((select fixado_ate is null from public.mural_publicacao where id = :'pub_aviso'), 'D68: o pastor desafixa o aviso da Comunicação');
set role authenticated;
select teste.entrar('membro@teste');
select teste.deve_falhar(format('update public.mural_publicacao set criado_por = %L where id = %L', :'p_kai', :'pub_aviso'),
  'D68: o autor não muda');
select teste.deve_falhar(format('update public.mural_publicacao set fotos = ''{}'' where id = %L', :'pub_fotos'),
  'D68: as fotos não mudam depois de publicar');

-- Reações --------------------------------------------------------------------
select teste.entrar('g3@teste');
insert into public.mural_reacao (publicacao_id, tipo) values (:'pub_palavra', 'amem'), (:'pub_palavra', 'coracao');
select teste.ok((select count(*) = 2 from public.mural_reacao where publicacao_id = :'pub_palavra'), 'D68: membro dá amém e coração');
select teste.deve_falhar(format('insert into public.mural_reacao (publicacao_id, tipo) values (%L, ''amem'')', :'pub_palavra'),
  'D68: um amém por pessoa');
select teste.deve_falhar(format('insert into public.mural_reacao (publicacao_id, pessoa_id, tipo) values (%L, %L, ''amem'')', :'pub_aviso', :'p_mem'),
  'D68: não reage no nome de outra pessoa');
select teste.deve_falhar(format('insert into public.mural_reacao (publicacao_id, tipo) values (%L, ''curtir'')', :'pub_aviso'),
  'D68: só amém e coração');
select teste.entrar('membro@teste');
delete from public.mural_reacao where publicacao_id = :'pub_palavra';
reset role;
select teste.ok((select count(*) = 2 from public.mural_reacao where publicacao_id = :'pub_palavra'), 'D68: ninguém tira a reação dos outros');
set role authenticated;
select teste.entrar('g3@teste');
delete from public.mural_reacao where publicacao_id = :'pub_palavra' and tipo = 'coracao';
select teste.ok((select count(*) = 1 from public.mural_reacao where publicacao_id = :'pub_palavra'), 'D68: cada um tira a sua');
select teste.entrar('pendente@teste');
select teste.deve_falhar(format('insert into public.mural_reacao (publicacao_id, tipo) values (%L, ''amem'')', :'pub_palavra'),
  'D68: conta pendente não reage');

select teste.entrar('g3@teste');
delete from public.mural_publicacao where id = :'pub_palavra';
reset role;
select teste.ok(exists (select 1 from public.mural_publicacao where id = :'pub_palavra'), 'D68: membro não apaga');
set role authenticated;
select teste.entrar('avulso@teste');
delete from public.mural_publicacao where id = :'pub_palavra';
reset role;
select teste.ok(not exists (select 1 from public.mural_publicacao where id = :'pub_palavra'), 'D68: Comunicação apaga');
select teste.ok(not exists (select 1 from public.mural_reacao where publicacao_id = :'pub_palavra'), 'D68: e as reações vão junto');

-- Notificação ----------------------------------------------------------------
select teste.ok((select count(*) = 1 from public.aviso where tipo = 'mural_publicacao'), 'D68: só a publicação marcada avisa');
select teste.ok((select resumo = 'Cantata de Natal' from public.aviso where tipo = 'mural_publicacao'), 'D68: o aviso leva o título');
select teste.ok(not exists (select 1 from public.aviso_destinatario d join public.aviso a on a.id = d.aviso_id
                            where a.tipo = 'mural_publicacao' and d.pessoa_id = :'p_avu'), 'D68: quem publicou não recebe');
select teste.ok((select count(*) from public.aviso_destinatario d join public.aviso a on a.id = d.aviso_id where a.tipo = 'mural_publicacao')
              = (select count(*) from public.conta where estado = 'ativa' and pessoa_id <> :'p_avu'),
  'D68: todas as outras contas ativas recebem');
select teste.ok(not exists (select 1 from public.aviso_destinatario d join public.aviso a on a.id = d.aviso_id
                            join public.conta c on c.pessoa_id = d.pessoa_id
                            where a.tipo = 'mural_publicacao' and c.estado <> 'ativa'), 'D68: conta não ativa não recebe');
