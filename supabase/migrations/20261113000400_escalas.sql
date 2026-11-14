-- =============================================================================
-- 04. Escalas, registro de alterações e solicitações
-- Modelo de dados v0.3, seção 3.4 | Regras: RN-02, RN-30 a RN-39, RN-70
--
-- A escala é uma lista de PESSOAS (escala_item). O grupo é só um atalho de
-- preenchimento; quais grupos foram usados fica em escala_grupo, porque isso
-- decide quem pode editar o repertório e pedir alterações (RN-56, Q20, Q21).
-- =============================================================================

create table public.escala (
  id            uuid primary key default gen_random_uuid(),
  culto_id      uuid not null references public.culto (id) on delete restrict,
  ministerio_id uuid not null references public.ministerio (id) on delete restrict,
  estado        text not null default 'rascunho' check (estado in ('rascunho', 'publicada')),
  publicada_em  timestamptz,
  alterada_por  uuid references public.pessoa (id) on delete set null,
  alterada_em   timestamptz not null default now(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (culto_id, ministerio_id)
);
comment on table public.escala is 'Uma escala por culto e ministério. Rascunho só o líder de louvor vê; publicada todos veem (RN-34).';

create table public.escala_item (
  id                  uuid primary key default gen_random_uuid(),
  escala_id           uuid not null references public.escala (id) on delete cascade,
  pessoa_id           uuid not null references public.pessoa (id) on delete restrict,
  instrumento_exibido text[] not null default '{}',
  origem_grupo_id     uuid references public.grupo (id) on delete set null,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  unique (escala_id, pessoa_id)
);
comment on column public.escala_item.instrumento_exibido is 'Cópia do padrão da pessoa no grupo, ajustável por culto (RN-17, Q19). Mudar o padrão depois não reescreve escalas antigas.';
comment on column public.escala_item.origem_grupo_id is 'Grupo usado como atalho para incluir a pessoa. Vazio para avulsas. Só informativo.';

create table public.escala_grupo (
  escala_id uuid not null references public.escala (id) on delete cascade,
  grupo_id  uuid not null references public.grupo (id) on delete restrict,
  criado_em timestamptz not null default now(),
  primary key (escala_id, grupo_id)
);

-- Só acréscimo. Alimenta os avisos (RN-41, RN-45): sem ele o Hub não saberia
-- quem SAIU da escala. As colunas processada_em e aviso_id são criadas na
-- migração de avisos (06).
create table public.escala_alteracao (
  id        uuid primary key default gen_random_uuid(),
  escala_id uuid not null references public.escala (id) on delete cascade,
  tipo      text not null check (tipo in (
              'publicada', 'entrou', 'saiu', 'instrumento_mudou',
              'culto_cancelado', 'repertorio_alterado')),
  pessoa_id uuid references public.pessoa (id) on delete restrict,
  feita_por uuid references public.pessoa (id) on delete set null,
  feita_em  timestamptz not null default now()
);

create table public.solicitacao_alteracao (
  id              uuid primary key default gen_random_uuid(),
  escala_id       uuid not null references public.escala (id) on delete restrict,
  autor_pessoa_id uuid not null default privado.minha_pessoa_id()
                  references public.pessoa (id) on delete restrict,
  texto           text not null check (length(trim(texto)) between 1 and 1000),
  estado          text not null default 'pendente'
                  check (estado in ('pendente', 'aprovada', 'reprovada')),
  motivo          text check (motivo is null or length(motivo) <= 500),
  decidida_por    uuid references public.pessoa (id) on delete set null,
  decidida_em     timestamptz,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

create index escala_item_pessoa_idx           on public.escala_item (pessoa_id);
create index escala_grupo_grupo_idx           on public.escala_grupo (grupo_id);
create index escala_alteracao_escala_idx      on public.escala_alteracao (escala_id, feita_em);
create index solicitacao_alteracao_escala_idx on public.solicitacao_alteracao (escala_id);

create trigger tocar before update on public.escala                for each row execute function privado.tocar_atualizado_em();
create trigger tocar before update on public.escala_item           for each row execute function privado.tocar_atualizado_em();
create trigger tocar before update on public.solicitacao_alteracao for each row execute function privado.tocar_atualizado_em();

-- -----------------------------------------------------------------------------
-- Auxiliares
-- -----------------------------------------------------------------------------
create function privado.ministerio_da_escala(p_escala uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ministerio_id from public.escala where id = p_escala;
$$;

-- Rascunho: só o líder de louvor. Publicada: integrantes do ministério e admin.
create function privado.pode_ver_escala(p_escala uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.escala e
    where e.id = p_escala
      and (
        privado.e_lider_louvor(e.ministerio_id)
        or (e.estado = 'publicada'
            and (privado.e_integrante(e.ministerio_id) or privado.e_admin()))
      )
  );
$$;

-- O líder de um dos grupos usados numa escala JÁ PUBLICADA (Q20, Q21).
create function privado.lidera_grupo_na_escala(p_escala uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.escala e
    join public.escala_grupo eg on eg.escala_id = e.id
    join public.grupo g on g.id = eg.grupo_id
    where e.id = p_escala
      and e.estado = 'publicada'
      and g.ativo
      and g.lider_pessoa_id = privado.minha_pessoa_id()
  );
$$;

-- Grava uma linha no registro de alterações (só o sistema escreve lá).
create function privado.registrar_alteracao(p_escala uuid, p_tipo text, p_pessoa uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.escala_alteracao (escala_id, tipo, pessoa_id, feita_por)
  values (p_escala, p_tipo, p_pessoa, privado.minha_pessoa_id());
$$;

-- -----------------------------------------------------------------------------
-- Regras da escala
-- -----------------------------------------------------------------------------
create function privado.validar_escala()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Só cultos com louvor e não cancelados recebem escala (RN-20, RN-23).
    if not exists (
      select 1 from public.culto c
      where c.id = new.culto_id and c.tem_louvor and c.estado = 'ativo'
    ) then
      raise exception 'Esse culto não tem louvor ou está cancelado.'
        using errcode = 'check_violation';
    end if;
  else
    if new.culto_id <> old.culto_id or new.ministerio_id <> old.ministerio_id then
      raise exception 'Não é possível mover uma escala para outro culto ou ministério.';
    end if;
    -- Publicada não volta a rascunho: os integrantes já viram e foram avisados.
    if old.estado = 'publicada' and new.estado = 'rascunho' then
      raise exception 'Uma escala publicada não volta a ser rascunho.';
    end if;
  end if;

  if new.estado = 'publicada' and new.publicada_em is null then
    new.publicada_em := now();
  end if;

  -- Quem fez a última alteração e quando (RN-35).
  new.alterada_por := privado.minha_pessoa_id();
  new.alterada_em  := now();
  return new;
end;
$$;

create trigger validar_escala
before insert or update on public.escala
for each row execute function privado.validar_escala();

create function privado.registrar_publicacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estado = 'publicada' and old.estado = 'rascunho' then
    perform privado.registrar_alteracao(new.id, 'publicada', null);
  end if;
  return null;
end;
$$;

create trigger registrar_publicacao
after update of estado on public.escala
for each row execute function privado.registrar_publicacao();

-- Cada pessoa da escala precisa ser integrante ativa do ministério.
-- Se veio de um grupo e não tem instrumento definido, copia o padrão do grupo.
create function privado.preparar_escala_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ministerio uuid;
begin
  if tg_op = 'UPDATE' and (new.escala_id <> old.escala_id or new.pessoa_id <> old.pessoa_id) then
    raise exception 'Para trocar a pessoa, tire uma e inclua a outra.';
  end if;

  select ministerio_id into v_ministerio from public.escala where id = new.escala_id;

  if not exists (
    select 1 from public.membro_ministerio m
    join public.pessoa p on p.id = m.pessoa_id
    where m.pessoa_id = new.pessoa_id and m.ministerio_id = v_ministerio
      and m.ativo and p.ativa
  ) then
    raise exception 'A pessoa precisa ser integrante ativa do ministério.'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'INSERT' and cardinality(new.instrumento_exibido) = 0
     and new.origem_grupo_id is not null then
    select gm.instrumentos into new.instrumento_exibido
    from public.grupo_membro gm
    where gm.grupo_id = new.origem_grupo_id and gm.pessoa_id = new.pessoa_id;
    new.instrumento_exibido := coalesce(new.instrumento_exibido, '{}');
  end if;

  return new;
end;
$$;

create trigger preparar_escala_item
before insert or update on public.escala_item
for each row execute function privado.preparar_escala_item();

-- Mudanças em escala PUBLICADA vão para o registro de alterações e atualizam
-- "alterada_por/alterada_em". Em rascunho não registra nada (não avisa ninguém).
create function privado.registrar_mudanca_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_escala uuid := coalesce(new.escala_id, old.escala_id);
  v_estado text;
begin
  select estado into v_estado from public.escala where id = v_escala;
  -- Escala apagada (cascata) ou ainda rascunho: nada a registrar.
  if v_estado is distinct from 'publicada' then
    return null;
  end if;

  if tg_op = 'INSERT' then
    perform privado.registrar_alteracao(v_escala, 'entrou', new.pessoa_id);
  elsif tg_op = 'DELETE' then
    perform privado.registrar_alteracao(v_escala, 'saiu', old.pessoa_id);
  elsif new.instrumento_exibido is distinct from old.instrumento_exibido then
    perform privado.registrar_alteracao(v_escala, 'instrumento_mudou', new.pessoa_id);
  else
    return null;
  end if;

  update public.escala
  set alterada_por = privado.minha_pessoa_id(), alterada_em = now()
  where id = v_escala;
  return null;
end;
$$;

create trigger registrar_mudanca_item
after insert or update or delete on public.escala_item
for each row execute function privado.registrar_mudanca_item();

-- O grupo usado precisa ser do mesmo ministério da escala.
create function privado.validar_escala_grupo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if privado.ministerio_do_grupo(new.grupo_id) is distinct from privado.ministerio_da_escala(new.escala_id) then
    raise exception 'O grupo não é do mesmo ministério da escala.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger validar_escala_grupo
before insert or update on public.escala_grupo
for each row execute function privado.validar_escala_grupo();

-- Culto cancelado: registra em cada escala publicada para avisar os escalados (RN-23).
create function privado.registrar_cancelamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_escala uuid;
begin
  if new.estado = 'cancelado' and old.estado = 'ativo' then
    for v_escala in
      select id from public.escala where culto_id = new.id and estado = 'publicada'
    loop
      perform privado.registrar_alteracao(v_escala, 'culto_cancelado', null);
    end loop;
  end if;
  return null;
end;
$$;

create trigger registrar_cancelamento
after update of estado on public.culto
for each row execute function privado.registrar_cancelamento();

-- Solicitação: só muda pela função decidir_solicitacao.
create function privado.validar_solicitacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.escala_id <> old.escala_id or new.autor_pessoa_id <> old.autor_pessoa_id
       or new.texto <> old.texto then
      raise exception 'O conteúdo da solicitação não pode ser alterado.';
    end if;
    if old.estado <> 'pendente' then
      raise exception 'Essa solicitação já foi decidida.';
    end if;
  end if;
  return new;
end;
$$;

create trigger validar_solicitacao
before update on public.solicitacao_alteracao
for each row execute function privado.validar_solicitacao();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.escala                enable row level security;
alter table public.escala_item           enable row level security;
alter table public.escala_grupo          enable row level security;
alter table public.escala_alteracao      enable row level security;
alter table public.solicitacao_alteracao enable row level security;

-- escala: administrador NÃO edita nem vê rascunho (RN-02; modelo 5.3, caso 1).
create policy "escala: ver conforme o estado"
on public.escala for select to authenticated
using (
  privado.e_lider_louvor(ministerio_id)
  or (estado = 'publicada' and (privado.e_integrante(ministerio_id) or privado.e_admin()))
);

create policy "escala: líder de louvor cria"
on public.escala for insert to authenticated
with check (privado.e_lider_louvor(ministerio_id));

create policy "escala: líder de louvor edita"
on public.escala for update to authenticated
using (privado.e_lider_louvor(ministerio_id))
with check (privado.e_lider_louvor(ministerio_id));

create policy "escala: líder de louvor apaga rascunho"
on public.escala for delete to authenticated
using (privado.e_lider_louvor(ministerio_id) and estado = 'rascunho');

create policy "escala_item: ver junto com a escala"
on public.escala_item for select to authenticated
using (privado.pode_ver_escala(escala_id));

create policy "escala_item: líder de louvor inclui"
on public.escala_item for insert to authenticated
with check (privado.e_lider_louvor(privado.ministerio_da_escala(escala_id)));

create policy "escala_item: líder de louvor edita"
on public.escala_item for update to authenticated
using (privado.e_lider_louvor(privado.ministerio_da_escala(escala_id)))
with check (privado.e_lider_louvor(privado.ministerio_da_escala(escala_id)));

create policy "escala_item: líder de louvor tira"
on public.escala_item for delete to authenticated
using (privado.e_lider_louvor(privado.ministerio_da_escala(escala_id)));

create policy "escala_grupo: ver junto com a escala"
on public.escala_grupo for select to authenticated
using (privado.pode_ver_escala(escala_id));

create policy "escala_grupo: líder de louvor inclui"
on public.escala_grupo for insert to authenticated
with check (privado.e_lider_louvor(privado.ministerio_da_escala(escala_id)));

create policy "escala_grupo: líder de louvor tira"
on public.escala_grupo for delete to authenticated
using (privado.e_lider_louvor(privado.ministerio_da_escala(escala_id)));

create policy "escala_alteracao: admin e líder de louvor veem"
on public.escala_alteracao for select to authenticated
using (privado.e_admin() or privado.e_lider_louvor(privado.ministerio_da_escala(escala_id)));

-- Solicitação: líder de grupo pede só nas escalas publicadas do próprio grupo (Q20).
create policy "solicitacao: líder do grupo escalado pede"
on public.solicitacao_alteracao for insert to authenticated
with check (
  autor_pessoa_id = privado.minha_pessoa_id()
  and estado = 'pendente'
  and decidida_por is null
  and decidida_em is null
  and motivo is null
  and privado.lidera_grupo_na_escala(escala_id)
);

create policy "solicitacao: autor e líder de louvor veem"
on public.solicitacao_alteracao for select to authenticated
using (
  autor_pessoa_id = privado.minha_pessoa_id()
  or privado.e_lider_louvor(privado.ministerio_da_escala(escala_id))
);

-- -----------------------------------------------------------------------------
-- Funções do app
-- -----------------------------------------------------------------------------

-- Atalho de preenchimento (RN-31, RN-32): coloca os membros ativos do grupo na
-- escala e anota o grupo em escala_grupo. Quem já está não duplica (RN-33).
-- Roda com o poder de quem chamou: só o líder de louvor consegue.
create function public.preencher_escala_com_grupo(p_escala uuid, p_grupo uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_total integer;
begin
  insert into public.escala_grupo (escala_id, grupo_id)
  values (p_escala, p_grupo)
  on conflict do nothing;

  insert into public.escala_item (escala_id, pessoa_id, origem_grupo_id)
  select p_escala, gm.pessoa_id, p_grupo
  from public.grupo_membro gm
  join public.pessoa p on p.id = gm.pessoa_id and p.ativa
  join public.grupo g on g.id = gm.grupo_id
  join public.membro_ministerio m
    on m.pessoa_id = gm.pessoa_id and m.ministerio_id = g.ministerio_id and m.ativo
  where gm.grupo_id = p_grupo
  on conflict (escala_id, pessoa_id) do nothing;

  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

-- O líder de louvor aprova ou reprova (RN-38, RN-39). Aprovar NÃO muda a
-- escala sozinho: ele edita a escala, e é a edição que gera o aviso.
create function public.decidir_solicitacao(p_solicitacao uuid, p_aprovar boolean, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_escala uuid;
begin
  select escala_id into v_escala from public.solicitacao_alteracao where id = p_solicitacao;

  if v_escala is null or not privado.e_lider_louvor(privado.ministerio_da_escala(v_escala)) then
    raise exception 'Apenas o líder de louvor pode decidir essa solicitação.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.solicitacao_alteracao
  set estado = case when p_aprovar then 'aprovada' else 'reprovada' end,
      motivo = case when p_aprovar then null else nullif(trim(p_motivo), '') end,
      decidida_por = privado.minha_pessoa_id(),
      decidida_em = now()
  where id = p_solicitacao;
end;
$$;
