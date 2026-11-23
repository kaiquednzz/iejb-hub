-- =============================================================================
-- Migrações 24 e 25: cargos (D45) e financeiro (D46 a D49)
-- =============================================================================
\set ON_ERROR_STOP 1
reset role;
select pessoa_id as p_gabi from public.conta where login = 'g2@teste' \gset
select pessoa_id as p_mem  from public.conta where login = 'membro@teste' \gset
select pessoa_id as p_avu  from public.conta where login = 'avulso@teste' \gset
select pessoa_id as p_g3   from public.conta where login = 'g3@teste' \gset
select id as pagbank from public.conta_financeira where nome = 'PagBank' \gset
select id as caixa   from public.conta_financeira where nome = 'Caixa (dinheiro)' \gset
select id as cat_ofertas from public.categoria_financeira where papel = 'ofertas' \gset
select id as cat_agua    from public.categoria_financeira where nome = 'Água e luz' \gset

set role authenticated;

-- Cargos ------------------------------------------------------------------------
select teste.entrar('g2@teste');
select teste.deve_falhar(format('insert into public.cargo_pessoa (pessoa_id, cargo) values (%L, ''tesouraria'')', :'p_gabi'),
  'D45: quem não é admin não se dá cargo');
select teste.entrar('lider@teste');
insert into public.cargo_pessoa (pessoa_id, cargo) values (:'p_gabi', 'tesouraria'), (:'p_mem', 've_financeiro'), (:'p_avu', 'comunicacao');
select teste.deve_falhar(format('insert into public.cargo_pessoa (pessoa_id, cargo) values (%L, ''tesoureiro_chefe'')', :'p_g3'),
  'D45: só os cargos da lista');
reset role;
select teste.ok((select count(*) = 3 from public.registro_auditoria where acao = 'cargo_dado'), 'D45: dar cargo fica no rastro');
set role authenticated;

-- Admin não vê o financeiro por ser admin
select teste.entrar('lider@teste');
select teste.ok((select count(*) = 0 from public.conta_financeira), 'D45: admin sem cargo não vê as contas');
select teste.ok((select (public.resumo_financeiro(current_date) -> 'contas') = '[]'::jsonb), 'D45: nem o resumo');

-- Comunicação cuida dos eventos
select teste.entrar('avulso@teste');
insert into public.evento (titulo, categoria, descricao, data, horario, publicado)
values ('Noite de louvor', 'Louvor', 'Uma noite inteira de adoração juntos.', current_date + 20, '19:30', false);
select teste.ok((select count(*) >= 1 from public.evento where titulo = 'Noite de louvor'), 'D45: comunicação cria evento');
select teste.entrar('g3@teste');
select teste.ok((select count(*) = 0 from public.evento), 'D45: quem não é da comunicação não vê eventos');

-- Lançamentos --------------------------------------------------------------------
select teste.entrar('g2@teste');
select teste.ok((select count(*) = 2 from public.conta_financeira), 'D46: tesouraria vê as contas');
update public.conta_financeira set saldo_inicial_centavos = 10000, saldo_inicial_em = current_date - 30 where id = :'pagbank';
insert into public.lancamento (tipo, conta_id, categoria_id, valor_centavos, data, forma, criado_por)
values ('entrada', :'pagbank', :'cat_ofertas', 5000, current_date, 'pix', :'p_gabi') returning id as l1 \gset
insert into public.lancamento (tipo, conta_id, categoria_id, valor_centavos, data, forma, criado_por)
values ('saida', :'pagbank', :'cat_agua', 2000, current_date, 'boleto', :'p_gabi');
insert into public.lancamento (tipo, conta_id, categoria_id, valor_centavos, data, criado_por)
values ('entrada', :'pagbank', :'cat_ofertas', 999, current_date, :'p_gabi') returning id as l3 \gset
select teste.deve_falhar(format('insert into public.lancamento (tipo, conta_id, categoria_id, valor_centavos, data, criado_por) values (''saida'', %L, %L, 100, current_date, %L)', :'pagbank', :'cat_ofertas', :'p_gabi'),
  'D46: saída não usa categoria de entrada');
select teste.deve_falhar(format('insert into public.lancamento (tipo, conta_id, categoria_id, valor_centavos, data, criado_por) values (''entrada'', %L, %L, 100, current_date, %L)', :'pagbank', :'cat_ofertas', :'p_mem'),
  'D46: não se lança em nome de outra pessoa');
select teste.deve_falhar(format('insert into public.lancamento (tipo, conta_id, valor_centavos, data, criado_por) values (''transferencia'', %L, 100, current_date, %L)', :'pagbank', :'p_gabi'),
  'D46: transferência precisa de destino');
select teste.deve_falhar(format('insert into public.lancamento (tipo, conta_id, categoria_id, valor_centavos, data, criado_por) values (''entrada'', %L, %L, -5, current_date, %L)', :'pagbank', :'cat_ofertas', :'p_gabi'),
  'D46: valor positivo');
select teste.deve_falhar(format('delete from public.lancamento where id = %L', :'l1'), 'D46: lançamento não se apaga');

update public.lancamento set valor_centavos = 6000 where id = :'l1';
select teste.ok((select count(*) = 1 from public.lancamento_historico where lancamento_id = :'l1' and acao = 'editado'
  and (antes ->> 'valor_centavos') = '5000' and (depois ->> 'valor_centavos') = '6000'), 'D46: edição fica no histórico com antes e depois');
select teste.deve_falhar(format('update public.lancamento set cancelado_em = now(), cancelado_por = %L where id = %L', :'p_gabi', :'l3'),
  'D46: cancelar exige motivo');
