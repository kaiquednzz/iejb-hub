-- =============================================================================
-- Migração 13: aparelhos de push e a fila de envio.
-- =============================================================================
\set ON_ERROR_STOP 1
set role authenticated;

select teste.entrar('pendente@teste');
select teste.deve_falhar($$select public.registrar_aparelho('https://push.exemplo/a', 'k', 'a')$$,
  'conta pendente não registra aparelho');

select teste.entrar('membro@teste');
select public.registrar_aparelho('https://push.exemplo/a', 'k1', 'a1');
select teste.ok((select count(*) = 1 from public.dispositivo_push where endpoint = 'https://push.exemplo/a'), 'integrante registra o próprio aparelho');
select public.registrar_aparelho('https://push.exemplo/a', 'k2', 'a2');
select teste.ok((select chave_p256dh = 'k2' from public.dispositivo_push where endpoint = 'https://push.exemplo/a'),
  'registrar de novo atualiza as chaves (sem duplicar)');

-- Mesmo celular, outra conta entrou: o aparelho passa a ser dela
select teste.entrar('g2@teste');
select public.registrar_aparelho('https://push.exemplo/a', 'k3', 'a3');
select teste.ok((select count(*) = 1 from public.dispositivo_push where endpoint = 'https://push.exemplo/a'), 'o aparelho agora é da conta que entrou');
select teste.entrar('membro@teste');
select teste.ok((select count(*) = 0 from public.dispositivo_push where endpoint = 'https://push.exemplo/a'), 'e a conta anterior não vê mais esse aparelho');

select teste.deve_falhar($$select * from public.reservar_pushes()$$, 'usuário logado não mexe na fila de envio');
select teste.deve_falhar($$select * from public.chave_push$$, 'usuário logado não lê as chaves do push');
reset role;

-- A fila (como a função de servidor chama, com poder total)
select public.processar_avisos_pendentes(interval '0 seconds');
select count(*) as pendentes from public.aviso_destinatario where push_enviado_em is null \gset
select teste.ok(:pendentes > 0, 'tem avisos esperando push');
select count(*) as entregas from public.reservar_pushes() \gset
select teste.ok((select count(*) = 0 from public.aviso_destinatario where push_enviado_em is null and criado_em > now() - interval '1 day'),
  'reservar marca todos os pendentes');
select teste.ok((select count(*) = 0 from public.reservar_pushes()), 'reservar de novo não devolve nada (ninguém recebe duas vezes)');

set role anon;
select teste.deve_falhar($$select public.registrar_aparelho('https://x', 'k', 'a')$$, 'deslogado não registra aparelho');
reset role;

\warn 'TESTES DO PUSH PASSARAM'
