-- =============================================================================
-- 03. Tipos de culto e cultos
-- Modelo de dados v0.3, seção 3.3 | Regras: RN-20 a RN-23
-- Cultos são compartilhados entre ministérios (um culto pode ter várias escalas).
-- =============================================================================

create table public.tipo_culto (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null unique check (length(trim(nome)) > 0),
  dia_semana    smallint not null check (dia_semana between 0 and 6),
  horario       time not null,
  tem_louvor    boolean not null default true,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on column public.tipo_culto.dia_semana is '0 = domingo, 1 = segunda, ..., 6 = sábado (mesmo padrão do extract(dow) do Postgres).';

create table public.culto (
  id            uuid primary key default gen_random_uuid(),
  tipo_culto_id uuid references public.tipo_culto (id) on delete restrict,
  nome          text not null check (length(trim(nome)) > 0),
  data          date not null,
  horario       time not null,
  tem_louvor    boolean not null default true,
  estado        text not null default 'ativo' check (estado in ('ativo', 'cancelado')),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on column public.culto.tipo_culto_id is 'Vazio nos cultos especiais (RN-22).';

-- Um culto recorrente por tipo e data: gerar duas vezes não duplica.
create unique index culto_tipo_data_unico on public.culto (tipo_culto_id, data)
  where tipo_culto_id is not null;
create index culto_data_idx on public.culto (data);

create trigger tocar before update on public.tipo_culto for each row execute function privado.tocar_atualizado_em();
create trigger tocar before update on public.culto      for each row execute function privado.tocar_atualizado_em();

-- -----------------------------------------------------------------------------
-- RLS: todos com conta pronta veem; administrador e líder editam.
-- Não há DELETE: culto se cancela (RN-23).
-- -----------------------------------------------------------------------------
alter table public.tipo_culto enable row level security;
alter table public.culto      enable row level security;

create policy "tipo_culto: contas prontas veem"
on public.tipo_culto for select to authenticated
using (privado.minha_pessoa_id() is not null);

create policy "tipo_culto: admin e líder criam"
on public.tipo_culto for insert to authenticated
with check (privado.e_admin() or privado.e_lider_de_algum_ministerio());

create policy "tipo_culto: admin e líder editam"
on public.tipo_culto for update to authenticated
using (privado.e_admin() or privado.e_lider_de_algum_ministerio())
with check (privado.e_admin() or privado.e_lider_de_algum_ministerio());

create policy "culto: contas prontas veem"
on public.culto for select to authenticated
using (privado.minha_pessoa_id() is not null);

create policy "culto: admin e líder criam"
on public.culto for insert to authenticated
with check (privado.e_admin() or privado.e_lider_de_algum_ministerio());

create policy "culto: admin e líder editam"
on public.culto for update to authenticated
using (privado.e_admin() or privado.e_lider_de_algum_ministerio())
with check (privado.e_admin() or privado.e_lider_de_algum_ministerio());

-- -----------------------------------------------------------------------------
-- Gera os cultos recorrentes de hoje até p_ate (RN-21).
-- Roda com o poder de quem chamou, então as políticas de INSERT acima valem.
-- "Hoje" é o dia em Brasília, não no fuso do servidor.
-- -----------------------------------------------------------------------------
create function public.gerar_cultos(p_ate date)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_hoje  date := (now() at time zone 'America/Sao_Paulo')::date;
  v_total integer;
begin
  if p_ate > v_hoje + 366 then
    raise exception 'Gere no máximo um ano à frente.';
  end if;

  insert into public.culto (tipo_culto_id, nome, data, horario, tem_louvor)
  select t.id, t.nome, d::date, t.horario, t.tem_louvor
  from public.tipo_culto t
  cross join generate_series(v_hoje, p_ate, interval '1 day') as d
  where t.ativo and extract(dow from d) = t.dia_semana
  on conflict (tipo_culto_id, data) where tipo_culto_id is not null do nothing;

  get diagnostics v_total = row_count;
  return v_total;
end;
$$;
