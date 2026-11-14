-- =============================================================================
-- 05. Músicas e repertório
-- Modelo de dados v0.3, seção 3.5 | Regras: RN-50 a RN-56, Q13, Q21
-- =============================================================================

create table public.musica (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null check (length(trim(titulo)) > 0),
  artista       text,
  link          text check (link is null or link ~* '^https?://'),
  ativa         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.musica is 'Cadastrada uma vez e reaproveitada (RN-52). Música usada em repertório não pode ser apagada, só desativada.';

-- Evita cadastrar a mesma música duas vezes por diferença de maiúsculas.
create unique index musica_titulo_artista_unico
  on public.musica (lower(titulo), lower(coalesce(artista, '')));

create table public.repertorio_item (
  id            uuid primary key default gen_random_uuid(),
  culto_id      uuid not null references public.culto (id) on delete restrict,
  ministerio_id uuid not null references public.ministerio (id) on delete restrict,
  musica_id     uuid not null references public.musica (id) on delete restrict,
  posicao       integer not null check (posicao > 0),
  tom           text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- DEFERRABLE: a unicidade é conferida no fim de cada comando, não linha a
  -- linha. Assim dá para reordenar com um único UPDATE sem colisão temporária.
  constraint repertorio_posicao_unica unique (culto_id, ministerio_id, posicao)
    deferrable initially immediate
);
comment on column public.repertorio_item.tom is 'O tom NESTE culto (RN-51). A mesma música pode ter tons diferentes em cultos diferentes.';

create index repertorio_item_musica_idx on public.repertorio_item (musica_id);

create trigger tocar before update on public.musica          for each row execute function privado.tocar_atualizado_em();
create trigger tocar before update on public.repertorio_item for each row execute function privado.tocar_atualizado_em();

-- -----------------------------------------------------------------------------
-- Quem edita o repertório de um culto (RN-50, RN-56, Q13, Q21):
--   administrador e líder de louvor: qualquer culto;
--   líder de grupo: só quando o grupo dele foi usado numa escala PUBLICADA
--   daquele culto. Culto só com avulsos não tem líder de grupo (Q13).
-- -----------------------------------------------------------------------------
create function privado.pode_editar_repertorio(p_culto uuid, p_ministerio uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select privado.e_admin()
      or privado.e_lider_louvor(p_ministerio)
      or exists (
        select 1
        from public.escala e
        join public.escala_grupo eg on eg.escala_id = e.id
        join public.grupo g on g.id = eg.grupo_id
        where e.culto_id = p_culto
          and e.ministerio_id = p_ministerio
          and e.estado = 'publicada'
          and g.ativo
          and g.lider_pessoa_id = privado.minha_pessoa_id()
      );
$$;

-- Sem posição informada, a música entra no fim da lista.
create function privado.posicionar_no_fim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.posicao is null then
    select coalesce(max(posicao), 0) + 1 into new.posicao
    from public.repertorio_item
    where culto_id = new.culto_id and ministerio_id = new.ministerio_id;
  end if;
  return new;
end;
$$;

create trigger posicionar_no_fim
before insert on public.repertorio_item
for each row execute function privado.posicionar_no_fim();

-- Ao tirar uma música, as de baixo sobem uma posição (a lista fica 1, 2, 3...).
create function privado.fechar_buraco()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.repertorio_item
  set posicao = posicao - 1
  where culto_id = old.culto_id and ministerio_id = old.ministerio_id
    and posicao > old.posicao;
  return null;
end;
$$;

create trigger fechar_buraco
after delete on public.repertorio_item
for each row execute function privado.fechar_buraco();

-- Mudança no repertório gera aviso para os escalados (RN-55). Uma linha basta
-- até o próximo aviso sair: os detalhes estão no próprio repertório.
-- O gatilho é criado na migração 06, depois que processada_em existe.
create function privado.registrar_mudanca_repertorio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_culto      uuid := coalesce(new.culto_id, old.culto_id);
  v_ministerio uuid := coalesce(new.ministerio_id, old.ministerio_id);
  v_escala     uuid;
begin
  select id into v_escala from public.escala
  where culto_id = v_culto and ministerio_id = v_ministerio and estado = 'publicada';

  if v_escala is not null and not exists (
    select 1 from public.escala_alteracao
    where escala_id = v_escala and tipo = 'repertorio_alterado' and processada_em is null
  ) then
    perform privado.registrar_alteracao(v_escala, 'repertorio_alterado', null);
  end if;
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.musica          enable row level security;
alter table public.repertorio_item enable row level security;

create policy "musica: contas prontas veem"
on public.musica for select to authenticated
using (privado.minha_pessoa_id() is not null);

create policy "musica: admin e líderes cadastram"
on public.musica for insert to authenticated
with check (privado.e_admin() or privado.e_lider_de_algum_ministerio() or privado.lidera_algum_grupo());

create policy "musica: admin e líderes editam"
on public.musica for update to authenticated
using (privado.e_admin() or privado.e_lider_de_algum_ministerio() or privado.lidera_algum_grupo())
with check (privado.e_admin() or privado.e_lider_de_algum_ministerio() or privado.lidera_algum_grupo());

-- Apagar só funciona se a música nunca foi usada (a chave estrangeira impede).
create policy "musica: admin e líderes apagam"
on public.musica for delete to authenticated
using (privado.e_admin() or privado.e_lider_de_algum_ministerio() or privado.lidera_algum_grupo());

-- Visível aos integrantes assim que alguém salva (RN-54).
create policy "repertorio: integrantes do ministério veem"
on public.repertorio_item for select to authenticated
using (privado.e_integrante(ministerio_id) or privado.e_admin());

create policy "repertorio: quem pode editar inclui"
on public.repertorio_item for insert to authenticated
with check (privado.pode_editar_repertorio(culto_id, ministerio_id));

create policy "repertorio: quem pode editar altera"
on public.repertorio_item for update to authenticated
using (privado.pode_editar_repertorio(culto_id, ministerio_id))
with check (privado.pode_editar_repertorio(culto_id, ministerio_id));

create policy "repertorio: quem pode editar tira"
on public.repertorio_item for delete to authenticated
using (privado.pode_editar_repertorio(culto_id, ministerio_id));

-- -----------------------------------------------------------------------------
-- Reordenar: leva a música para p_nova_posicao e empurra as outras.
-- Um único UPDATE, graças à restrição DEFERRABLE.
-- -----------------------------------------------------------------------------
create function public.mover_musica_no_repertorio(p_item uuid, p_nova_posicao integer)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_item public.repertorio_item;
  v_max  integer;
  v_nova integer;
begin
  select * into v_item from public.repertorio_item where id = p_item;
  if not found then
    raise exception 'Item de repertório não encontrado.';
  end if;

  select max(posicao) into v_max from public.repertorio_item
  where culto_id = v_item.culto_id and ministerio_id = v_item.ministerio_id;

  v_nova := greatest(1, least(p_nova_posicao, v_max));
  if v_nova = v_item.posicao then
    return;
  end if;

  update public.repertorio_item
  set posicao = case
    when id = p_item then v_nova
    when v_nova < v_item.posicao then posicao + 1
    else posicao - 1
  end
  where culto_id = v_item.culto_id
    and ministerio_id = v_item.ministerio_id
    and posicao between least(v_nova, v_item.posicao) and greatest(v_nova, v_item.posicao);

  if not found then
    raise exception 'Sem permissão para editar esse repertório.'
      using errcode = 'insufficient_privilege';
  end if;
end;
$$;
