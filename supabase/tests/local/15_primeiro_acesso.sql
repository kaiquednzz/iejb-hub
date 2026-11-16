-- =============================================================================
-- Migração 29: primeiro acesso com nome e foto (D62)
-- =============================================================================
\set ON_ERROR_STOP 1
reset role;
insert into auth.users (email, raw_user_meta_data) values ('primeiro@teste', '{"nome": "fulano"}'), ('segundo@teste', '{"nome": "Outro"}');
select id as conta_nova from public.conta where login = 'primeiro@teste' \gset
select id as conta_outra from public.conta where login = 'segundo@teste' \gset
select teste.ok((select estado = 'pendente' and apresentou_em is null from public.conta where id = :'conta_nova'), 'D62: conta nova começa sem ter se apresentado');

set role authenticated;
select teste.entrar('primeiro@teste');
select public.apresentar_me('  Fulano de Tal ', format('contas/%s/%s.webp', :'conta_nova', gen_random_uuid()));
reset role;
select teste.ok((select nome_informado = 'Fulano de Tal' and foto_informada like 'contas/%' and apresentou_em is not null
                 from public.conta where id = :'conta_nova'), 'D62: nome e foto ficam no pedido');
select set_config('request.jwt.claims', '', false);
select teste.ok(privado.pode_mudar_foto_no_caminho(format('contas/%s/%s.webp', :'conta_nova', gen_random_uuid())) is not true,
  'D62: sem login ninguém sobe foto na pasta da conta');

set role authenticated;
select teste.entrar('primeiro@teste');
select teste.ok(privado.pode_mudar_foto_no_caminho(format('contas/%s/%s.webp', :'conta_nova', gen_random_uuid())), 'D62: a pessoa sobe foto na própria pasta');
select teste.ok(not privado.pode_mudar_foto_no_caminho(format('contas/%s/%s.webp', :'conta_outra', gen_random_uuid())), 'D62: e não na pasta de outra conta');
select teste.deve_falhar(format('select public.apresentar_me(''Fulano'', %L)', format('contas/%s/%s.webp', :'conta_outra', gen_random_uuid())),
  'D62: não aponta para a foto de outra conta');
select teste.deve_falhar('select public.apresentar_me('' '')', 'D62: nome vazio não passa');

-- Já aprovada: não mexe mais por aqui
select teste.entrar('membro@teste');
select teste.deve_falhar('select public.apresentar_me(''Outro nome'')', 'D62: conta ativa não usa o primeiro acesso');

-- Aprovação leva a foto para a pessoa
reset role;
insert into public.pessoa (nome) values ('Fulano de Tal') returning id as p_nova \gset
set role authenticated;
select teste.entrar('lider@teste');
select public.aprovar_conta(:'conta_nova', :'p_nova');
reset role;
select teste.ok((select foto = (select foto_informada from public.conta where id = :'conta_nova') from public.pessoa where id = :'p_nova'),
  'D62: aprovada, a foto vai para o cadastro');

\echo 'TESTES DO PRIMEIRO ACESSO PASSARAM'
