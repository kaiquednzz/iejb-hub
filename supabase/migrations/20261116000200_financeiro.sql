-- =============================================================================
-- 25. Financeiro (D46 a D49)
--
-- Regras da liderança (Kaique, 15/11/2026):
--   - Só a tesouraria lança e edita; o pastor só lê; o admin não vê (D45).
--   - Dízimo é registrado por TOTAL, sem nome de dizimista (D47): dízimo com
--     nome revela a religião da pessoa, dado sensível na LGPD.
--   - Dinheiro dos cultos é contado por duas pessoas (D48): uma registra a
--     contagem, outra confere no próprio celular; só depois de conferida ela
--     vira lançamento no caixa.
--   - Relatórios ficam dentro do módulo (D49).
-- Conta da igreja: PagBank, sem API de extrato utilizável (D46): os
-- lançamentos são feitos à mão (e, depois, por importação do CSV).
--
-- Rastreabilidade: nada se apaga. Lançamento errado é CANCELADO, com motivo,
-- e toda criação, edição e cancelamento fica no histórico.
-- Dinheiro em centavos (bigint): nada de float com dinheiro.
-- =============================================================================

-- Quem acessa ------------------------------------------------------------------
create function privado.ve_financeiro()
returns boolean language sql stable security definer set search_path = ''
as $$ select privado.tem_cargo('tesouraria') or privado.tem_cargo('pastor'); $$;

create function privado.edita_financeiro()
returns boolean language sql stable security definer set search_path = ''
as $$ select privado.tem_cargo('tesouraria'); $$;

revoke execute on function privado.ve_financeiro(), privado.edita_financeiro() from public, anon;
grant execute on function privado.ve_financeiro(), privado.edita_financeiro() to authenticated;

-- Contas: onde o dinheiro está -------------------------------------------------
create table public.conta_financeira (
  id                     uuid primary key default gen_random_uuid(),
  nome                   text not null unique check (length(trim(nome)) between 1 and 40),
  tipo                   text not null check (tipo in ('dinheiro', 'banco')),
  saldo_inicial_centavos bigint not null default 0,
  saldo_inicial_em       date not null default (now() at time zone 'America/Sao_Paulo')::date,
  ativa                  boolean not null default true,
  ordem                  smallint not null default 0,
  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now()
);
comment on column public.conta_financeira.saldo_inicial_centavos is
  'Quanto tinha na conta no dia saldo_inicial_em, quando o Hub começou a ser usado. Lançamentos anteriores a essa data não contam no saldo.';

-- Categorias ---------------------------------------------------------------------
create table public.categoria_financeira (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (length(trim(nome)) between 1 and 40),
  tipo          text not null check (tipo in ('entrada', 'saida')),
  -- 'dizimos' e 'ofertas': as que a contagem do culto usa. Uma de cada.
  papel         text unique check (papel in ('dizimos', 'ofertas')),
  ativa         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (nome, tipo),
  check (papel is null or tipo = 'entrada')
);

-- Contagem do dinheiro do culto (D48) ------------------------------------------
create table public.contagem (
  id                     uuid primary key default gen_random_uuid(),
  data                   date not null,
  culto_id               uuid references public.culto (id) on delete set null,
  conta_id               uuid not null references public.conta_financeira (id),
  dizimos_centavos       bigint not null default 0 check (dizimos_centavos >= 0),
  ofertas_centavos       bigint not null default 0 check (ofertas_centavos >= 0),
  observacao             text check (length(observacao) <= 300),
  contado_por            uuid not null references public.pessoa (id),
  conferente_id          uuid not null references public.pessoa (id),
  estado                 text not null default 'aguardando' check (estado in ('aguardando', 'conferida', 'recusada', 'cancelada')),
  decidido_em            timestamptz,
  motivo                 text check (length(motivo) <= 300),
  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now(),
  check (dizimos_centavos + ofertas_centavos > 0),
  check (conferente_id <> contado_por)
);
comment on table public.contagem is
  'Dinheiro contado no culto (D48). Uma pessoa registra, OUTRA confere no app; só conferida vira lançamento.';
create index contagem_conferente_idx on public.contagem (conferente_id) where estado = 'aguardando';

