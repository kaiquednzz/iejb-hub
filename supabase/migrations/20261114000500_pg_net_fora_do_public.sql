-- =============================================================================
-- 14. pg_net fora do esquema public (apontado pelo verificador)
-- A migração 13 criou a extensão sem dizer o esquema, e ela caiu no public
-- (exposto pela API). As funções dela ficam no esquema "net" de qualquer
-- jeito; recriar no "extensions" não muda o agendamento enviar-push.
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_net') then
    drop extension pg_net;
    create extension pg_net with schema extensions;
  end if;
end;
$$;
