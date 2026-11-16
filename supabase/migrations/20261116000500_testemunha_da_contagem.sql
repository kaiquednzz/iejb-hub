-- Testemunha da contagem (D61).
--
-- Como era (D48): a tesouraria digitava o total e escolhia alguém COM CONTA no
-- app para conferir; essa pessoa via o número e tocava em "Confere". Dois
-- problemas na vida real: quem ajuda a contar muitas vezes não tem conta, e
-- quem já vê o número tende a só concordar com ele.
--
-- Agora são quatro jeitos (coluna `modo`):
--   'qr'      PADRÃO. A tesouraria gera um QR; o ajudante abre no celular
--             dele, sem login, e digita o que ELE contou sem ver o número dela
--             (contagem cega). Bateu: vai para o caixa. Não bateu: recontam.
--             O QR vale uma vez só e por 15 minutos; o ajudante nunca vê caixa,
--             saldo nem lançamento, nem a própria contagem depois.
--   'papel'   O ajudante não tem celular: conta e anota no papel antes de ver o
--             número dela, e ela digita o nome e o valor dele. Ninguém pega o
--             celular da tesouraria (que está com o financeiro aberto).
--   'conta'   Como era: alguém com conta no app confere pelo Início.
--   'sozinha' Ela contou sozinha. Pode, mas fica marcado e o pastor é avisado.
--
-- O que o app NÃO consegue provar: que eram mesmo duas pessoas (dá para ler o
-- próprio QR com outro celular). Por isso tudo fica registrado e visível ao
-- pastor; transparência é a defesa aqui.

-- Tabela --------------------------------------------------------------------------
alter table public.contagem
  add column modo text not null default 'conta' check (modo in ('conta', 'qr', 'papel', 'sozinha')),
  add column testemunha_nome text check (length(trim(testemunha_nome)) between 2 and 60),
  add column testemunha_dizimos_centavos bigint check (testemunha_dizimos_centavos >= 0),
  add column testemunha_ofertas_centavos bigint check (testemunha_ofertas_centavos >= 0),
  add column token_hash text unique,
  add column token_expira_em timestamptz,
  add column tentativas smallint not null default 0;

comment on column public.contagem.modo is
  'Como foi conferida (D61): qr (testemunha no celular dela), papel (testemunha sem celular), conta (alguém com conta no app), sozinha (sem conferência, pastor avisado).';
comment on column public.contagem.token_hash is
  'sha256 do segredo do QR (o segredo em si nunca fica guardado). Some quando a testemunha confere.';

alter table public.contagem alter column conferente_id drop not null;

-- A regra "conferente diferente de quem contou" era uma check sem nome
do $$
declare v text;
begin
  for v in select conname from pg_constraint
           where conrelid = 'public.contagem'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%conferente_id <> contado_por%'
  loop
    execute format('alter table public.contagem drop constraint %I', v);
  end loop;
end $$;

alter table public.contagem
  add constraint contagem_conferente_outra_pessoa check (conferente_id is null or conferente_id <> contado_por),
  add constraint contagem_conferente_so_no_modo_conta check ((modo = 'conta') = (conferente_id is not null)),
  add constraint contagem_testemunha_nos_modos_com_testemunha check (
    modo not in ('papel') or testemunha_nome is not null);

comment on table public.contagem is
  'Dinheiro contado no culto (D48, D61). Só conferida vira lançamento; o modo diz quem conferiu e como.';

-- Contagem nova: a regra de "conferente com conta" só vale no modo conta ----------
create or replace function privado.conferir_contagem_nova()
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
  if new.modo = 'conta' and not privado.tem_conta_ativa(new.conferente_id) then
    raise exception 'Quem confere precisa ter conta ativa no app.' using errcode = 'check_violation';
  end if;
  -- Os outros modos só nascem pelas funções abaixo (que geram QR, comparam etc.)
  if new.modo <> 'conta' and coalesce(current_setting('iejb.contagem_por_funcao', true), '') <> 'sim' then
    raise exception 'Use o app para registrar esse tipo de contagem.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

-- Aviso ao conferente: só existe no modo conta
create or replace function privado.avisar_conferente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.modo <> 'conta' then return null; end if;
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