-- Lançamentos ---------------------------------------------------------------------
create table public.lancamento (
  id               uuid primary key default gen_random_uuid(),
  tipo             text not null check (tipo in ('entrada', 'saida', 'transferencia')),
  conta_id         uuid not null references public.conta_financeira (id),
  conta_destino_id uuid references public.conta_financeira (id),
  categoria_id     uuid references public.categoria_financeira (id),
  valor_centavos   bigint not null check (valor_centavos > 0 and valor_centavos < 100000000000),
  data             date not null,
  descricao        text check (length(descricao) <= 200),
  forma            text check (forma in ('pix', 'dinheiro', 'cartao', 'transferencia', 'boleto', 'outro')),
  culto_id         uuid references public.culto (id) on delete set null,
  contagem_id      uuid references public.contagem (id),
  criado_por       uuid not null references public.pessoa (id),
  cancelado_em     timestamptz,
  cancelado_por    uuid references public.pessoa (id),
  motivo_cancelamento text check (length(motivo_cancelamento) <= 300),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  -- Transferência (ex.: depositar o dinheiro do caixa no PagBank) não é
  -- entrada nem saída da igreja: não tem categoria e tem destino.
  check ((tipo = 'transferencia') = (conta_destino_id is not null)),
  check ((tipo = 'transferencia') = (categoria_id is null)),
  check (conta_destino_id is null or conta_destino_id <> conta_id),
  check ((cancelado_em is null) = (cancelado_por is null))
);
create index lancamento_data_idx on public.lancamento (data desc) where cancelado_em is null;
create index lancamento_conta_idx on public.lancamento (conta_id);
create index lancamento_destino_idx on public.lancamento (conta_destino_id);
create index lancamento_categoria_idx on public.lancamento (categoria_id);
create index lancamento_contagem_idx on public.lancamento (contagem_id);

-- Histórico: tudo que aconteceu com cada lançamento
create table public.lancamento_historico (
  id            uuid primary key default gen_random_uuid(),
  lancamento_id uuid not null references public.lancamento (id),
  acao          text not null check (acao in ('criado', 'editado', 'cancelado')),
  antes         jsonb,
  depois        jsonb,
  por           uuid references public.pessoa (id),
  em            timestamptz not null default now()
);
create index lancamento_historico_lanc_idx on public.lancamento_historico (lancamento_id);

create trigger tocar before update on public.conta_financeira     for each row execute function privado.tocar_atualizado_em();
create trigger tocar before update on public.categoria_financeira for each row execute function privado.tocar_atualizado_em();
create trigger tocar before update on public.contagem             for each row execute function privado.tocar_atualizado_em();
create trigger tocar before update on public.lancamento           for each row execute function privado.tocar_atualizado_em();

-- -----------------------------------------------------------------------------
-- Regras do lançamento (gatilho SEM security definer: vale quem está agindo)
-- -----------------------------------------------------------------------------
create function privado.conferir_lancamento()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tipo_categoria text;
begin
  if new.categoria_id is not null then
    select tipo into v_tipo_categoria from public.categoria_financeira where id = new.categoria_id;
    if v_tipo_categoria is distinct from new.tipo then
      raise exception 'A categoria não é de %.', case new.tipo when 'entrada' then 'entrada' else 'saída' end
        using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'INSERT' then
    -- Quem lança é quem está logado (a contagem conferida passa pelo sistema)
    if not privado.e_sistema() and new.criado_por is distinct from privado.minha_pessoa_id() then
      raise exception 'Lançamento em nome de outra pessoa.' using errcode = 'insufficient_privilege';
    end if;
    if new.contagem_id is not null and not privado.e_sistema() then
      raise exception 'Lançamento de contagem só nasce da conferência.' using errcode = 'insufficient_privilege';
    end if;
    if new.cancelado_em is not null then
      raise exception 'Lançamento novo não nasce cancelado.' using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- UPDATE
  if old.cancelado_em is not null then
    raise exception 'Lançamento cancelado não muda mais.' using errcode = 'check_violation';
  end if;
  if new.criado_por <> old.criado_por or new.criado_em <> old.criado_em
     or new.contagem_id is distinct from old.contagem_id or new.tipo <> old.tipo then
    raise exception 'Isso não se muda num lançamento: cancele e lance de novo.' using errcode = 'check_violation';
  end if;
  -- O que veio de uma contagem conferida por duas pessoas não se edita:
  -- só se cancela (e aí a conta fica explicada no histórico)
  if old.contagem_id is not null and new.cancelado_em is null then
    raise exception 'Lançamento de contagem conferida não se edita; cancele com o motivo.' using errcode = 'check_violation';
  end if;
  if new.cancelado_em is not null then
    if new.cancelado_por is distinct from privado.minha_pessoa_id() then
      raise exception 'Cancelamento em nome de outra pessoa.' using errcode = 'insufficient_privilege';
    end if;
    if coalesce(trim(new.motivo_cancelamento), '') = '' then
      raise exception 'Diga o motivo do cancelamento.' using errcode = 'check_violation';
    end if;
    -- Cancelar não muda mais nada junto
    if (new.valor_centavos, new.data, new.conta_id, new.conta_destino_id, new.categoria_id, new.descricao, new.forma, new.culto_id)
       is distinct from
       (old.valor_centavos, old.data, old.conta_id, old.conta_destino_id, old.categoria_id, old.descricao, old.forma, old.culto_id) then
      raise exception 'Cancele sem mudar o lançamento.' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function privado.conferir_lancamento() from public, anon;

