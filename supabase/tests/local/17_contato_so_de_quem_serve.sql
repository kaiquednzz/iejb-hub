-- =============================================================================
-- Migração: contato só para quem serve (D68)
-- =============================================================================
\set ON_ERROR_STOP 1
reset role;
select pessoa_id as p_g3 from public.conta where login = 'g3@teste' \gset
update public.pessoa set contato = '(11) 99999-0000' where id = :'p_g3';
-- Um membro que não serve em nada: conta ativa, sem ministério e sem cargo
insert into auth.users (email, raw_user_meta_data) values ('so-membro@teste', '{"nome": "Dona Cida"}');
insert into public.pessoa (nome) values ('Dona Cida') returning id as p_cida \gset
update public.conta set estado = 'ativa', pessoa_id = :'p_cida' where login = 'so-membro@teste';

set role authenticated;
select teste.entrar('so-membro@teste');
select teste.ok((select count(*) > 0 from public.pessoa), 'D68: o membro vê os nomes (mural e escala precisam)');
select teste.deve_falhar('select contato from public.pessoa', 'D68: o membro não lê a coluna de contato');
select teste.ok((select count(*) = 0 from public.contatos_da_equipe()), 'D68: e a função não devolve contato para ele');

select teste.entrar('g3@teste');
select teste.ok((select contato = '(11) 99999-0000' from public.contatos_da_equipe() where pessoa_id = :'p_g3'), 'D68: quem serve vê os contatos');
select teste.deve_falhar('select contato from public.pessoa', 'D68: mas também só pela função');

select teste.entrar('lider@teste');
select teste.ok((select count(*) >= 1 from public.contatos_da_equipe()), 'D68: o administrador vê os contatos');
select public.atualizar_meu_contato('(11) 98888-7777');
reset role;
select teste.ok((select contato = '(11) 98888-7777' from public.pessoa p join public.conta c on c.pessoa_id = p.id where c.login = 'lider@teste'),
  'D68: cada um ainda muda o próprio contato');
