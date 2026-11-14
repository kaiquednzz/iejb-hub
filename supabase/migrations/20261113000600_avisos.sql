-- =============================================================================
-- 06. Avisos, central de notificações e aparelhos de push
-- Modelo de dados v0.3, seções 3.1, 3.6 e 6 | Regras: RN-40 a RN-47, RN-55, RN-63
--
-- Fluxo:
--   1. Mudanças em escala publicada caem em escala_alteracao (migração 04).
--   2. public.processar_avisos_pendentes(), rodando de minuto em minuto,
--      junta tudo que mudou numa escala depois de uma janela de silêncio
--      (RN-45) e cria UM aviso com seus destinatários.
--   3. Uma função de servidor (fora do banco) lê aviso_destinatario sem
--      push_enviado_em e envia o push para os aparelhos de cada pessoa.
-- =============================================================================

create table public.aviso (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null check (tipo in (
                   'escala_alterada', 'repertorio_alterado', 'culto_cancelado',
                   'solicitacao_nova', 'solicitacao_decidida')),
  escala_id      uuid references public.escala (id) on delete cascade,
  solicitacao_id uuid references public.solicitacao_alteracao (id) on delete cascade,
  resumo         text not null,
  criado_em      timestamptz not null default now()
);

create table public.aviso_destinatario (
  id              uuid primary key default gen_random_uuid(),
  aviso_id        uuid not null references public.aviso (id) on delete cascade,
  pessoa_id       uuid not null references public.pessoa (id) on delete restrict,
  push_enviado_em timestamptz,
  push_erro       text,
  lido_em         timestamptz,
  criado_em       timestamptz not null default now(),
  unique (aviso_id, pessoa_id)
);
comment on table public.aviso_destinatario is 'Quem recebe cada aviso. É também a central de notificações do app.';

