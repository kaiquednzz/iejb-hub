-- =============================================================================
-- Migração: cadastro da igreja toda (D71)
-- =============================================================================
\set ON_ERROR_STOP 1
reset role;
select pessoa_id as p_g3  from public.conta where login = 'g3@teste' \gset
select pessoa_id as p_mem from public.conta where login = 'membro@teste' \gset
select pessoa_id as p_cida from public.conta where login = 'so-membro@teste' \gset
select id as louvor from public.ministerio where nome = 'Louvor' \gset
-- (aqui o admin é o lider@teste, que também é líder de louvor)

set role authenticated;

-- Ministérios ---------------------------------------------------------------------
select teste.entrar('lider@teste');
insert into public.ministerio (nome) values ('Kids') returning id as kids \gset
select teste.ok(:'kids' is not null, 'D71: o administrador cria um ministério');
select teste.deve_falhar(format('update public.ministerio set nome = ''Música'' where id = %L', :'louvor'), 'D71: o Louvor não muda de nome');
select teste.entrar('g3@teste');
select teste.deve_falhar('insert into public.ministerio (nome) values (''Recepção'')', 'D71: membro não cria ministério');

-- Cadastro com título e ministérios ------------------------------------------------
select teste.entrar('lider@teste');
select public.cadastrar_pessoa('Dona Lúcia', p_titulo => 'diaconisa') as p_lucia \gset
select teste.ok((select titulo = 'diaconisa' from public.pessoa where id = :'p_lucia'), 'D71: admin cadastra com título');
select teste.ok(not exists (select 1 from public.membro_ministerio where pessoa_id = :'p_lucia'), 'D71: e sem ministério (membro que não serve em área)');
select public.cadastrar_pessoa('Tia Bia', p_ministerios => array[:'kids']::uuid[]) as p_bia \gset
update public.membro_ministerio set e_lider = true where pessoa_id = :'p_bia' and ministerio_id = :'kids';
select teste.ok((select e_lider from public.membro_ministerio where pessoa_id = :'p_bia' and ministerio_id = :'kids'), 'D71: líder do Kids');

-- A líder do Kids (com conta) cuida do Kids, não do Louvor, e não dá título
reset role;
insert into auth.users (email) values ('bia@teste');
update public.conta set estado = 'ativa', pessoa_id = :'p_bia' where login = 'bia@teste';
set role authenticated;
select teste.entrar('bia@teste');
select public.cadastrar_pessoa('Criança Ajudante', p_ministerios => array[:'kids']::uuid[]) as p_aj \gset
select teste.ok(exists (select 1 from public.membro_ministerio where pessoa_id = :'p_aj' and ministerio_id = :'kids'), 'D71: a líder do Kids cadastra no Kids');
select teste.deve_falhar(format('select public.cadastrar_pessoa(''Intruso'', p_ministerios => array[%L]::uuid[])', :'louvor'), 'D71: mas não no Louvor');
select teste.deve_falhar(format('select public.cadastrar_pessoa(''Pastor Falso'', p_ministerios => array[%L]::uuid[], p_titulo => ''pastor'')', :'kids'),
  'D71: líder não dá título');
select teste.deve_falhar(format('update public.pessoa set titulo = ''pastor'' where id = %L', :'p_aj'), 'D71: nem muda título depois');
select teste.deve_falhar('select public.cadastrar_pessoa(''Sem lugar'')', 'D71: líder tem que pôr no ministério dele');

-- Quem serve onde é público para quem tem conta
select teste.entrar('g3@teste');
select teste.ok((select count(*) >= 2 from public.membro_ministerio where ministerio_id = :'kids'), 'D71: todo mundo vê quem serve no Kids');

-- Título x permissão --------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '', false); -- como o banco, sem ninguém logado
update public.pessoa set titulo = 'pastora' where id = :'p_lucia';
insert into auth.users (email) values ('lucia@teste');
update public.conta set estado = 'ativa', pessoa_id = :'p_lucia' where login = 'lucia@teste';
set role authenticated;
select teste.entrar('lucia@teste');
select teste.ok(privado.publica_no_mural(), 'D71: pastora publica no mural (vem com o título)');
select teste.ok((select count(*) = 0 from public.lancamento), 'D71: mas não vê o caixa só por ser pastora');
select teste.entrar('so-membro@teste');
select teste.ok(exists (select 1 from public.pastores_da_igreja() where id = :'p_lucia'), 'D71: e recebe pedido de oração');
select teste.entrar('lider@teste');
insert into public.cargo_pessoa (pessoa_id, cargo) values (:'p_lucia', 've_financeiro');
select teste.entrar('lucia@teste');
select teste.ok((select count(*) > 0 from public.lancamento), 'D71: o administrador escolhe a pastora que vê o caixa');
select teste.deve_falhar('insert into public.lancamento (tipo, valor_centavos, data, categoria_id, conta_id) select ''entrada'', 100, current_date, id, (select id from public.conta_financeira limit 1) from public.categoria_financeira limit 1',
  'D71: ver o caixa não é lançar');