create trigger conferir before insert or update on public.lancamento
for each row execute function privado.conferir_lancamento();

-- Histórico (escrito pelo sistema)
create function privado.historiar_lancamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campos text[] := array['tipo', 'conta_id', 'conta_destino_id', 'categoria_id', 'valor_centavos', 'data', 'descricao', 'forma', 'culto_id', 'motivo_cancelamento'];
  v_antes jsonb; v_depois jsonb;
begin
  v_depois := (select jsonb_object_agg(k, v) from jsonb_each(to_jsonb(new)) as e(k, v) where k = any (v_campos));
  if tg_op = 'INSERT' then
    insert into public.lancamento_historico (lancamento_id, acao, depois, por)
    values (new.id, 'criado', v_depois, new.criado_por);
    return null;
  end if;
  v_antes := (select jsonb_object_agg(k, v) from jsonb_each(to_jsonb(old)) as e(k, v) where k = any (v_campos));
  if v_antes = v_depois and old.cancelado_em is not distinct from new.cancelado_em then
    return null;
  end if;
  insert into public.lancamento_historico (lancamento_id, acao, antes, depois, por)
  values (new.id, case when new.cancelado_em is not null and old.cancelado_em is null then 'cancelado' else 'editado' end,
          v_antes, v_depois, coalesce(new.cancelado_por, privado.minha_pessoa_id()));
  return null;
end;
$$;
revoke execute on function privado.historiar_lancamento() from public, anon;

create trigger historiar after insert or update on public.lancamento
for each row execute function privado.historiar_lancamento();

-- -----------------------------------------------------------------------------
-- Contagem: registrar (tesouraria), conferir (o conferente), cancelar
-- -----------------------------------------------------------------------------
-- Tem conta ativa no app? (a RLS de "conta" não deixa a tesouraria ver as dos outros)
create function privado.tem_conta_ativa(p_pessoa uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.conta c join public.pessoa p on p.id = c.pessoa_id
                 where c.pessoa_id = p_pessoa and c.estado = 'ativa' and p.ativa);
$$;
revoke execute on function privado.tem_conta_ativa(uuid) from public, anon;
grant execute on function privado.tem_conta_ativa(uuid) to authenticated;

create function privado.conferir_contagem_nova()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.contado_por is distinct from privado.minha_pessoa_id() then
    raise exception 'Contagem em nome de outra pessoa.' using errcode = 'insufficient_privilege';
  end if;
  if new.estado <> 'aguardando' then
    raise exception 'Contagem nova começa aguardando conferência.' using errcode = 'check_violation';
  end if;
  if not privado.tem_conta_ativa(new.conferente_id) then
    raise exception 'Quem confere precisa ter conta ativa no app.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function privado.conferir_contagem_nova() from public, anon;

create trigger conferir before insert on public.contagem
for each row execute function privado.conferir_contagem_nova();

-- Avisa o conferente
create function privado.avisar_conferente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform privado.criar_aviso(
    'contagem_para_conferir', null, null,
    format('%s pediu para você conferir a contagem de %s: R$ %s.',
      (select coalesce(apelido, nome) from public.pessoa where id = new.contado_por),
      to_char(new.data, 'DD/MM'),
      replace(to_char((new.dizimos_centavos + new.ofertas_centavos) / 100.0, 'FM999G999G990D00'), ',', '.')),
    array[new.conferente_id]);
  return null;
end;
$$;
revoke execute on function privado.avisar_conferente() from public, anon;

create trigger avisar after insert on public.contagem
for each row execute function privado.avisar_conferente();

alter table public.aviso drop constraint aviso_tipo_check;
alter table public.aviso add constraint aviso_tipo_check check (tipo in (
  'escala_alterada', 'repertorio_alterado', 'culto_cancelado',
  'solicitacao_nova', 'solicitacao_decidida', 'presenca_alterada',
  'contagem_para_conferir', 'contagem_decidida'));

