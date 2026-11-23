-- =============================================================================
-- Migração: pedidos de oração, aniversários, lembrete de ensaio, pedido de acesso (D69)
-- =============================================================================
\set ON_ERROR_STOP 1
reset role;
select pessoa_id as p_mem  from public.conta where login = 'membro@teste' \gset
select pessoa_id as p_g2   from public.conta where login = 'g2@teste' \gset
select pessoa_id as p_g3   from public.conta where login = 'g3@teste' \gset
select pessoa_id as p_cida from public.conta where login = 'so-membro@teste' \gset
select pessoa_id as p_lid  from public.conta where login = 'lider@teste' \gset
-- Dois pastores: membro (já era) e g2
select set_config('request.jwt.claims', '', false); -- como o banco, sem ninguém logado
update public.pessoa set titulo = 'pastor' where id in (:'p_mem', :'p_g2'); -- título (D71)
delete from public.aviso_destinatario; delete from public.aviso;

set role authenticated;

-- Oração ------------------------------------------------------------------------
select teste.entrar('so-membro@teste');
select teste.ok((select count(*) = 2 from public.pastores_da_igreja()), 'D69: o membro vê os dois pastores para escolher');
select public.pedir_oracao('Pela saúde da minha mãe.', array[:'p_mem']::uuid[]) as ped1 \gset
select public.pedir_oracao('Pelo meu emprego.', array[:'p_mem', :'p_g2']::uuid[], true) as ped2 \gset
select teste.ok((select count(*) = 2 from public.pedido_oracao), 'D69: o autor vê os próprios pedidos');
select teste.deve_falhar(format('select public.pedir_oracao(''Oi oi'', array[%L]::uuid[])', :'p_g3'), 'D69: só vai para quem é pastor');
select teste.deve_falhar('select public.pedir_oracao(''Oi oi'', ''{}'')', 'D69: tem que escolher um pastor');
select teste.deve_falhar(format('select public.pedir_oracao(''  '', array[%L]::uuid[])', :'p_mem'), 'D69: pedido vazio não vai');
select teste.deve_falhar('insert into public.pedido_oracao (autor_id, texto) values (privado.minha_pessoa_id(), ''Direto'')',
  'D69: ninguém grava direto na tabela');

select teste.entrar('membro@teste');
select teste.ok((select count(*) = 2 from public.pedidos_de_oracao_para_mim()), 'D69: o pastor recebe os dois');
select teste.ok((select autor_nome is null and autor_foto is null from public.pedidos_de_oracao_para_mim() where id = :'ped2'),
  'D69: no anônimo o pastor não sabe quem mandou');
select teste.ok((select autor_nome = 'Dona Cida' from public.pedidos_de_oracao_para_mim() where id = :'ped1'), 'D69: no outro, sabe');
select teste.ok((select count(*) = 0 from public.pedido_oracao), 'D69: o pastor não lê a tabela direto (o autor dos anônimos fica escondido)');

select teste.entrar('g2@teste');
select teste.ok((select count(*) = 1 from public.pedidos_de_oracao_para_mim()), 'D69: o outro pastor só vê o que foi para ele');
select teste.deve_falhar(format('select public.marcar_orei(%L)', :'ped1'), 'D69: não marca pedido que não é dele');

select teste.entrar('lider@teste');
select teste.ok((select count(*) = 0 from public.pedidos_de_oracao_para_mim()), 'D69: o administrador não vê pedido de oração');
select teste.ok((select count(*) = 0 from public.pedido_oracao), 'D69: nem pela tabela');

select teste.entrar('membro@teste');
select public.marcar_orei(:'ped2');
select public.marcar_orei(:'ped2'); -- tocar de novo não avisa de novo
select teste.ok((select orado_em is not null from public.pedidos_de_oracao_para_mim() where id = :'ped2'), 'D69: o pastor marca que orou');
reset role;
select teste.ok((select count(*) = 1 from public.aviso where tipo = 'oracao_orada'), 'D69: a pessoa é avisada uma vez só');
select teste.ok((select count(*) = 1 from public.aviso a join public.aviso_destinatario d on d.aviso_id = a.id
                 where a.tipo = 'oracao_orada' and d.pessoa_id = :'p_cida'), 'D69: o aviso vai para o autor, mesmo anônimo');
select teste.ok((select count(*) = 2 from public.aviso where tipo = 'oracao_pedido'), 'D69: cada pedido avisa os pastores');
select teste.ok(not exists (select 1 from public.aviso where tipo = 'oracao_pedido' and resumo like '%emprego%'),
  'D69: o texto do pedido não vai na notificação');
select teste.ok((select resumo = 'Chegou um pedido de oração (sem nome).' from public.aviso a
                 join public.aviso_destinatario d on d.aviso_id = a.id
                 where a.tipo = 'oracao_pedido' and d.pessoa_id = :'p_g2'), 'D69: o anônimo chega sem nome');
set role authenticated;

select teste.entrar('so-membro@teste');
delete from public.pedido_oracao where id = :'ped1';
select teste.ok((select count(*) = 1 from public.pedido_oracao), 'D69: o autor apaga o seu');
select public.pedir_oracao('Pedido um', array[:'p_mem']::uuid[]);
select public.pedir_oracao('Pedido dois', array[:'p_mem']::uuid[]);
select public.pedir_oracao('Pedido três', array[:'p_mem']::uuid[]);
select public.pedir_oracao('Pedido quatro', array[:'p_mem']::uuid[]);
select teste.deve_falhar(format('select public.pedir_oracao(''Pedido seis'', array[%L]::uuid[])', :'p_mem'), 'D69: no máximo 5 por dia');

