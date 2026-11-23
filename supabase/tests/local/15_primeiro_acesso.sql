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
select public.apresentar_me(p_nome => '  Fulano de Tal ', p_foto => format('contas/%s/%s.webp', :'conta_nova', gen_random_uuid()), p_cargos => array['tesouraria']);
reset role;
select teste.ok((select nome_informado = 'Fulano de Tal' and foto_informada like 'contas/%' and apresentou_em is not null
                 from public.conta where id = :'conta_nova'), 'D62: nome e foto ficam no pedido');
select teste.ok((select cargos_pedidos = array['tesouraria'] from public.conta where id = :'conta_nova'), 'D62: o cargo pedido fica no pedido');
select teste.ok(not exists (select 1 from public.cargo_pessoa cp join public.conta c on c.pessoa_id = cp.pessoa_id where c.id = :'conta_nova'),
  'D62: pedir cargo não dá o cargo');
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
select teste.deve_falhar('select public.apresentar_me(''Fulano'', null, p_cargos => array[''admin''])', 'D62: não dá para pedir cargo que não existe');

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

-- Pedido de função: Louvor com instrumentos e um cargo -------------------------
select id as louvor from public.ministerio where nome = 'Louvor' \gset
set role authenticated;
select teste.entrar('segundo@teste');
select public.apresentar_me('Segundo', null, p_cargos => array['tesouraria'], p_ministerios => array[:'louvor']::uuid[], p_instrumentos => array['Bateria', ' Voz ', 'Bateria']);
select teste.deve_falhar('select public.apresentar_me(''Segundo'', null, p_cargos => array[''dono''])', 'D62: só pede cargos que existem');
reset role;
select teste.ok((select louvor_pedido and cargos_pedidos = array['tesouraria'] and instrumentos_pedidos @> array['Bateria', 'Voz']
                        and cardinality(instrumentos_pedidos) = 2 from public.conta where id = :'conta_outra'),
  'D62: o pedido guarda funções e instrumentos (sem repetir)');

-- Louvor + instrumentos + cargo
set role authenticated;
select teste.entrar_so_com_senha('lider@teste');
select public.aprovar_pedido(:'conta_outra', null, 'Segundo da Silva', 'membro', array[:'louvor']::uuid[], array['Bateria', 'Voz'], array['tesouraria']) as p_seg \gset
reset role;
select teste.ok(exists (select 1 from public.membro_ministerio where pessoa_id = :'p_seg' and ministerio_id = :'louvor' and ativo), 'D62: aprovado no Louvor');
select teste.ok((select instrumentos @> array['Bateria', 'Voz'] from public.pessoa where id = :'p_seg'), 'D62: instrumentos vão para o cadastro');
select teste.ok(exists (select 1 from public.cargo_pessoa where pessoa_id = :'p_seg' and cargo = 'tesouraria'), 'D62: cargo aprovado');

-- Sem marcar Louvor: não vira do Louvor (antes virava sempre)
insert into auth.users (email, raw_user_meta_data) values ('terceiro@teste', '{}');
select id as conta_3 from public.conta where login = 'terceiro@teste' \gset
set role authenticated;
select teste.entrar('lider@teste');
select public.aprovar_pedido(:'conta_3', null, 'Terceiro') as p_3 \gset
reset role;
select teste.ok(not exists (select 1 from public.membro_ministerio where pessoa_id = :'p_3'), 'D62: sem Louvor marcado, não entra no Louvor');

\echo 'TESTES DO PRIMEIRO ACESSO PASSARAM'
