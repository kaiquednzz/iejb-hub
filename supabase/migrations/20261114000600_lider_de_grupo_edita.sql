-- =============================================================================
-- 15. O líder de grupo muda a escala com autonomia (decisão D32, 14/11/2026)
--
-- Antes (Q2, RN-37 a 39): o líder de grupo PEDIA a alteração e o líder de
-- louvor aprovava. Agora, nos cultos PUBLICADOS em que o grupo dele está
-- escalado, o líder de grupo muda sozinho:
--   - pode: tirar e incluir pessoas, mudar o instrumento de alguém no culto;
--   - não pode: mesa de som, grupo do culto, cancelar, rascunho, publicar
--     (isso continua sendo a montagem do mês, do líder de louvor).
-- E o líder de louvor passa a ser AVISADO dessas mudanças (inverte a RN-44).
-- O pedido de alteração deixa de existir no app (o histórico fica guardado).
-- =============================================================================

-- Quem edita as pessoas de uma escala
create function privado.pode_editar_escala(p_escala uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select privado.e_lider_louvor(privado.ministerio_da_escala(p_escala))
      or privado.lidera_grupo_na_escala(p_escala);
$$;

drop policy "escala_item: líder de louvor inclui" on public.escala_item;
drop policy "escala_item: líder de louvor edita"  on public.escala_item;
drop policy "escala_item: líder de louvor tira"   on public.escala_item;

create policy "escala_item: líder de louvor e líder do grupo incluem"
on public.escala_item for insert to authenticated
with check (privado.pode_editar_escala(escala_id));

create policy "escala_item: líder de louvor e líder do grupo editam"
on public.escala_item for update to authenticated
using (privado.pode_editar_escala(escala_id))
with check (privado.pode_editar_escala(escala_id));

create policy "escala_item: líder de louvor e líder do grupo tiram"
on public.escala_item for delete to authenticated
using (privado.pode_editar_escala(escala_id));

-- A mesa de som continua só com o líder de louvor: o líder de grupo não
-- coloca, não tira e não troca quem está na mesa.
-- SEM security definer de propósito: dentro de uma função definer o
-- current_user vira o dono, e o e_sistema() acharia que é sempre o sistema.
create function privado.mesa_so_lider_de_louvor()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_escala uuid := coalesce(new.escala_id, old.escala_id);
  v_antes  boolean := tg_op <> 'INSERT' and 'Mesa' = any (old.instrumento_exibido);
  v_depois boolean := tg_op <> 'DELETE' and 'Mesa' = any (new.instrumento_exibido);
begin
  if privado.e_sistema() or privado.e_lider_louvor(privado.ministerio_da_escala(v_escala)) then
    return coalesce(new, old);
  end if;
  if (tg_op = 'DELETE' and v_antes) or (tg_op <> 'DELETE' and v_antes is distinct from v_depois) then
    raise exception 'A mesa de som é definida pelo líder de louvor.'
      using errcode = 'insufficient_privilege';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger mesa_so_lider_de_louvor
before insert or update or delete on public.escala_item
for each row execute function privado.mesa_so_lider_de_louvor();

-- Ninguém abre pedido novo (a tela saiu). Decidir os antigos ainda funciona.
drop policy "solicitacao: líder do grupo escalado pede" on public.solicitacao_alteracao;

-- -----------------------------------------------------------------------------
-- Avisos: se quem mudou NÃO é líder de louvor, o líder de louvor também
-- recebe, e o resumo diz quem mudou ("Escala atualizada por Mari: ...").
-- Igual à versão da migração 06, com os trechos marcados "NOVO".
-- -----------------------------------------------------------------------------
create or replace function public.processar_avisos_pendentes(p_janela interval default interval '5 minutes')
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
  v_autores     uuid[];   -- NOVO: quem mudou sem ser líder de louvor
  v_lideres     uuid[];   -- NOVO: líderes de louvor do ministério
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

    -- NOVO
    select array_agg(m.pessoa_id) into v_lideres
    from public.membro_ministerio m
    where m.ministerio_id = privado.ministerio_da_escala(v_escala.escala_id)
      and m.e_lider and m.ativo;

    select array_agg(distinct a.feita_por) into v_autores
    from public.escala_alteracao a
    where a.escala_id = v_escala.escala_id and a.processada_em is null
      and a.tipo in ('entrou', 'saiu', 'instrumento_mudou')
      and a.feita_por is not null
      and not (a.feita_por = any (coalesce(v_lideres, '{}')));

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
          -- NOVO: diz quem mudou quando não foi o líder de louvor
          v_resumo := 'Escala atualizada' ||
            coalesce(' por ' || (select string_agg(privado.nome_curto(x), ', ') from unnest(v_autores) x), '') ||
            ': ' || v_descricao;
          if v_entraram is not null then
            v_resumo := v_resumo || '. Entrou: ' ||
              (select string_agg(privado.nome_curto(x), ', ') from unnest(v_entraram) x);
          end if;
          if v_sairam is not null then
            v_resumo := v_resumo || '. Saiu: ' ||
              (select string_agg(privado.nome_curto(x), ', ') from unnest(v_sairam) x);
          end if;
          if v_entraram is null and v_sairam is null and 'instrumento_mudou' = any (v_tipos) then
            v_resumo := v_resumo || '. Mudança de instrumento.';
          end if;
        end if;

        v_aviso := privado.criar_aviso(
          'escala_alterada', v_escala.escala_id, null, v_resumo,
          coalesce(v_atuais, '{}') || coalesce(v_sairam, '{}')
            -- NOVO: o líder de louvor fica sabendo do que o líder de grupo mudou
            || case when v_autores is not null then coalesce(v_lideres, '{}') else '{}' end);
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

revoke execute on function
  privado.pode_editar_escala(uuid),
  privado.mesa_so_lider_de_louvor(),
  public.processar_avisos_pendentes(interval)
from public, anon, authenticated;
grant execute on function privado.pode_editar_escala(uuid), privado.mesa_so_lider_de_louvor() to authenticated;
grant execute on function public.processar_avisos_pendentes(interval) to service_role;
