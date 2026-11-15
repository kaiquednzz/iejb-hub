-- =============================================================================
-- Migração 22: histórico de repertórios (D39)
--
-- D36 escondia o repertório de quem não é do culto. Isso só faz sentido ANTES
-- do culto. Depois que ele começou, qualquer integrante do ministério pode
-- consultar (decisão de Kaique, 15/11/2026): "quando tocamos essa música?",
-- "o que o G2 tocou na ceia passada?". Cultos cancelados não entram (não
-- teve repertório tocado). Antes do culto continua tudo como na D36.
-- =============================================================================

create or replace function privado.pode_ver_repertorio(p_culto uuid, p_ministerio uuid)
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
          and gm.pessoa_id = privado.minha_pessoa_id())
      or (                                                       -- D39: culto que já começou
        privado.e_integrante(p_ministerio)
        and exists (
          select 1 from public.culto c
          where c.id = p_culto and c.estado = 'ativo'
            and (c.data + c.horario) <= (now() at time zone 'America/Sao_Paulo')));
$$;