create table public.dispositivo_push (
  id            uuid primary key default gen_random_uuid(),
  conta_id      uuid not null default auth.uid() references public.conta (id) on delete cascade,
  endpoint      text not null unique check (endpoint ~* '^https://'),
  chave_p256dh  text not null,
  chave_auth    text not null,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.dispositivo_push is 'Inscrição de push de um aparelho (RN-63). Uma conta pode ter vários.';

-- processada_em: a linha já passou pelo processamento (com ou sem aviso).
-- aviso_id: qual aviso ela gerou, se gerou (escala vazia não gera).
alter table public.escala_alteracao
  add column processada_em timestamptz,
  add column aviso_id uuid references public.aviso (id) on delete set null;

create index escala_alteracao_pendente_idx on public.escala_alteracao (escala_id) where processada_em is null;
create index aviso_destinatario_pessoa_idx on public.aviso_destinatario (pessoa_id, criado_em desc);
create index aviso_destinatario_envio_idx  on public.aviso_destinatario (aviso_id) where push_enviado_em is null;
create index dispositivo_push_conta_idx    on public.dispositivo_push (conta_id);

create trigger tocar before update on public.dispositivo_push for each row execute function privado.tocar_atualizado_em();

-- O gatilho do repertório (migração 05) depende de escala_alteracao.aviso_id.
create trigger registrar_mudanca_repertorio
after insert or update or delete on public.repertorio_item
for each row execute function privado.registrar_mudanca_repertorio();

-- -----------------------------------------------------------------------------
-- Auxiliares de texto
-- -----------------------------------------------------------------------------
create function privado.nome_curto(p_pessoa uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(trim(apelido), ''), nome) from public.pessoa where id = p_pessoa;
$$;

-- Ex.: "Culto de Oração, 18/11 às 19h30"
create function privado.descrever_culto(p_escala uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select c.nome || ', ' || to_char(c.data, 'DD/MM') || ' às ' || to_char(c.horario, 'HH24"h"MI')
  from public.escala e join public.culto c on c.id = e.culto_id
  where e.id = p_escala;
$$;

create function privado.criar_aviso(
  p_tipo text, p_escala uuid, p_solicitacao uuid, p_resumo text, p_pessoas uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aviso uuid;
begin
  if coalesce(cardinality(p_pessoas), 0) = 0 then
    return null;
  end if;

  insert into public.aviso (tipo, escala_id, solicitacao_id, resumo)
  values (p_tipo, p_escala, p_solicitacao, p_resumo)
  returning id into v_aviso;

  insert into public.aviso_destinatario (aviso_id, pessoa_id)
  select v_aviso, x from (select distinct unnest(p_pessoas) as x) d
  where x is not null;

  return v_aviso;
end;
$$;

-- -----------------------------------------------------------------------------
-- Processa as alterações de escala que já passaram pela janela de silêncio.
-- Destinatários (RN-41, Q14): quem entrou, saiu ou continua escalado.
-- Quem SAIU vem do registro, porque já não está mais em escala_item.
-- Só o sistema chama (agendamento no fim deste arquivo).
-- -----------------------------------------------------------------------------
create function public.processar_avisos_pendentes(p_janela interval default interval '5 minutes')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_escala      record;
  v_atuais      uuid[];
  v_sairam      uuid[];
  v_entraram    uuid[];
  v_tipos       text[];
  v_aviso       uuid;
  v_aviso_rep   uuid;
  v_descricao   text;
  v_resumo      text;
  v_total       integer := 0;
begin
  for v_escala in
    select a.escala_id
    from public.escala_alteracao a
    where a.processada_em is null
    group by a.escala_id
    having max(a.feita_em) <= now() - p_janela
  loop
    v_aviso := null;
    v_aviso_rep := null;
    v_descricao := privado.descrever_culto(v_escala.escala_id);

    -- Trava as linhas para duas execuções simultâneas não avisarem duas vezes.
    select array_agg(distinct tipo) into v_tipos
    from (
      select tipo from public.escala_alteracao
      where escala_id = v_escala.escala_id and processada_em is null
      for update
    ) t;

    select array_agg(pessoa_id) into v_atuais
    from public.escala_item where escala_id = v_escala.escala_id;

    select array_agg(distinct pessoa_id) into v_sairam
    from public.escala_alteracao
    where escala_id = v_escala.escala_id and processada_em is null
      and tipo = 'saiu' and pessoa_id is not null
      and not (pessoa_id = any (coalesce(v_atuais, '{}')));

    select array_agg(distinct pessoa_id) into v_entraram
    from public.escala_alteracao
    where escala_id = v_escala.escala_id and processada_em is null
      and tipo = 'entrou' and pessoa_id = any (coalesce(v_atuais, '{}'));

    if 'culto_cancelado' = any (v_tipos) then
      v_aviso := privado.criar_aviso(
        'culto_cancelado', v_escala.escala_id, null,
        'Culto cancelado: ' || v_descricao,
        coalesce(v_atuais, '{}') || coalesce(v_sairam, '{}'));

    else
      if v_tipos && array['publicada', 'entrou', 'saiu', 'instrumento_mudou'] then
        if 'publicada' = any (v_tipos) then
          v_resumo := 'Escala publicada: ' || v_descricao;
        else
          v_resumo := 'Escala atualizada: ' || v_descricao;
          if v_entraram is not null then
            v_resumo := v_resumo || '. Entrou: ' ||
              (select string_agg(privado.nome_curto(x), ', ') from unnest(v_entraram) x);
          end if;
          if v_sairam is not null then
            v_resumo := v_resumo || '. Saiu: ' ||
              (select string_agg(privado.nome_curto(x), ', ') from unnest(v_sairam) x);
          end if;
        end if;

        v_aviso := privado.criar_aviso(
          'escala_alterada', v_escala.escala_id, null, v_resumo,
          coalesce(v_atuais, '{}') || coalesce(v_sairam, '{}'));
      end if;

      -- Repertório avisa só quem está escalado (RN-55).
      if 'repertorio_alterado' = any (v_tipos) then
        v_aviso_rep := privado.criar_aviso(
          'repertorio_alterado', v_escala.escala_id, null,
          'Repertório atualizado: ' || v_descricao,
          coalesce(v_atuais, '{}'));
      end if;
    end if;

    -- Marca como processado mesmo que ninguém tenha recebido (escala vazia),
    -- senão a mesma alteração seria reprocessada para sempre.
    update public.escala_alteracao
    set processada_em = now(),
        aviso_id = case when tipo = 'repertorio_alterado'
                        then coalesce(v_aviso_rep, v_aviso)
                        else coalesce(v_aviso, v_aviso_rep) end
    where escala_id = v_escala.escala_id and processada_em is null;

    v_total := v_total + (v_aviso is not null)::int + (v_aviso_rep is not null)::int;
  end loop;

  return v_total;
end;
$$;

-- -----------------------------------------------------------------------------
-- Solicitações avisam na hora, sem janela (RN-46, RN-47).
-- -----------------------------------------------------------------------------
create function privado.avisar_solicitacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lideres uuid[];
begin
  if tg_op = 'INSERT' then
    select array_agg(m.pessoa_id) into v_lideres
    from public.membro_ministerio m
    where m.ministerio_id = privado.ministerio_da_escala(new.escala_id)
      and m.e_lider and m.ativo;

    perform privado.criar_aviso(
      'solicitacao_nova', new.escala_id, new.id,
      'Nova solicitação de ' || privado.nome_curto(new.autor_pessoa_id) || ': '
        || privado.descrever_culto(new.escala_id),
      v_lideres);

  elsif old.estado = 'pendente' and new.estado <> 'pendente' then
    perform privado.criar_aviso(
      'solicitacao_decidida', new.escala_id, new.id,
      'Sua solicitação foi ' || new.estado || ': ' || privado.descrever_culto(new.escala_id)
        || coalesce('. Motivo: ' || new.motivo, ''),
      array[new.autor_pessoa_id]);
  end if;
  return null;
end;
$$;

create trigger avisar_solicitacao
after insert or update of estado on public.solicitacao_alteracao
for each row execute function privado.avisar_solicitacao();

-- -----------------------------------------------------------------------------
-- RLS: cada um vê só os próprios avisos e aparelhos.
-- -----------------------------------------------------------------------------
alter table public.aviso              enable row level security;
alter table public.aviso_destinatario enable row level security;
alter table public.dispositivo_push   enable row level security;

create function privado.sou_destinatario(p_aviso uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.aviso_destinatario
    where aviso_id = p_aviso and pessoa_id = privado.minha_pessoa_id()
  );
$$;

create policy "aviso: destinatários veem"
on public.aviso for select to authenticated
using (privado.sou_destinatario(id));

create policy "aviso_destinatario: vejo os meus"
on public.aviso_destinatario for select to authenticated
using (pessoa_id = privado.minha_pessoa_id());

create policy "dispositivo_push: vejo os meus"
on public.dispositivo_push for select to authenticated
using (conta_id = auth.uid() and privado.minha_pessoa_id() is not null);

create policy "dispositivo_push: registro os meus"
on public.dispositivo_push for insert to authenticated
with check (conta_id = auth.uid() and privado.minha_pessoa_id() is not null);

create policy "dispositivo_push: atualizo os meus"
on public.dispositivo_push for update to authenticated
using (conta_id = auth.uid() and privado.minha_pessoa_id() is not null)
with check (conta_id = auth.uid() and privado.minha_pessoa_id() is not null);

create policy "dispositivo_push: removo os meus"
on public.dispositivo_push for delete to authenticated
using (conta_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Funções do app
-- -----------------------------------------------------------------------------
create function public.marcar_aviso_lido(p_aviso uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
begin
  update public.aviso_destinatario
  set lido_em = now()
  where pessoa_id = privado.minha_pessoa_id()
    and lido_em is null
    and (p_aviso is null or aviso_id = p_aviso);
  get diagnostics v_total = row_count;
  return v_total;
end;
$$;
