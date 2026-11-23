-- =============================================================================
-- Migração: membro compartilha foto ou palavra, uma vez por semana (D72)
-- =============================================================================
-- Antes (D70) o membro só postava uma foto por culto, nas 48h depois dele.
-- Agora ele escolhe o que compartilhar:
--   * foto: uma imagem com legenda de até 140 letras;
--   * palavra: versículo, mensagem ou reflexão, até 280 letras, com a
--     referência opcional (ex.: Salmo 23:1).
-- Trava: UM post por pessoa por semana (domingo a sábado, horário de
-- Brasília), qualquer que seja o tipo. Aviso continua só da Comunicação.
-- Continua valendo: aparece na hora, some em 90 dias se não for guardado, o
-- autor edita o texto e apaga, pastor/Comunicação/admin apagam qualquer um.
-- =============================================================================

-- Domingo da semana de um instante, no horário de Brasília
create function privado.domingo_da_semana(p_quando timestamptz)
returns date
language sql
immutable
set search_path = ''
as $$
  select (p_quando at time zone 'America/Sao_Paulo')::date
         - extract(dow from (p_quando at time zone 'America/Sao_Paulo'))::int;
$$;
revoke execute on function privado.domingo_da_semana(timestamptz) from public, anon, authenticated;

alter table public.mural_publicacao add column semana date;
comment on column public.mural_publicacao.semana is 'Post de membro (D72): domingo da semana em que foi postado. Um por pessoa por semana.';

-- As fotos antigas (uma por culto) ficam sem semana: não entram na trava nova
drop index public.mural_uma_foto_por_culto;
create unique index mural_um_por_semana on public.mural_publicacao (criado_por, semana)
  where de_membro and semana is not null;

-- O que um post de membro pode ser (vale também para a edição)
alter table public.mural_publicacao add constraint mural_post_de_membro check (
  not de_membro or (
    titulo is null
    and (
      (tipo = 'fotos'   and cardinality(fotos) = 1 and (texto is null or char_length(texto) <= 140))
      or
      (tipo = 'palavra' and char_length(texto) <= 280)
    )
  )
);

-- O autor muda só o texto (e a referência, na palavra)
create or replace function privado.mural_autor_so_muda_legenda()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not privado.publica_no_mural() and (
       new.fixado_ate is distinct from old.fixado_ate
    or new.guardar is distinct from old.guardar
    or new.titulo is distinct from old.titulo
    or (new.tipo <> 'palavra' and new.referencia is distinct from old.referencia)) then
    raise exception 'Você pode mudar só o texto do seu post.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop policy "mural: quem publica ou o autor da foto edita" on public.mural_publicacao;
create policy "mural: quem publica ou o autor edita"
on public.mural_publicacao for update to authenticated
using (privado.publica_no_mural() or (de_membro and criado_por = privado.minha_pessoa_id()))
with check (privado.publica_no_mural() or (de_membro and criado_por = privado.minha_pessoa_id()));

drop policy "mural: quem publica ou o autor da foto apaga" on public.mural_publicacao;
create policy "mural: quem publica ou o autor apaga"
on public.mural_publicacao for delete to authenticated
using (privado.publica_no_mural() or (de_membro and criado_por = privado.minha_pessoa_id()));

drop function public.postar_foto_do_culto(uuid, text, text);
drop function public.culto_para_foto();

-- Para o app: posso compartilhar esta semana? E, se teve culto nas últimas
-- 48h, o nome dele (o convite do mural fala do culto).
create function public.posso_compartilhar()
returns table (pode boolean, volta_em date, culto_recente text)
language sql
stable
security definer
set search_path = ''
as $$
  with eu as (select privado.minha_pessoa_id() as id),
       semana as (select privado.domingo_da_semana(now()) as domingo)
  select
    not exists (select 1 from public.mural_publicacao m, semana s
                where m.de_membro and m.criado_por = eu.id and m.semana = s.domingo),
    (select domingo + 7 from semana),
    (select c.nome from public.culto c
     where c.estado = 'ativo'
       and ((c.data + c.horario) at time zone 'America/Sao_Paulo') between now() - interval '48 hours' and now()
     order by c.data desc, c.horario desc limit 1)
  from eu
  where eu.id is not null;
$$;
revoke execute on function public.posso_compartilhar() from public, anon;
grant execute on function public.posso_compartilhar() to authenticated;

create function public.compartilhar_no_mural(
  p_tipo       text,
  p_texto      text default null,
  p_referencia text default null,
  p_foto       text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eu     uuid := privado.minha_pessoa_id();
  v_texto  text := nullif(btrim(p_texto), '');
  v_ref    text := nullif(btrim(p_referencia), '');
  v_semana date := privado.domingo_da_semana(now());
  v_culto  uuid;
  v_id     uuid;
begin
  if v_eu is null then
    raise exception 'Só quem tem conta aprovada compartilha no mural.' using errcode = '42501';
  end if;
  if p_tipo not in ('fotos', 'palavra') then
    raise exception 'Dá para compartilhar uma foto ou uma palavra.' using errcode = '22023';
  end if;
  if exists (select 1 from public.mural_publicacao
             where de_membro and criado_por = v_eu and semana = v_semana) then
    raise exception 'Você já compartilhou esta semana. No domingo libera de novo.' using errcode = 'P0001';
  end if;

  if p_tipo = 'fotos' then
    -- A foto fica na pasta da própria pessoa: membros/<pessoa>/<uuid>.webp
    if p_foto is null or p_foto !~ ('^membros/' || v_eu::text || '/[0-9a-f-]{36}\.(webp|jpg)$') then
      raise exception 'Foto inválida.' using errcode = '22023';
    end if;
    if char_length(coalesce(v_texto, '')) > 140 then
      raise exception 'A legenda vai até 140 letras.' using errcode = '22023';
    end if;
    v_ref := null;
    -- Foto logo depois de um culto leva o nome dele no cartão
    select c.id into v_culto from public.culto c
    where c.estado = 'ativo'
      and ((c.data + c.horario) at time zone 'America/Sao_Paulo') between now() - interval '48 hours' and now()
    order by c.data desc, c.horario desc limit 1;
  else
    if p_foto is not null then
      raise exception 'A palavra vai sem foto.' using errcode = '22023';
    end if;
    if v_texto is null then
      raise exception 'Escreva a palavra.' using errcode = '22023';
    end if;
    if char_length(v_texto) > 280 then
      raise exception 'A palavra vai até 280 letras.' using errcode = '22023';
    end if;
    if char_length(coalesce(v_ref, '')) > 60 then
      raise exception 'A referência vai até 60 letras.' using errcode = '22023';
    end if;
  end if;

  begin
    insert into public.mural_publicacao (tipo, texto, referencia, fotos, criado_por, de_membro, culto_id, semana)
    values (p_tipo, v_texto, v_ref,
            case when p_tipo = 'fotos' then array[p_foto] else '{}' end,
            v_eu, true, v_culto, v_semana)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Você já compartilhou esta semana. No domingo libera de novo.' using errcode = 'P0001';
  end;
  return v_id;
end;
$$;
revoke execute on function public.compartilhar_no_mural(text, text, text, text) from public, anon;
grant execute on function public.compartilhar_no_mural(text, text, text, text) to authenticated;

-- A limpeza dos 90 dias (fotos_de_membro_vencidas) já pega todo post de
-- membro, inclusive a palavra, que não tem arquivo.