update public.lancamento set cancelado_em = now(), cancelado_por = :'p_gabi', motivo_cancelamento = 'Lançado em dobro' where id = :'l3';
select teste.ok((select count(*) = 1 from public.lancamento_historico where lancamento_id = :'l3' and acao = 'cancelado'), 'D46: cancelamento no histórico');
select teste.deve_falhar(format('update public.lancamento set valor_centavos = 1 where id = %L', :'l3'), 'D46: cancelado não muda mais');

-- Pastor lê, não escreve
select teste.entrar('membro@teste');
select teste.ok((select count(*) = 3 from public.lancamento), 'D45: pastor vê os lançamentos');
select teste.deve_falhar(format('insert into public.lancamento (tipo, conta_id, categoria_id, valor_centavos, data, criado_por) values (''entrada'', %L, %L, 100, current_date, %L)', :'pagbank', :'cat_ofertas', :'p_mem'),
  'D45: pastor não lança');
update public.lancamento set valor_centavos = 1 where id = :'l1';
select teste.ok((select valor_centavos = 6000 from public.lancamento where id = :'l1'), 'D45: pastor não edita');

-- Contagem com dupla conferência -------------------------------------------------
select teste.entrar('g2@teste');
select teste.ok((select count(*) > 0 and bool_and(id <> :'p_gabi') from public.quem_pode_conferir()), 'D48: lista quem pode conferir, sem quem conta');
select teste.entrar('membro@teste');
select teste.ok((select count(*) = 0 from public.quem_pode_conferir()), 'D48: só a tesouraria lista conferentes');
select teste.entrar('g2@teste');
select teste.deve_falhar(format('insert into public.contagem (data, conta_id, dizimos_centavos, ofertas_centavos, contado_por, conferente_id) values (current_date, %L, 100, 0, %L, %L)', :'caixa', :'p_gabi', :'p_gabi'),
  'D48: quem conta não confere a própria contagem');
insert into public.contagem (data, conta_id, dizimos_centavos, ofertas_centavos, contado_por, conferente_id)
values (current_date, :'caixa', 3000, 1500, :'p_gabi', :'p_avu') returning id as cont \gset
reset role;
select teste.ok((select count(*) = 1 from public.aviso a join public.aviso_destinatario d on d.aviso_id = a.id
  where a.tipo = 'contagem_para_conferir' and d.pessoa_id = :'p_avu'), 'D48: conferente é avisado');
set role authenticated;
select teste.ok((select count(*) = 0 from public.lancamento where contagem_id = :'cont'), 'D48: antes de conferir não entra no caixa');

select teste.entrar('g3@teste');
select teste.ok((select count(*) = 0 from public.contagem), 'D48: quem não é conferente não vê a contagem');
select teste.deve_falhar(format('select public.decidir_contagem(%L, true)', :'cont'), 'D48: só o conferente decide');

select teste.entrar('avulso@teste');
select teste.ok((select count(*) = 1 from public.contagem where id = :'cont'), 'D48: conferente vê a contagem dele');
select teste.ok((select count(*) = 0 from public.lancamento), 'D48: conferente não vê o resto do financeiro');
select public.decidir_contagem(:'cont', true);
select teste.deve_falhar(format('select public.decidir_contagem(%L, true)', :'cont'), 'D48: não decide duas vezes');

select teste.entrar('g2@teste');
select teste.ok((select count(*) = 2 and sum(valor_centavos) = 4500 from public.lancamento where contagem_id = :'cont'),
  'D48: conferida vira dízimos e ofertas no caixa');
select id as lc from public.lancamento where contagem_id = :'cont' limit 1 \gset
select teste.deve_falhar(format('update public.lancamento set valor_centavos = 1 where id = %L', :'lc'),
  'D48: lançamento de contagem conferida não se edita');

insert into public.contagem (data, conta_id, dizimos_centavos, contado_por, conferente_id)
values (current_date, :'caixa', 700, :'p_gabi', :'p_avu') returning id as cont2 \gset
select teste.entrar('avulso@teste');
select teste.deve_falhar(format('select public.decidir_contagem(%L, false)', :'cont2'), 'D48: recusar exige dizer o que não bateu');
select public.decidir_contagem(:'cont2', false, 'Contei 6,00');
select teste.entrar('g2@teste');
select teste.ok((select count(*) = 0 from public.lancamento where contagem_id = :'cont2'), 'D48: recusada não entra no caixa');

-- Depositar o dinheiro no banco e conferir os saldos -----------------------------
insert into public.lancamento (tipo, conta_id, conta_destino_id, valor_centavos, data, criado_por)
values ('transferencia', :'caixa', :'pagbank', 4000, current_date, :'p_gabi');
select public.resumo_financeiro(current_date) as resumo \gset
select teste.ok((select (c ->> 'saldo')::bigint = 18000 from jsonb_array_elements((:'resumo')::jsonb -> 'contas') c where c ->> 'nome' = 'PagBank'),
  'D46: saldo do PagBank = inicial + entradas - saídas + depósito');
select teste.ok((select (c ->> 'saldo')::bigint = 500 from jsonb_array_elements((:'resumo')::jsonb -> 'contas') c where c ->> 'nome' = 'Caixa (dinheiro)'),
  'D46: saldo do caixa = contagem - depósito');
select teste.ok(((:'resumo')::jsonb ->> 'entradas')::bigint = 10500 and ((:'resumo')::jsonb ->> 'saidas')::bigint = 2000,
  'D46: entradas e saídas do mês sem transferência e sem cancelado');
select teste.entrar('membro@teste');
select teste.ok((select public.resumo_financeiro(current_date)::text = :'resumo'), 'D45: pastor vê o mesmo resumo');
reset role;
\warn 'TESTES DOS CARGOS E DO FINANCEIRO PASSARAM'
