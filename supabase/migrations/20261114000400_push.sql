-- =============================================================================
-- 13. Notificações push (D18, D25, RN-41 a RN-45, RN-63)
--
-- Caminho de um aviso:
--   1. Gatilhos anotam a mudança (escala_alteracao) — já existia.
--   2. processar_avisos_pendentes() cria o aviso e os destinatários — já existia.
--   3. NOVO: a cada minuto, se tem destinatário sem push, o pg_cron chama a
--      função de servidor enviar-push, que reserva os pendentes de forma
--      atômica (reservar_pushes) e entrega em cada aparelho da pessoa.
--
-- As chaves VAPID (que assinam os pushes) são geradas pela própria função na
-- primeira vez e guardadas em chave_push, que só o servidor lê. Assim a chave
-- privada nunca passa por ninguém.
-- =============================================================================

create table public.chave_push (
  id        smallint primary key default 1 check (id = 1),
  publica   text not null,
  privada   jsonb not null,
  criado_em timestamptz not null default now()
);
comment on table public.chave_push is 'Par de chaves VAPID do Hub (uma linha só). Só a chave de serviço lê: RLS ligado e nenhuma política.';
alter table public.chave_push enable row level security;
revoke all on public.chave_push from anon, authenticated;

-- O aparelho registra (ou reassume) a inscrição de push.
-- Definer porque o mesmo aparelho pode trocar de conta (sair e entrar com
-- outra): o endpoint passa a ser da conta que está logada agora.
create function public.registrar_aparelho(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if privado.minha_pessoa_id() is null then
    raise exception 'Conta sem acesso.' using errcode = 'insufficient_privilege';
  end if;
  insert into public.dispositivo_push (conta_id, endpoint, chave_p256dh, chave_auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set conta_id = auth.uid(), chave_p256dh = excluded.chave_p256dh,
        chave_auth = excluded.chave_auth, ativo = true;
end;
$$;

-- Reserva até p_limite destinatários sem push (das últimas 24 h) e devolve
-- para quais aparelhos mandar. "for update skip locked": duas execuções ao
-- mesmo tempo nunca pegam o mesmo aviso (ninguém recebe duas vezes).
-- Quem não tem aparelho também é marcado: o aviso continua na central do app.
create function public.reservar_pushes(p_limite integer default 200)
returns table (
  destinatario_id uuid, tipo text, resumo text, escala_id uuid,
  dispositivo_id uuid, endpoint text, chave_p256dh text, chave_auth text
)
language sql
security definer
set search_path = ''
as $$
  with reservados as (
    update public.aviso_destinatario d
    set push_enviado_em = now()
    where d.id in (
      select id from public.aviso_destinatario
      where push_enviado_em is null and criado_em > now() - interval '1 day'
      order by criado_em
      limit p_limite
      for update skip locked
    )
    returning d.id, d.aviso_id, d.pessoa_id
  )
  select r.id, a.tipo, a.resumo, a.escala_id, dp.id, dp.endpoint, dp.chave_p256dh, dp.chave_auth
  from reservados r
  join public.aviso a on a.id = r.aviso_id
  join public.conta c on c.pessoa_id = r.pessoa_id and c.estado = 'ativa'
  join public.dispositivo_push dp on dp.conta_id = c.id and dp.ativo;
$$;

-- Tem push esperando? (o agendamento só chama a função quando tem)
create function privado.tem_push_pendente()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.aviso_destinatario
    where push_enviado_em is null and criado_em > now() - interval '1 day'
  );
$$;

revoke execute on function
  public.registrar_aparelho(text, text, text),
  public.reservar_pushes(integer),
  privado.tem_push_pendente()
from public, anon, authenticated;
grant execute on function public.registrar_aparelho(text, text, text) to authenticated;
grant execute on function public.reservar_pushes(integer), privado.tem_push_pendente() to service_role;
grant all on public.chave_push to service_role;

-- Agendamento: só no Supabase de verdade (testes locais não têm pg_net/pg_cron)
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net')
     and exists (select 1 from pg_extension where extname = 'pg_cron') then
    create extension if not exists pg_net;
    perform cron.schedule(
      'enviar-push',
      '* * * * *',
      $cron$
        select net.http_post(
          url := 'https://hqalztygktkabwybmdyl.supabase.co/functions/v1/enviar-push',
          body := '{}'::jsonb,
          headers := '{"Content-Type": "application/json"}'::jsonb,
          timeout_milliseconds := 20000
        )
        where privado.tem_push_pendente()
      $cron$
    );
  end if;
end;
$$;
