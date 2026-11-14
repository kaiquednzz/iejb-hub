-- =============================================================================
-- 02. Grupos (G1, G2, G3) e seus membros
-- Modelo de dados v0.3, seção 3.2 | Regras: RN-11, RN-12, RN-16, RN-17
-- =============================================================================

create table public.grupo (
  id              uuid primary key default gen_random_uuid(),
  ministerio_id   uuid not null references public.ministerio (id) on delete restrict,
  nome            text not null check (length(trim(nome)) > 0),
  lider_pessoa_id uuid,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  unique (ministerio_id, nome)
);
comment on column public.grupo.lider_pessoa_id is 'Um único líder, que precisa ser membro do grupo (RN-12). Garantido pela chave estrangeira grupo_lider_e_membro.';

create table public.grupo_membro (
  id            uuid primary key default gen_random_uuid(),
  grupo_id      uuid not null references public.grupo (id) on delete restrict,
  pessoa_id     uuid not null references public.pessoa (id) on delete restrict,
  instrumentos  text[] not null default '{}',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (grupo_id, pessoa_id)
);
comment on column public.grupo_membro.instrumentos is 'Instrumentos padrão da pessoa NESTE grupo (Q16, Q18, Q19). Copiados para a escala ao escalar o grupo.';

-- Truque para a RN-12: o par (grupo, líder) tem que existir em grupo_membro.
-- Se o líder for nulo, a chave não é conferida (grupo sem líder ainda).
-- Tentar tirar do grupo quem é líder falha: troque o líder antes.
alter table public.grupo
  add constraint grupo_lider_e_membro
  foreign key (id, lider_pessoa_id)
  references public.grupo_membro (grupo_id, pessoa_id)
  on delete restrict;

create index grupo_membro_pessoa_idx on public.grupo_membro (pessoa_id);

create trigger tocar before update on public.grupo        for each row execute function privado.tocar_atualizado_em();
create trigger tocar before update on public.grupo_membro for each row execute function privado.tocar_atualizado_em();

-- Só entra no grupo quem é integrante ativo do ministério do grupo.
create function privado.membro_do_grupo_e_do_ministerio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.grupo g
    join public.membro_ministerio m
      on m.ministerio_id = g.ministerio_id and m.pessoa_id = new.pessoa_id and m.ativo
    where g.id = new.grupo_id
  ) then
    raise exception 'A pessoa precisa ser integrante ativa do ministério do grupo.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger membro_do_ministerio
before insert or update of grupo_id, pessoa_id on public.grupo_membro
for each row execute function privado.membro_do_grupo_e_do_ministerio();

-- -----------------------------------------------------------------------------
-- Auxiliares
-- -----------------------------------------------------------------------------
create function privado.ministerio_do_grupo(p_grupo uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ministerio_id from public.grupo where id = p_grupo;
$$;

create function privado.lidera_grupo(p_grupo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.grupo g
    where g.id = p_grupo
      and g.ativo
      and g.lider_pessoa_id = privado.minha_pessoa_id()
  );
$$;

create function privado.lidera_algum_grupo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.grupo g
    where g.ativo and g.lider_pessoa_id = privado.minha_pessoa_id()
  );
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.grupo        enable row level security;
alter table public.grupo_membro enable row level security;

create policy "grupo: integrantes do ministério veem"
on public.grupo for select to authenticated
using (privado.e_integrante(ministerio_id) or privado.e_admin());

create policy "grupo: admin e líder de louvor criam"
on public.grupo for insert to authenticated
with check (privado.e_admin() or privado.e_lider_louvor(ministerio_id));

create policy "grupo: admin e líder de louvor editam"
on public.grupo for update to authenticated
using (privado.e_admin() or privado.e_lider_louvor(ministerio_id))
with check (privado.e_admin() or privado.e_lider_louvor(ministerio_id));

create policy "grupo_membro: integrantes do ministério veem"
on public.grupo_membro for select to authenticated
using (
  privado.e_integrante(privado.ministerio_do_grupo(grupo_id)) or privado.e_admin()
);

-- Líder de grupo mexe só no próprio grupo (RN-16).
create policy "grupo_membro: admin, líder de louvor e líder do grupo incluem"
on public.grupo_membro for insert to authenticated
with check (
  privado.e_admin()
  or privado.e_lider_louvor(privado.ministerio_do_grupo(grupo_id))
  or privado.lidera_grupo(grupo_id)
);

create policy "grupo_membro: admin, líder de louvor e líder do grupo editam"
on public.grupo_membro for update to authenticated
using (
  privado.e_admin()
  or privado.e_lider_louvor(privado.ministerio_do_grupo(grupo_id))
  or privado.lidera_grupo(grupo_id)
)
with check (
  privado.e_admin()
  or privado.e_lider_louvor(privado.ministerio_do_grupo(grupo_id))
  or privado.lidera_grupo(grupo_id)
);

create policy "grupo_membro: admin, líder de louvor e líder do grupo tiram"
on public.grupo_membro for delete to authenticated
using (
  privado.e_admin()
  or privado.e_lider_louvor(privado.ministerio_do_grupo(grupo_id))
  or privado.lidera_grupo(grupo_id)
);
