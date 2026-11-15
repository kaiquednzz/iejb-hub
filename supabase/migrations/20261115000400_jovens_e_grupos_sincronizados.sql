-- =============================================================================
-- Migração 23: Culto de Jovens (D41) e escalas que acompanham o grupo (D42)
--
-- D41: Culto de Jovens é em alguns sábados (não todo), e quem toca é o G3,
-- mas pode mudar. Vira um tipo de culto que NÃO é criado sozinho
-- (gerar_sozinho = false) e tem grupo padrão. O líder cria o culto do sábado
-- que quiser com criar_culto_do_tipo(), que já escala o grupo padrão.
--
-- D42: escolher um grupo copia os membros dele PARA AQUELA HORA. Quem entrava
-- no grupo depois não aparecia nas escalas já montadas (foi o que aconteceu:
-- os grupos foram escolhidos antes de terem membros). Agora, mexer nos membros
-- de um grupo atualiza as escalas em RASCUNHO de cultos futuros que têm esse
-- grupo. Escala publicada não muda sozinha: alguém pode ter sido tirado de
-- propósito, e o líder decide (a escala publicada já avisa quem muda).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- D41
-- -----------------------------------------------------------------------------
alter table public.tipo_culto
  add column gerar_sozinho boolean not null default true,
  add column grupo_padrao_id uuid references public.grupo (id) on delete set null;

comment on column public.tipo_culto.gerar_sozinho is
  'true: gerar_cultos cria toda semana (domingo, terça). false: o líder cria quando tiver (Culto de Jovens, D41).';
comment on column public.tipo_culto.grupo_padrao_id is
  'Grupo escalado sozinho ao criar o culto (D41). Pode trocar no culto.';

insert into public.tipo_culto (nome, dia_semana, horario, tem_louvor, gerar_sozinho, grupo_padrao_id)
select 'Culto de Jovens', 6, '19:30', true, false, (select id from public.grupo where nome = 'G3' limit 1)
where not exists (select 1 from public.tipo_culto where nome = 'Culto de Jovens');

create or replace function public.gerar_cultos(p_ate date)
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
  where t.ativo and t.gerar_sozinho and extract(dow from d) = t.dia_semana
  on conflict (tipo_culto_id, data) where tipo_culto_id is not null do nothing;

  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

-- Cria um culto de um tipo "quando tiver" (Jovens) e escala o grupo padrão.
-- Sem security definer: vale a permissão de quem chama (admin e líder de
-- louvor criam culto e montam escala; os outros recebem erro de permissão).
create function public.criar_culto_do_tipo(p_tipo uuid, p_data date, p_horario time, p_ministerio uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_tipo  public.tipo_culto;
  v_culto uuid;
begin
  select * into v_tipo from public.tipo_culto where id = p_tipo and ativo;
  if v_tipo.id is null then
    raise exception 'Tipo de culto não encontrado.' using errcode = 'no_data_found';
  end if;
  if p_data < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Escolha uma data de hoje em diante.' using errcode = 'check_violation';
  end if;

  insert into public.culto (tipo_culto_id, nome, data, horario, tem_louvor)
  values (v_tipo.id, v_tipo.nome, p_data, coalesce(p_horario, v_tipo.horario), v_tipo.tem_louvor)
  returning id into v_culto;

  if v_tipo.grupo_padrao_id is not null and v_tipo.tem_louvor then
    perform public.definir_grupos_do_culto(v_culto, p_ministerio, array[v_tipo.grupo_padrao_id]);
  end if;
  return v_culto;
exception
  when unique_violation then
    raise exception 'Já existe % nesse dia.', v_tipo.nome using errcode = 'unique_violation';
end;
$$;

revoke execute on function public.criar_culto_do_tipo(uuid, date, time, uuid) from public, anon;
grant execute on function public.criar_culto_do_tipo(uuid, date, time, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- D42: membros do grupo -> escalas em rascunho de cultos futuros
-- -----------------------------------------------------------------------------
-- security definer de propósito: é o sistema completando a escala, não uma
-- edição de quem mexeu no grupo (o líder de grupo edita o próprio grupo, mas
-- não monta escala em rascunho). As travas de permissão da escala reconhecem
-- o sistema por privado.e_sistema().
create function privado.sincronizar_escalas_do_grupo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grupo  uuid := coalesce(new.grupo_id, old.grupo_id);
  v_escala uuid;
begin
  for v_escala in
    select e.id from public.escala e
    join public.escala_grupo eg on eg.escala_id = e.id and eg.grupo_id = v_grupo
    join public.culto c on c.id = e.culto_id
    where e.estado = 'rascunho' and c.estado = 'ativo'
      and c.data >= (now() at time zone 'America/Sao_Paulo')::date
  loop
    if tg_op in ('DELETE', 'UPDATE') and (tg_op = 'DELETE' or new.pessoa_id <> old.pessoa_id) then
      -- Saiu do grupo: sai da escala, se estava lá por causa dele e não por outro grupo do culto
      delete from public.escala_item i
      where i.escala_id = v_escala and i.pessoa_id = old.pessoa_id and i.origem_grupo_id = v_grupo
        and not exists (
          select 1 from public.escala_grupo eg2
          join public.grupo_membro gm on gm.grupo_id = eg2.grupo_id and gm.pessoa_id = old.pessoa_id
          where eg2.escala_id = v_escala and eg2.grupo_id <> v_grupo);
    end if;
    if tg_op = 'UPDATE' and new.pessoa_id = old.pessoa_id and new.instrumentos is distinct from old.instrumentos then
      -- Mudou o instrumento padrão: atualiza onde ninguém tinha mexido à mão
      update public.escala_item i
      set instrumento_exibido = new.instrumentos
      where i.escala_id = v_escala and i.pessoa_id = new.pessoa_id and i.origem_grupo_id = v_grupo
        and i.instrumento_exibido = old.instrumentos;
    end if;
    if tg_op in ('INSERT', 'UPDATE') then
      perform public.preencher_escala_com_grupo(v_escala, v_grupo);   -- só insere quem falta
    end if;
  end loop;
  return null;
end;
$$;

revoke execute on function privado.sincronizar_escalas_do_grupo() from public, anon;

create trigger sincronizar_escalas
after insert or update or delete on public.grupo_membro
for each row execute function privado.sincronizar_escalas_do_grupo();

-- Corrige o que já está montado: escalas em rascunho de cultos futuros
-- recebem quem hoje é do grupo escolhido
do $$
declare r record;
begin
  for r in
    select e.id as escala, eg.grupo_id as grupo
    from public.escala e
    join public.escala_grupo eg on eg.escala_id = e.id
    join public.culto c on c.id = e.culto_id
    where e.estado = 'rascunho' and c.estado = 'ativo'
      and c.data >= (now() at time zone 'America/Sao_Paulo')::date
  loop
    perform public.preencher_escala_com_grupo(r.escala, r.grupo);
  end loop;
end;
$$;