-- Quem pode conferir: pessoas ativas com conta ativa (menos quem está contando).
-- Só nome e apelido; a tabela "conta" continua fechada.
create function public.quem_pode_conferir()
returns table (id uuid, nome text, apelido text, foto text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nome, p.apelido, p.foto
  from public.pessoa p
  join public.conta c on c.pessoa_id = p.id and c.estado = 'ativa'
  where p.ativa and p.id <> privado.minha_pessoa_id() and privado.edita_financeiro()
  order by coalesce(p.apelido, p.nome);
$$;
revoke execute on function public.quem_pode_conferir() from public, anon;
grant execute on function public.quem_pode_conferir() to authenticated;

-- O conferente confirma (vira lançamento no caixa) ou diz que não bate
create function public.decidir_contagem(p_contagem uuid, p_confere boolean, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.contagem;
  v_eu uuid := privado.minha_pessoa_id();
  v_resumo text;
begin
  select * into v from public.contagem where id = p_contagem for update;
  if v.id is null or v.conferente_id is distinct from v_eu then
    raise exception 'Essa contagem não está com você.' using errcode = 'insufficient_privilege';
  end if;
  if v.estado <> 'aguardando' then
    raise exception 'Essa contagem já foi decidida.' using errcode = 'check_violation';
  end if;
  if not p_confere and coalesce(trim(p_motivo), '') = '' then
    raise exception 'Diga o que não bateu.' using errcode = 'check_violation';
  end if;

  update public.contagem
  set estado = case when p_confere then 'conferida' else 'recusada' end,
      decidido_em = now(), motivo = nullif(trim(p_motivo), '')
  where id = v.id;

  if p_confere then
    insert into public.lancamento (tipo, conta_id, categoria_id, valor_centavos, data, descricao, forma, culto_id, contagem_id, criado_por)
    select 'entrada', v.conta_id, c.id, x.valor, v.data, x.descricao, 'dinheiro', v.culto_id, v.id, v.contado_por
    from (values ('dizimos', v.dizimos_centavos, 'Dízimos em dinheiro'),
                 ('ofertas', v.ofertas_centavos, 'Ofertas em dinheiro')) as x(papel, valor, descricao)
    join public.categoria_financeira c on c.papel = x.papel
    where x.valor > 0;
  end if;

  v_resumo := format('%s %s a contagem de %s.', (select coalesce(apelido, nome) from public.pessoa where id = v_eu),
    case when p_confere then 'conferiu' else 'não confirmou' end, to_char(v.data, 'DD/MM'));
  perform privado.criar_aviso('contagem_decidida', null, null, v_resumo, array[v.contado_por]);
end;
$$;
revoke execute on function public.decidir_contagem(uuid, boolean, text) from public, anon;
grant execute on function public.decidir_contagem(uuid, boolean, text) to authenticated;

-- A tesouraria desiste de uma contagem que ainda não foi conferida
create function public.cancelar_contagem(p_contagem uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not privado.edita_financeiro() then
    raise exception 'Só a tesouraria cancela contagem.' using errcode = 'insufficient_privilege';
  end if;
  update public.contagem set estado = 'cancelada', decidido_em = now(), motivo = nullif(trim(p_motivo), '')
  where id = p_contagem and estado = 'aguardando';
  if not found then
    raise exception 'Essa contagem já foi decidida.' using errcode = 'check_violation';
  end if;
end;
$$;
revoke execute on function public.cancelar_contagem(uuid, text) from public, anon;
grant execute on function public.cancelar_contagem(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Saldo e resumo do mês (roda como quem chama: a RLS decide se vê)
-- -----------------------------------------------------------------------------
create function public.resumo_financeiro(p_mes date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with mes as (
    select date_trunc('month', p_mes)::date as ini, (date_trunc('month', p_mes) + interval '1 month')::date as fim
  ),
  validos as (
    select l.* from public.lancamento l
    join public.conta_financeira o on o.id = l.conta_id
    where l.cancelado_em is null and l.data >= o.saldo_inicial_em
  ),
  saldos as (
    select c.id, c.nome, c.tipo, c.ordem,
      c.saldo_inicial_centavos
      + coalesce((select sum(case v.tipo when 'entrada' then v.valor_centavos else -v.valor_centavos end)
                  from validos v where v.conta_id = c.id), 0)
      + coalesce((select sum(v.valor_centavos) from validos v where v.conta_destino_id = c.id and v.data >= c.saldo_inicial_em), 0)
        as saldo
    from public.conta_financeira c where c.ativa
  ),
  do_mes as (
    select v.tipo, v.categoria_id, sum(v.valor_centavos) as total
    from validos v, mes where v.data >= mes.ini and v.data < mes.fim and v.tipo <> 'transferencia'
    group by v.tipo, v.categoria_id
  )
  select jsonb_build_object(
    'contas', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'tipo', tipo, 'saldo', saldo) order by ordem, nome) from saldos), '[]'),
    'entradas', coalesce((select sum(total) from do_mes where tipo = 'entrada'), 0),
    'saidas', coalesce((select sum(total) from do_mes where tipo = 'saida'), 0),
    'por_categoria', coalesce((select jsonb_agg(jsonb_build_object('categoria_id', d.categoria_id, 'nome', c.nome, 'tipo', d.tipo, 'total', d.total) order by d.tipo, d.total desc)
                               from do_mes d join public.categoria_financeira c on c.id = d.categoria_id), '[]')
  );
$$;
revoke execute on function public.resumo_financeiro(date) from public, anon;
grant execute on function public.resumo_financeiro(date) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.conta_financeira     enable row level security;
alter table public.categoria_financeira enable row level security;
alter table public.contagem             enable row level security;
alter table public.lancamento           enable row level security;
alter table public.lancamento_historico enable row level security;

create policy "conta fin: vê"      on public.conta_financeira for select to authenticated using (privado.ve_financeiro());
create policy "conta fin: cria"    on public.conta_financeira for insert to authenticated with check (privado.edita_financeiro());
create policy "conta fin: muda"    on public.conta_financeira for update to authenticated using (privado.edita_financeiro()) with check (privado.edita_financeiro());

create policy "categoria: vê"      on public.categoria_financeira for select to authenticated using (privado.ve_financeiro());
create policy "categoria: cria"    on public.categoria_financeira for insert to authenticated with check (privado.edita_financeiro());
create policy "categoria: muda"    on public.categoria_financeira for update to authenticated using (privado.edita_financeiro()) with check (privado.edita_financeiro());

-- O conferente vê só a contagem que está com ele (o valor que ele mesmo contou)
create policy "contagem: vê"       on public.contagem for select to authenticated
  using (privado.ve_financeiro() or conferente_id = privado.minha_pessoa_id());
create policy "contagem: registra" on public.contagem for insert to authenticated with check (privado.edita_financeiro());

create policy "lançamento: vê"     on public.lancamento for select to authenticated using (privado.ve_financeiro());
create policy "lançamento: lança"  on public.lancamento for insert to authenticated with check (privado.edita_financeiro() or privado.e_sistema());
create policy "lançamento: muda"   on public.lancamento for update to authenticated using (privado.edita_financeiro()) with check (privado.edita_financeiro());

create policy "histórico: vê"      on public.lancamento_historico for select to authenticated using (privado.ve_financeiro());

-- Deslogado não chega perto (o Supabase dá privilégio ao anon por padrão em tabela nova)
revoke all on public.conta_financeira, public.categoria_financeira, public.contagem,
              public.lancamento, public.lancamento_historico from anon;
grant select, insert, update on public.conta_financeira, public.categoria_financeira, public.lancamento to authenticated;
grant select, insert on public.contagem to authenticated;
grant select on public.lancamento_historico to authenticated;
revoke delete on public.conta_financeira, public.categoria_financeira, public.lancamento, public.contagem from authenticated;
revoke update on public.contagem from authenticated;
revoke insert, update, delete on public.lancamento_historico from authenticated;
grant all on public.conta_financeira, public.categoria_financeira, public.contagem,
             public.lancamento, public.lancamento_historico to service_role;

-- -----------------------------------------------------------------------------
-- Começo: as duas contas e categorias comuns (a tesouraria renomeia, desativa
-- e cria as dela no app)
-- -----------------------------------------------------------------------------
insert into public.conta_financeira (nome, tipo, ordem) values
  ('Caixa (dinheiro)', 'dinheiro', 1),
  ('PagBank', 'banco', 2);

insert into public.categoria_financeira (nome, tipo, papel) values
  ('Dízimos', 'entrada', 'dizimos'),
  ('Ofertas', 'entrada', 'ofertas'),
  ('Eventos', 'entrada', null),
  ('Doações', 'entrada', null),
  ('Outras entradas', 'entrada', null),
  ('Água e luz', 'saida', null),
  ('Manutenção', 'saida', null),
  ('Materiais e limpeza', 'saida', null),
  ('Ação social', 'saida', null),
  ('Missões', 'saida', null),
  ('Eventos', 'saida', null),
  ('Tarifas bancárias', 'saida', null),
  ('Outras saídas', 'saida', null);
