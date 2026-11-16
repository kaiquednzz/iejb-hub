-- =============================================================================
-- Migração 26: os meus cultos na agenda do celular (D56)
--
-- Cada pessoa pode ter um link secreto de calendário (assinatura .ics). A
-- agenda do celular (Calendário do iPhone, Google Agenda) busca esse link de
-- tempos em tempos, então escala trocada ou culto cancelado se atualizam lá
-- sozinhos. Quem lê o link é a função de servidor "agenda", com a chave de
-- serviço: o calendário do celular não tem como mandar o login da pessoa.
--
-- O link vale como senha só para ver os PRÓPRIOS cultos daquela pessoa.
-- "Trocar link" gera outro e o antigo para de funcionar na hora.
-- =============================================================================

create table public.agenda_link (
  pessoa_id uuid primary key references public.pessoa (id) on delete cascade,
  token     text not null unique check (token ~ '^[0-9a-f]{64}$'),
  criado_em timestamptz not null default now()
);
comment on table public.agenda_link is 'Link secreto da assinatura de calendário de cada pessoa (D56). Só as funções abaixo leem.';

alter table public.agenda_link enable row level security;
-- Sem políticas: ninguém lê direto pela API, só pelas funções
revoke all on table public.agenda_link from anon, authenticated;

-- O link da pessoa logada (cria na primeira vez; p_trocar gera outro)
create function public.meu_link_da_agenda(p_trocar boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pessoa uuid := privado.minha_pessoa_id();
  v_token  text;
begin
  if v_pessoa is null then
    raise exception 'Conta sem acesso.' using errcode = 'insufficient_privilege';
  end if;
  -- Dois UUID v4 aleatórios = 244 bits: impossível de adivinhar
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  if p_trocar then
    insert into public.agenda_link (pessoa_id, token) values (v_pessoa, v_token)
    on conflict (pessoa_id) do update set token = excluded.token, criado_em = now();
    return v_token;
  end if;
  insert into public.agenda_link (pessoa_id, token) values (v_pessoa, v_token)
  on conflict (pessoa_id) do nothing;
  return (select token from public.agenda_link where pessoa_id = v_pessoa);
end;
$$;
revoke execute on function public.meu_link_da_agenda(boolean) from public, anon;
grant execute on function public.meu_link_da_agenda(boolean) to authenticated;

-- Os cultos do dono do link: escala publicada, culto ativo, sem "não vou",
-- dos últimos 60 dias em diante. Conta desligada ou pessoa desativada: nada.
-- Só a chave de serviço (função "agenda") chama.
create function public.agenda_do_link(p_token text)
returns table (
  culto_id     uuid,
  nome         text,
  rotulo       text,
  data         date,
  horario      time,
  instrumentos text[],
  grupos       text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.nome, c.rotulo, c.data, c.horario, ei.instrumento_exibido,
         (select string_agg(g.nome, ' + ' order by g.nome)
            from public.escala_grupo eg join public.grupo g on g.id = eg.grupo_id
           where eg.escala_id = e.id)
  from public.agenda_link al
  join public.pessoa p on p.id = al.pessoa_id and p.ativa
  join public.conta ct on ct.pessoa_id = p.id and ct.estado = 'ativa'
  join public.escala_item ei on ei.pessoa_id = p.id and ei.saiu_em is null
  join public.escala e on e.id = ei.escala_id and e.estado = 'publicada'
  join public.culto c on c.id = e.culto_id and c.estado = 'ativo'
  where al.token = p_token
    and c.data >= (now() at time zone 'America/Sao_Paulo')::date - 60
  order by c.data, c.horario;
$$;
revoke execute on function public.agenda_do_link(text) from public, anon, authenticated;
grant execute on function public.agenda_do_link(text) to service_role;