-- Aviso novo: contagem sem conferência (vai para o pastor)
alter table public.aviso drop constraint aviso_tipo_check;
alter table public.aviso add constraint aviso_tipo_check check (tipo in (
  'escala_alterada', 'repertorio_alterado', 'culto_cancelado',
  'solicitacao_nova', 'solicitacao_decidida', 'presenca_alterada',
  'contagem_para_conferir', 'contagem_decidida', 'contagem_sem_conferencia'));

-- Contagem conferida vira lançamento (uma peça só, usada por todos os modos) ----
create function privado.lancar_contagem(p_contagem uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v public.contagem;
begin
  update public.contagem set estado = 'conferida', decidido_em = now(), token_hash = null
  where id = p_contagem and estado = 'aguardando'
  returning * into v;
  if v.id is null then
    raise exception 'Essa contagem já foi decidida.' using errcode = 'check_violation';
  end if;
  insert into public.lancamento (tipo, conta_id, categoria_id, valor_centavos, data, descricao, forma, culto_id, contagem_id, criado_por)
  select 'entrada', v.conta_id, c.id, x.valor, v.data, x.descricao, 'dinheiro', v.culto_id, v.id, v.contado_por
  from (values ('dizimos', v.dizimos_centavos, 'Dízimos em dinheiro'),
               ('ofertas', v.ofertas_centavos, 'Ofertas em dinheiro')) as x(papel, valor, descricao)
  join public.categoria_financeira c on c.papel = x.papel
  where x.valor > 0;
end;
$$;
revoke execute on function privado.lancar_contagem(uuid) from public, anon, authenticated;

-- decidir_contagem (modo conta) passa a usar a mesma peça
create or replace function public.decidir_contagem(p_contagem uuid, p_confere boolean, p_motivo text default null)
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

  if p_confere then
    perform privado.lancar_contagem(v.id);
  else
    update public.contagem set estado = 'recusada', decidido_em = now(), motivo = trim(p_motivo) where id = v.id;
  end if;

  v_resumo := format('%s %s a contagem de %s.', (select coalesce(apelido, nome) from public.pessoa where id = v_eu),
    case when p_confere then 'conferiu' else 'não confirmou' end, to_char(v.data, 'DD/MM'));
  perform privado.criar_aviso('contagem_decidida', null, null, v_resumo, array[v.contado_por]);
end;
$$;
revoke execute on function public.decidir_contagem(uuid, boolean, text) from public, anon;
grant execute on function public.decidir_contagem(uuid, boolean, text) to authenticated;

-- Peça comum: valida e grava a contagem dos modos novos ---------------------------
create function privado.nova_contagem(
  p_modo text, p_data date, p_culto uuid, p_conta uuid, p_dizimos bigint, p_ofertas bigint, p_observacao text,
  p_testemunha text default null, p_t_dizimos bigint default null, p_t_ofertas bigint default null)
returns uuid
language plpgsql
set search_path = ''
as $$
declare v_id uuid;
begin
  if not privado.edita_financeiro() then
    raise exception 'Só a tesouraria registra contagem.' using errcode = 'insufficient_privilege';
  end if;
  perform set_config('iejb.contagem_por_funcao', 'sim', true);
  insert into public.contagem (modo, data, culto_id, conta_id, dizimos_centavos, ofertas_centavos, observacao, contado_por,
                               testemunha_nome, testemunha_dizimos_centavos, testemunha_ofertas_centavos)
  values (p_modo, p_data, p_culto, p_conta, coalesce(p_dizimos, 0), coalesce(p_ofertas, 0), nullif(trim(p_observacao), ''),
          privado.minha_pessoa_id(), nullif(trim(p_testemunha), ''), p_t_dizimos, p_t_ofertas)
  returning id into v_id;
  perform set_config('iejb.contagem_por_funcao', '', true);
  return v_id;
end;
$$;
-- Só as funções acima (security definer) chamam; ninguém de fora
revoke execute on function privado.nova_contagem(text, date, uuid, uuid, bigint, bigint, text, text, bigint, bigint) from public, anon, authenticated;

-- 'sozinha': entra no caixa e o pastor é avisado -----------------------------------
create function public.contar_sozinha(p_data date, p_culto uuid, p_conta uuid, p_dizimos bigint, p_ofertas bigint, p_observacao text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_pastores uuid[];
begin
  v_id := privado.nova_contagem('sozinha', p_data, p_culto, p_conta, p_dizimos, p_ofertas, p_observacao);
  perform privado.lancar_contagem(v_id);
  select array_agg(cp.pessoa_id) into v_pastores
  from public.cargo_pessoa cp where cp.cargo = 'pastor' and cp.pessoa_id <> privado.minha_pessoa_id();
  perform privado.criar_aviso('contagem_sem_conferencia', null, null,
    format('%s contou sozinha a contagem de %s (R$ %s), sem outra pessoa conferindo.',
      (select coalesce(apelido, nome) from public.pessoa where id = privado.minha_pessoa_id()),
      to_char(p_data, 'DD/MM'),
      replace(to_char((coalesce(p_dizimos, 0) + coalesce(p_ofertas, 0)) / 100.0, 'FM999G999G990D00'), ',', '.')),
    v_pastores);
end;
$$;
revoke execute on function public.contar_sozinha(date, uuid, uuid, bigint, bigint, text) from public, anon;
grant execute on function public.contar_sozinha(date, uuid, uuid, bigint, bigint, text) to authenticated;

-- 'papel': compara na hora; só grava se bateu --------------------------------------
create function public.contar_com_testemunha_sem_celular(
  p_data date, p_culto uuid, p_conta uuid, p_dizimos bigint, p_ofertas bigint,
  p_testemunha text, p_t_dizimos bigint, p_t_ofertas bigint, p_observacao text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if not privado.edita_financeiro() then
    raise exception 'Só a tesouraria registra contagem.' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(length(trim(p_testemunha)), 0) < 2 then
    raise exception 'Digite o nome de quem contou com você.' using errcode = 'check_violation';
  end if;
  if coalesce(p_dizimos, 0) <> coalesce(p_t_dizimos, 0) or coalesce(p_ofertas, 0) <> coalesce(p_t_ofertas, 0) then
    return jsonb_build_object('bateu', false,
      'dizimos', coalesce(p_dizimos, 0) = coalesce(p_t_dizimos, 0),
      'ofertas', coalesce(p_ofertas, 0) = coalesce(p_t_ofertas, 0));
  end if;
  v_id := privado.nova_contagem('papel', p_data, p_culto, p_conta, p_dizimos, p_ofertas, p_observacao,
                                p_testemunha, p_t_dizimos, p_t_ofertas);
  perform privado.lancar_contagem(v_id);
  return jsonb_build_object('bateu', true);
end;
$$;
revoke execute on function public.contar_com_testemunha_sem_celular(date, uuid, uuid, bigint, bigint, text, bigint, bigint, text) from public, anon;
grant execute on function public.contar_com_testemunha_sem_celular(date, uuid, uuid, bigint, bigint, text, bigint, bigint, text) to authenticated;

-- 'qr': a tesouraria pede; devolve o segredo UMA vez ------------------------------
create function public.pedir_testemunha(p_data date, p_culto uuid, p_conta uuid, p_dizimos bigint, p_ofertas bigint, p_observacao text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  v_id := privado.nova_contagem('qr', p_data, p_culto, p_conta, p_dizimos, p_ofertas, p_observacao);
  update public.contagem
  set token_hash = encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), token_expira_em = now() + interval '15 minutes'
  where id = v_id;
  return jsonb_build_object('contagem', v_id, 'token', v_token);
end;
$$;
revoke execute on function public.pedir_testemunha(date, uuid, uuid, bigint, bigint, text) from public, anon;
grant execute on function public.pedir_testemunha(date, uuid, uuid, bigint, bigint, text) to authenticated;

-- QR vencido? A tesouraria gera outro para a mesma contagem
create function public.renovar_testemunha(p_contagem uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if not privado.edita_financeiro() then
    raise exception 'Só a tesouraria faz isso.' using errcode = 'insufficient_privilege';
  end if;
  update public.contagem
  set token_hash = encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), token_expira_em = now() + interval '15 minutes', tentativas = 0
  where id = p_contagem and modo = 'qr' and estado = 'aguardando' and contado_por = privado.minha_pessoa_id();
  if not found then
    raise exception 'Essa contagem não está mais esperando testemunha.' using errcode = 'check_violation';
  end if;
  return v_token;
end;
$$;
revoke execute on function public.renovar_testemunha(uuid) from public, anon;
grant execute on function public.renovar_testemunha(uuid) to authenticated;

-- Do lado da testemunha (SEM login): só o necessário ------------------------------
create function privado.contagem_do_token(p_token text)
returns public.contagem
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.contagem
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
    and p_token ~ '^[0-9a-f]{64}$';
$$;
revoke execute on function privado.contagem_do_token(text) from public, anon, authenticated;

-- O que a testemunha vê: quem pediu e de qual culto. NUNCA valores.
create function public.testemunha_abrir(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v public.contagem;
begin
  v := privado.contagem_do_token(p_token);
  if v.id is null or v.estado <> 'aguardando' then return jsonb_build_object('situacao', 'invalido'); end if;
  if v.token_expira_em < now() then return jsonb_build_object('situacao', 'vencido'); end if;
  return jsonb_build_object(
    'situacao', 'ok',
    'quem', (select coalesce(apelido, split_part(nome, ' ', 1)) from public.pessoa where id = v.contado_por),
    'data', v.data,
    'culto', (select nome from public.culto where id = v.culto_id),
    'restam', 5 - v.tentativas);
end;
$$;
revoke execute on function public.testemunha_abrir(text) from public;
grant execute on function public.testemunha_abrir(text) to anon, authenticated;

-- A testemunha manda o que ELA contou. Diz só se bateu (e em qual parte não).
create function public.testemunha_conferir(p_token text, p_nome text, p_dizimos bigint, p_ofertas bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.contagem;
  v_bateu_d boolean;
  v_bateu_o boolean;
begin
  v := privado.contagem_do_token(p_token);
  if v.id is null or v.estado <> 'aguardando' then return jsonb_build_object('situacao', 'invalido'); end if;
  select * into v from public.contagem where id = v.id for update; -- uma resposta por vez
  if v.estado <> 'aguardando' or v.token_hash is null then return jsonb_build_object('situacao', 'invalido'); end if;
  if v.token_expira_em < now() then return jsonb_build_object('situacao', 'vencido'); end if;
  if v.tentativas >= 5 then return jsonb_build_object('situacao', 'esgotado'); end if;
  if coalesce(length(trim(p_nome)), 0) not between 2 and 60 then
    raise exception 'Digite seu nome.' using errcode = 'check_violation';
  end if;
  if p_dizimos is null or p_ofertas is null or p_dizimos < 0 or p_ofertas < 0 or p_dizimos + p_ofertas > 100000000000 then
    raise exception 'Valor inválido.' using errcode = 'check_violation';
  end if;

  v_bateu_d := p_dizimos = v.dizimos_centavos;
  v_bateu_o := p_ofertas = v.ofertas_centavos;
  update public.contagem
  set testemunha_nome = trim(p_nome), testemunha_dizimos_centavos = p_dizimos, testemunha_ofertas_centavos = p_ofertas,
      tentativas = tentativas + 1
  where id = v.id;

  if v_bateu_d and v_bateu_o then
    perform privado.lancar_contagem(v.id);
    perform privado.criar_aviso('contagem_decidida', null, null,
      format('%s conferiu a contagem de %s: bateu.', trim(p_nome), to_char(v.data, 'DD/MM')), array[v.contado_por]);
    return jsonb_build_object('situacao', 'bateu');
  end if;
  return jsonb_build_object('situacao', 'nao_bateu', 'dizimos', v_bateu_d, 'ofertas', v_bateu_o, 'restam', 4 - v.tentativas);
end;
$$;
revoke execute on function public.testemunha_conferir(text, text, bigint, bigint) from public;
grant execute on function public.testemunha_conferir(text, text, bigint, bigint) to anon, authenticated;
