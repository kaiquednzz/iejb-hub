-- =============================================================================
-- Migração 19: "não vou poder ir" (D35) e repertório só para quem é do culto (D36)
--
-- D35: depois de publicada a escala, o próprio integrante marca que não vai.
--   Ele continua na escala, riscado ("Não vai"), para os líderes saberem quem
--   falta. O líder do grupo do culto e o(s) líder(es) de louvor recebem aviso
--   na hora (sem a janela de 5 minutos: é um evento único, não uma edição em
--   várias etapas). Dá para voltar atrás até o culto começar, e os líderes
--   são avisados de novo. Não muda nada para os outros escalados.
--
-- D36: o repertório de um culto só aparece para quem tem a ver com ele:
--   escalados, integrantes dos grupos do culto, o líder do grupo, líder de
--   louvor e administrador. Antes: todo integrante do ministério via tudo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- D35
-- -----------------------------------------------------------------------------
alter table public.escala_item add column saiu_em timestamptz;
comment on column public.escala_item.saiu_em is
  'Quando a própria pessoa marcou "não vou poder ir" (D35). Continua na escala, riscada. Nulo = vai.';

alter table public.aviso drop constraint aviso_tipo_check;
alter table public.aviso add constraint aviso_tipo_check check (tipo in (
  'escala_alterada', 'repertorio_alterado', 'culto_cancelado',
  'solicitacao_nova', 'solicitacao_decidida', 'presenca_alterada'));

-- p_vai = false: "não vou poder ir"; true: "vou sim" (desfaz)
create function public.marcar_presenca(p_escala uuid, p_vai boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu      uuid := privado.minha_pessoa_id();
  v_item    public.escala_item;
  v_culto   public.culto;
  v_estado  text;
  v_lideres uuid[];
  v_nome    text;
begin
  select i.* into v_item from public.escala_item i
  where i.escala_id = p_escala and i.pessoa_id = v_eu
  for update;
  if v_item.id is null then
    raise exception 'Você não está nessa escala.' using errcode = 'insufficient_privilege';
  end if;

  select e.estado into v_estado from public.escala e where e.id = p_escala;
  select c.* into v_culto from public.culto c join public.escala e on e.culto_id = c.id where e.id = p_escala;

  if v_estado <> 'publicada' or v_culto.estado <> 'ativo' then
    raise exception 'Essa escala não está valendo.' using errcode = 'check_violation';
  end if;
  if (v_culto.data + v_culto.horario) <= (now() at time zone 'America/Sao_Paulo') then
    raise exception 'O culto já começou. Fale com o líder.' using errcode = 'check_violation';
  end if;

  -- Nada mudou: não avisa ninguém de novo
  if (v_item.saiu_em is null) = p_vai then
    return;
  end if;

  update public.escala_item
  set saiu_em = case when p_vai then null else now() end
  where id = v_item.id;

  -- Líder do(s) grupo(s) do culto + líder(es) de louvor, menos a própria pessoa
  select array_agg(distinct x) into v_lideres from (
    select g.lider_pessoa_id as x
    from public.escala_grupo eg join public.grupo g on g.id = eg.grupo_id
    where eg.escala_id = p_escala and g.ativo
    union
    select m.pessoa_id
    from public.membro_ministerio m
    where m.ministerio_id = privado.ministerio_da_escala(p_escala) and m.e_lider and m.ativo
  ) l where x is not null and x <> v_eu;

  v_nome := privado.nome_curto(v_eu);
  perform privado.criar_aviso(
    'presenca_alterada', p_escala, null,
    case when p_vai then v_nome || ' vai de novo: ' else v_nome || ' não vai: ' end
      || privado.descrever_culto(p_escala),
    coalesce(v_lideres, '{}'));
end;
$$;

revoke execute on function public.marcar_presenca(uuid, boolean) from public, anon;
grant execute on function public.marcar_presenca(uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- D36
-- -----------------------------------------------------------------------------
create function privado.pode_ver_repertorio(p_culto uuid, p_ministerio uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select privado.pode_editar_repertorio(p_culto, p_ministerio)  -- admin, líder de louvor, líder do grupo
      or exists (                                                -- escalado no culto
        select 1 from public.escala e
        join public.escala_item i on i.escala_id = e.id
        where e.culto_id = p_culto and e.ministerio_id = p_ministerio
          and e.estado = 'publicada'
          and i.pessoa_id = privado.minha_pessoa_id())
      or exists (                                                -- integrante de um grupo do culto
        select 1 from public.escala e
        join public.escala_grupo eg on eg.escala_id = e.id
        join public.grupo_membro gm on gm.grupo_id = eg.grupo_id
        where e.culto_id = p_culto and e.ministerio_id = p_ministerio
          and e.estado = 'publicada'
          and gm.pessoa_id = privado.minha_pessoa_id());
$$;

revoke execute on function privado.pode_ver_repertorio(uuid, uuid) from public, anon;
grant execute on function privado.pode_ver_repertorio(uuid, uuid) to authenticated;

drop policy "repertorio: integrantes do ministério veem" on public.repertorio_item;
create policy "repertorio: quem é do culto vê"
on public.repertorio_item for select to authenticated
using (privado.pode_ver_repertorio(culto_id, ministerio_id));

-- -----------------------------------------------------------------------------
-- Links diretos da música nos streamings (corrige D26)
-- No iPhone, os links de BUSCA abrem o app do Spotify e do Apple Music, mas o
-- app ignora a busca e cai na tela inicial. A função de servidor
-- "links-da-musica" acha a faixa (catálogo público do iTunes + song.link) e
-- guarda aqui; link de faixa o app abre direto na música. Só o servidor grava.
-- Formato: { apple, spotify, ytmusic, youtube, faixa, em } ou { nada: true, em }.
-- -----------------------------------------------------------------------------
alter table public.musica add column links_streaming jsonb;
comment on column public.musica.links_streaming is
  'Links diretos da faixa nos streamings, achados pela função links-da-musica. Zera quando título ou artista mudam.';

-- Mudou título ou artista: os links antigos podem ser de outra música
create function privado.zerar_links_streaming()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.titulo is distinct from old.titulo or new.artista is distinct from old.artista then
    new.links_streaming := null;
  elsif new.links_streaming is distinct from old.links_streaming and not privado.e_sistema() then
    new.links_streaming := old.links_streaming;   -- pelo app ninguém escreve aqui
  end if;
  return new;
end;
$$;

create trigger zerar_links_streaming
before update on public.musica
for each row execute function privado.zerar_links_streaming();

revoke execute on function privado.zerar_links_streaming() from public, anon;
