-- =============================================================================
-- Migração 26: os meus cultos na agenda do celular (D56)
-- =============================================================================
\set ON_ERROR_STOP 1
reset role;
select pessoa_id as p_mem from public.conta where login = 'membro@teste' \gset
select e.id as escala_rascunho, e.culto_id as culto_rascunho from public.escala e
join public.escala_item i on i.escala_id = e.id and i.pessoa_id = :'p_mem'
where e.estado = 'rascunho' limit 1 \gset

set role authenticated;
select teste.entrar('membro@teste');
select public.meu_link_da_agenda() as link1 \gset
select teste.ok(:'link1' ~ '^[0-9a-f]{64}$', 'D56: o link é um segredo de 64 caracteres');
select teste.ok(public.meu_link_da_agenda() = :'link1', 'D56: pedir de novo devolve o mesmo link');
select public.meu_link_da_agenda(true) as link2 \gset
select teste.ok(:'link2' <> :'link1', 'D56: trocar o link gera outro');
select teste.deve_falhar('select * from public.agenda_link', 'D56: ninguém lê os links pela API');
select teste.deve_falhar(format('select * from public.agenda_do_link(%L)', :'link2'), 'D56: logado não lê a agenda de ninguém pelo link');

set role anon;
select teste.deve_falhar('select public.meu_link_da_agenda()', 'D56: sem login não há link');
select teste.deve_falhar(format('select * from public.agenda_do_link(%L)', :'link2'), 'D56: anônimo não lê a agenda');

-- A função "agenda" usa a chave de serviço (o esquema teste não é dela: guarda e confere depois)
set role service_role;
select count(*) as n_antigo from public.agenda_do_link(:'link1') \gset
select count(*) as n_cultos from public.agenda_do_link(:'link2') \gset
reset role;
select teste.ok(:n_antigo = 0, 'D56: o link antigo parou de funcionar');
select teste.ok(:n_cultos > 0, 'D56: a agenda traz os cultos da pessoa');
select teste.ok(not exists (
  select 1 from public.agenda_do_link(:'link2') a
  where not exists (select 1 from public.escala e join public.escala_item i on i.escala_id = e.id
                    where e.culto_id = a.culto_id and e.estado = 'publicada' and i.pessoa_id = :'p_mem' and i.saiu_em is null)),
  'D56: só cultos publicados em que ela está e vai');
select teste.ok(not exists (select 1 from public.agenda_do_link(:'link2') where culto_id = :'culto_rascunho'),
  'D56: escala em rascunho não aparece');

-- "Não vou" tira da agenda; voltar atrás devolve
select a.culto_id as um_culto from public.agenda_do_link(:'link2') a limit 1 \gset
update public.escala_item set saiu_em = now()
where pessoa_id = :'p_mem' and escala_id = (select id from public.escala where culto_id = :'um_culto');
select teste.ok(not exists (select 1 from public.agenda_do_link(:'link2') where culto_id = :'um_culto'), 'D56: quem marcou "não vou" some da agenda');
update public.escala_item set saiu_em = null
where pessoa_id = :'p_mem' and escala_id = (select id from public.escala where culto_id = :'um_culto');

-- Culto cancelado some
update public.culto set estado = 'cancelado' where id = :'um_culto';
select teste.ok(not exists (select 1 from public.agenda_do_link(:'link2') where culto_id = :'um_culto'), 'D56: culto cancelado some da agenda');
update public.culto set estado = 'ativo' where id = :'um_culto';

-- Conta desligada: a agenda fica vazia
update public.conta set estado = 'desativada' where pessoa_id = :'p_mem';
select teste.ok((select count(*) = 0 from public.agenda_do_link(:'link2')), 'D56: conta desligada não vê mais nada pelo link');
update public.conta set estado = 'ativa' where pessoa_id = :'p_mem';

\echo 'TESTES DA AGENDA PASSARAM'
