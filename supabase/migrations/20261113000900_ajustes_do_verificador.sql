-- =============================================================================
-- 09. Ajustes apontados pelo verificador (advisors) do Supabase
--
-- Por que existe: o Supabase dá EXECUTE em toda função nova do esquema public
-- direto ao papel "authenticated" (não só ao PUBLIC). A migração 07 tirou o
-- privilégio de PUBLIC e anon, mas não de authenticated, então duas funções
-- que deviam ser só do sistema ficaram chamáveis por qualquer conta logada.
-- Migrações já aplicadas não se editam: a correção vem numa nova.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Segurança
-- -----------------------------------------------------------------------------

-- Só o sistema dispara avisos e cria o primeiro administrador.
-- Sem isso, antes de existir admin, uma conta pendente poderia se promover.
revoke execute on function public.processar_avisos_pendentes(interval) from authenticated;
revoke execute on function public.inicializar_primeiro_admin(text, text) from authenticated;

-- TRUNCATE esvazia a tabela inteira ignorando o RLS. A API não oferece esse
-- comando, mas não há motivo para o papel ter o privilégio.
revoke truncate, references, trigger on all tables in schema public from authenticated, anon;

-- Daqui para frente, funções novas no public nascem fechadas: cada migração
-- precisa dar GRANT explícito para o que o app for chamar.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Desempenho
-- "(select auth.uid())" é calculado uma vez por consulta; "auth.uid()" solto,
-- uma vez por linha. Com 13 pessoas não muda nada, mas é o jeito certo.
-- -----------------------------------------------------------------------------
drop policy "conta: vejo a minha" on public.conta;
drop policy "conta: admin vê todas" on public.conta;
create policy "conta: vejo a minha; admin vê todas"
on public.conta for select to authenticated
using (id = (select auth.uid()) or privado.e_admin());

alter policy "dispositivo_push: vejo os meus" on public.dispositivo_push
using (conta_id = (select auth.uid()) and privado.minha_pessoa_id() is not null);

alter policy "dispositivo_push: registro os meus" on public.dispositivo_push
with check (conta_id = (select auth.uid()) and privado.minha_pessoa_id() is not null);

alter policy "dispositivo_push: atualizo os meus" on public.dispositivo_push
using (conta_id = (select auth.uid()) and privado.minha_pessoa_id() is not null)
with check (conta_id = (select auth.uid()) and privado.minha_pessoa_id() is not null);

alter policy "dispositivo_push: removo os meus" on public.dispositivo_push
using (conta_id = (select auth.uid()));

-- Índices nas chaves estrangeiras que ainda não tinham (deixam junções e
-- conferências de integridade rápidas).
create index aviso_escala_idx                  on public.aviso (escala_id);
create index aviso_solicitacao_idx             on public.aviso (solicitacao_id);
create index conta_decidido_por_idx            on public.conta (decidido_por);
create index escala_alterada_por_idx           on public.escala (alterada_por);
create index escala_ministerio_idx             on public.escala (ministerio_id);
create index escala_alteracao_aviso_idx        on public.escala_alteracao (aviso_id);
create index escala_alteracao_feita_por_idx    on public.escala_alteracao (feita_por);
create index escala_alteracao_pessoa_idx       on public.escala_alteracao (pessoa_id);
create index escala_item_origem_grupo_idx      on public.escala_item (origem_grupo_id);
create index grupo_lider_idx                   on public.grupo (id, lider_pessoa_id);
create index registro_auditoria_ator_idx       on public.registro_auditoria (ator_conta_id);
create index repertorio_item_ministerio_idx    on public.repertorio_item (ministerio_id);
create index solicitacao_autor_idx             on public.solicitacao_alteracao (autor_pessoa_id);
create index solicitacao_decidida_por_idx      on public.solicitacao_alteracao (decidida_por);
