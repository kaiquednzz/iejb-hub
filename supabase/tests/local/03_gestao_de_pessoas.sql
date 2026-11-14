-- =============================================================================
-- Migração 10: cadastrar pessoa, aprovar pedido, desativar pessoa.
-- Roda depois do 02: ali o fim deixa "lider@teste" como único admin.
-- =============================================================================
\set ON_ERROR_STOP 1

reset role;
insert into auth.users (email, raw_user_meta_data) values
  ('novo@teste', '{"nome": "Novato"}'),
  ('ligar@teste', '{"nome": "Já Cadastrado"}');
select id as c_novo  from public.conta where login = 'novo@teste' \gset
select id as c_ligar from public.conta where login = 'ligar@teste' \gset
select id as louvor from public.ministerio where nome = 'Louvor' \gset
select id as p_lider from public.pessoa where apelido = 'Líder' \gset
select id as p_mem   from public.pessoa where apelido = 'Mem' \gset
set role authenticated;

-- Integrante comum não usa nenhuma das três
select teste.entrar('membro@teste');
select teste.deve_falhar(format($$select public.cadastrar_pessoa('X', null, null, '{}', %L)$$, :'louvor'),
  'integrante não cadastra pessoa');
select teste.deve_falhar(format($$select public.aprovar_pedido(%L, null, 'X', %L)$$, :'c_novo', :'louvor'),
  'integrante não aprova pedido');
select teste.deve_falhar(format($$select public.definir_pessoa_ativa(%L, false)$$, :'p_lider'),
  'integrante não desativa pessoa');

-- Admin (lider@teste ao fim do cenário 02)
select teste.entrar('lider@teste');
select public.cadastrar_pessoa('  Nova Pessoa ', ' Nova ', '', '{voz,violão}', :'louvor') as p_nova \gset
select teste.ok((select nome = 'Nova Pessoa' and apelido = 'Nova' and contato is null
                 from public.pessoa where id = :'p_nova'), 'cadastrar_pessoa limpa espaços e vazios');
select teste.ok((select ativo from public.membro_ministerio where pessoa_id = :'p_nova' and ministerio_id = :'louvor'),
  'pessoa cadastrada já entra no Louvor');

select public.aprovar_pedido(:'c_novo', null, 'Novato da Silva', :'louvor') as p_novato \gset
select teste.ok((select estado = 'ativa' and pessoa_id = :'p_novato' from public.conta where id = :'c_novo'),
  'aprovar pedido com pessoa nova cria a pessoa e ativa a conta');
select teste.ok((select count(*) = 1 from public.membro_ministerio where pessoa_id = :'p_novato'),
  'pessoa criada na aprovação entra no Louvor');

select public.aprovar_pedido(:'c_ligar', :'p_nova', null, :'louvor');
select teste.ok((select pessoa_id = :'p_nova' from public.conta where id = :'c_ligar'),
  'aprovar pedido ligando a pessoa já cadastrada');
select teste.deve_falhar(format($$select public.aprovar_pedido(%L, null, '  ', %L)$$, :'c_novo', :'louvor'),
  'pessoa nova precisa de nome');

-- Desativar e reativar
select public.definir_pessoa_ativa(:'p_mem', false);
select teste.ok((select not p.ativa and not m.ativo from public.pessoa p
                 join public.membro_ministerio m on m.pessoa_id = p.id where p.id = :'p_mem'),
  'RN-13: desativar pessoa desliga também o vínculo com o Louvor');
select teste.entrar('membro@teste');
select teste.ok((select count(*) = 0 from public.pessoa), 'pessoa desativada perde o acesso na hora');
select teste.entrar('lider@teste');
select public.definir_pessoa_ativa(:'p_mem', true);
select teste.ok((select p.ativa and m.ativo from public.pessoa p
                 join public.membro_ministerio m on m.pessoa_id = p.id where p.id = :'p_mem'),
  'reativar pessoa volta o vínculo');
select teste.deve_falhar(format($$select public.definir_pessoa_ativa(%L, false)$$, :'p_lider'),
  'ninguém desativa a si mesmo');

-- Último admin: dá admin a outro, ele tenta desativar o único outro admin
select public.definir_administrador(:'c_novo', true);
select teste.entrar('novo@teste');
select public.definir_administrador(:'c_novo', false) \g /dev/null
reset role;
-- agora só lider@teste é admin; um líder de louvor (não admin) tenta desativá-lo
update public.membro_ministerio set e_lider = true where pessoa_id = :'p_novato';
set role authenticated;
select teste.entrar('novo@teste');
select teste.deve_falhar(format($$select public.definir_pessoa_ativa(%L, false)$$, :'p_lider'),
  'não é possível desativar o último administrador');
reset role;

\warn 'TESTES DA GESTÃO DE PESSOAS PASSARAM'