reset role;
select teste.deve_falhar(format('insert into public.cargo_pessoa (pessoa_id, cargo) values (%L, ''pastor'')', :'p_g3'), 'D71: "pastor" não é mais cargo');

-- Primeiro acesso e aprovação -----------------------------------------------------
insert into auth.users (email) values ('nova@teste');
select id as c_nova from public.conta where login = 'nova@teste' \gset
set role authenticated;
select teste.entrar('nova@teste');
select teste.ok((select count(*) >= 2 from public.ministerios_para_escolher()), 'D71: o pedido vê os ministérios para escolher');
select teste.ok((select nome = 'Louvor' from public.ministerios_para_escolher() limit 1), 'D71: Louvor primeiro');
select public.apresentar_me('Maria Nova', p_titulo => 'presbitero', p_ministerios => array[:'kids']::uuid[]);
reset role;
select teste.ok((select titulo_pedido = 'presbitero' and ministerios_pedidos = array[:'kids']::uuid[] and not louvor_pedido
                 from public.conta where id = :'c_nova'), 'D71: o pedido guarda título e ministérios');
set role authenticated;
select teste.entrar('lider@teste');
select public.aprovar_pedido(:'c_nova', null, 'Maria Nova', 'diaconisa', array[:'kids']::uuid[]) as p_maria \gset
select teste.ok((select titulo = 'diaconisa' from public.pessoa where id = :'p_maria'), 'D71: o admin aprova com o título que decidir');
select teste.ok(exists (select 1 from public.membro_ministerio where pessoa_id = :'p_maria' and ministerio_id = :'kids'), 'D71: e no ministério escolhido');

-- Convite pelo Gmail --------------------------------------------------------------
select public.cadastrar_pessoa('Seu Antônio') as p_ant \gset
select public.definir_email_de_convite(:'p_ant', '  Antonio.Silva@Gmail.com ') = 'esperando' as ok \gset
select teste.ok(:'ok', 'D71: admin põe o Gmail de quem vai entrar');
select teste.ok((select email = 'antonio.silva@gmail.com' from public.convites_por_email() where pessoa_id = :'p_ant'), 'D71: guardado em minúsculas');
select teste.deve_falhar(format('select public.definir_email_de_convite(%L, ''antonio.silva@gmail.com'')', :'p_maria'), 'D71: um e-mail, uma pessoa');
select teste.deve_falhar(format('select public.definir_email_de_convite(%L, ''sem arroba'')', :'p_maria'), 'D71: e-mail tem que parecer e-mail');
select teste.entrar('g3@teste');
select teste.deve_falhar('select email_convite from public.pessoa', 'D71: membro não lê os e-mails de convite');
select teste.ok((select count(*) = 0 from public.convites_por_email()), 'D71: nem pela função');
reset role;

-- Alguém se cadastra com SENHA usando o e-mail dele: não entra no lugar dele
insert into auth.users (email, raw_app_meta_data) values ('antonio.silva@gmail.com', '{"provider": "email"}');
select teste.ok((select estado = 'pendente' and pessoa_id is null from public.conta where login = 'antonio.silva@gmail.com'),
  'D71: cadastro com senha não usa o convite (qualquer um digitaria o e-mail)');
delete from public.conta where login = 'antonio.silva@gmail.com';
delete from auth.users where email = 'antonio.silva@gmail.com';

-- Ele entra com o Google: a conta já nasce ativa, na ficha dele
insert into auth.users (email, raw_app_meta_data) values ('antonio.silva@gmail.com', '{"provider": "google", "providers": ["google"]}');
select teste.ok((select estado = 'ativa' and pessoa_id = :'p_ant' from public.conta where login = 'antonio.silva@gmail.com'),
  'D71: entrou com o Google, já está dentro e ligado à ficha');
set role authenticated;
select teste.entrar('lider@teste');
select teste.ok(not exists (select 1 from public.convites_por_email() where pessoa_id = :'p_ant'), 'D71: e sai da lista de convites');

-- Quem pediu antes do convite: pôr o Gmail aprova na hora
reset role;
insert into auth.users (email, raw_app_meta_data) values ('chegou.antes@gmail.com', '{"provider": "google"}');
set role authenticated;
select teste.entrar('lider@teste');
select public.cadastrar_pessoa('Chegou Antes') as p_antes \gset
select teste.ok(public.definir_email_de_convite(:'p_antes', 'chegou.antes@gmail.com') = 'aprovada', 'D71: pedido que já esperava é aprovado na hora');
reset role;
select teste.ok((select estado = 'ativa' and pessoa_id = :'p_antes' from public.conta where login = 'chegou.antes@gmail.com'), 'D71: ligado à ficha certa');