reset role;
update public.pedido_oracao set criado_em = now() - interval '31 days' where id = :'ped2';
select teste.ok(privado.apagar_pedidos_antigos() = 1, 'D69: pedido de mais de 30 dias é apagado');
select teste.ok(not exists (select 1 from public.pedido_oracao_destino where pedido_id = :'ped2'), 'D69: com os destinos');

-- Aniversário -------------------------------------------------------------------
set role authenticated;
select teste.entrar('so-membro@teste');
select public.definir_meu_aniversario(15, 3);
select teste.deve_falhar('select public.definir_meu_aniversario(31, 4)', 'D69: 31 de abril não existe');
select teste.deve_falhar('select public.definir_meu_aniversario(10, null)', 'D69: dia sem mês não passa');
select teste.entrar('g3@teste');
select teste.ok((select aniversario_dia = 15 and aniversario_mes = 3 from public.pessoa where id = :'p_cida'), 'D69: a igreja vê o aniversário');
select public.definir_meu_aniversario(15, 3);
select teste.entrar('membro@teste');
select public.definir_meu_aniversario(29, 2);
reset role;

select teste.ok(privado.avisar_aniversarios('2027-03-14') = 2, 'D69: véspera de dois aniversários');
select teste.ok((select count(*) = 1 from public.aviso where tipo = 'aniversario'), 'D69: dois no mesmo dia viram um aviso só');
select teste.ok((select resumo from public.aviso where tipo = 'aniversario') like 'Amanhã é aniversário de % e %!%', 'D69: com os dois nomes');
select teste.ok(not exists (select 1 from public.aviso a join public.aviso_destinatario d on d.aviso_id = a.id
                            where a.tipo = 'aniversario' and d.pessoa_id in (:'p_cida', :'p_g3')), 'D69: o aniversariante não recebe o próprio');
select teste.ok(exists (select 1 from public.aviso a join public.aviso_destinatario d on d.aviso_id = a.id
                        where a.tipo = 'aniversario' and d.pessoa_id = :'p_mem'), 'D69: o resto da igreja recebe');
delete from public.aviso_destinatario; delete from public.aviso;
select teste.ok(privado.avisar_aniversarios('2027-02-28') = 1, 'D69: 29/02 é lembrado em 28/02 nos anos comuns');
select teste.ok(privado.avisar_aniversarios('2027-02-28') = 0, 'D69: rodar duas vezes no dia não repete');
select teste.ok(privado.avisar_aniversarios('2027-06-01') = 0, 'D69: dia sem aniversário não avisa nada');

-- Lembrete de ensaio ------------------------------------------------------------
delete from public.aviso_destinatario; delete from public.aviso;
insert into public.culto (nome, data, horario) values ('Culto de Teste', date '2027-05-09', '18:00') returning id as c_teste \gset
insert into public.escala (culto_id, ministerio_id, estado, publicada_em)
select :'c_teste', id, 'publicada', now() from public.ministerio where nome = 'Louvor' returning id as e_teste \gset
insert into public.escala_item (escala_id, pessoa_id) values (:'e_teste', :'p_g3'), (:'e_teste', :'p_g2');
update public.escala_item set saiu_em = now() where escala_id = :'e_teste' and pessoa_id = :'p_g2';
select teste.ok(privado.lembrar_ensaio('2027-05-05') = 0, 'D69: 4 dias antes ainda não lembra');
select teste.ok(privado.lembrar_ensaio('2027-05-06') = 1, 'D69: 3 dias antes lembra');
select teste.ok((select resumo = 'Domingo tem Culto de Teste. Bora ensaiar!' from public.aviso where tipo = 'lembrete_ensaio'), 'D69: com o dia da semana');
select teste.ok((select array_agg(d.pessoa_id) = array[:'p_g3']::uuid[] from public.aviso a join public.aviso_destinatario d on d.aviso_id = a.id
                 where a.tipo = 'lembrete_ensaio'), 'D69: só para quem toca (quem disse que não vai fica de fora)');
select teste.ok(privado.lembrar_ensaio('2027-05-06') = 0, 'D69: não lembra duas vezes');
insert into public.culto (nome, data, horario) values ('Culto Rascunho', date '2027-05-12', '19:30') returning id as c_rasc \gset
insert into public.escala (culto_id, ministerio_id) select :'c_rasc', id from public.ministerio where nome = 'Louvor';
select teste.ok(privado.lembrar_ensaio('2027-05-09') = 0, 'D69: escala em rascunho não lembra');

-- Pedido de acesso --------------------------------------------------------------
delete from public.aviso_destinatario; delete from public.aviso;
insert into auth.users (email, raw_user_meta_data) values ('chegou@teste', '{"nome": "Chegou"}');
set role authenticated;
select teste.entrar('chegou@teste');
select public.apresentar_me('Maria Chegou');
reset role;
select teste.ok((select resumo = 'Maria Chegou pediu acesso ao Hub.' from public.aviso where tipo = 'acesso_pedido'), 'D69: o admin é avisado do pedido de acesso');
select teste.ok((select array_agg(d.pessoa_id) = array[:'p_lid']::uuid[] from public.aviso a join public.aviso_destinatario d on d.aviso_id = a.id
                 where a.tipo = 'acesso_pedido'), 'D69: só os administradores');
set role authenticated;
select teste.entrar('chegou@teste');
select public.apresentar_me('Maria Chegou de Novo');
reset role;
select teste.ok((select count(*) = 1 from public.aviso where tipo = 'acesso_pedido'), 'D69: mudar o pedido não avisa de novo');
