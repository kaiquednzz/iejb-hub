-- =============================================================================
-- 12. Fecha para "anon" as funções das migrações 10 e 11
--
-- Lição (de novo, como na 09): o "alter default privileges" da migração 09
-- vale para funções criadas pelo papel postgres. As migrações aplicadas pelo
-- painel/MCP podem rodar com outro papel, e aí a função nova nasce aberta a
-- PUBLIC (inclusive a quem não está logado). O verificador apontou
-- definir_foto. Nenhuma fazia estrago (todas checam a conta por dentro ou
-- passam pelo RLS), mas o certo é fechar: daqui para frente, toda migração
-- termina com o REVOKE explícito.
-- =============================================================================
revoke execute on function
  public.cadastrar_pessoa(text, text, text, text[], uuid),
  public.aprovar_pedido(uuid, uuid, text, uuid),
  public.definir_pessoa_ativa(uuid, boolean),
  public.definir_grupos_do_culto(uuid, uuid, uuid[]),
  public.definir_mesa(uuid, uuid, uuid),
  public.definir_foto(uuid, text),
  privado.escala_do_culto(uuid, uuid),
  privado.pode_mudar_foto(uuid),
  privado.pode_mudar_foto_no_caminho(text),
  privado.e_admin_ativo(uuid),
  privado.existe_outro_admin(uuid)
from public, anon;
