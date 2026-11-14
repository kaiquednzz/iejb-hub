-- =============================================================================
-- 07. Privilégios e agendamento
--
-- Duas camadas de proteção, e as duas precisam deixar passar:
--   1. GRANT: o papel pode, em geral, usar aquela tabela ou função?
--   2. RLS:   e essa LINHA específica, pode?
-- O Supabase dá privilégios amplos por padrão (inclusive ao "anon", quem não
-- está logado). Aqui fechamos tudo e abrimos só o necessário.
-- =============================================================================

-- Ninguém deslogado acessa nada do Hub.
revoke all on all tables    in schema public  from anon;
revoke all on all sequences in schema public  from anon;
revoke all on all functions in schema public  from public, anon;
revoke all on all functions in schema privado from public, anon;

-- Logados: as políticas de RLS decidem linha a linha.
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Tabelas que só o sistema escreve (gatilhos e funções security definer).
revoke insert, update, delete on public.conta              from authenticated;
revoke insert, update, delete on public.registro_auditoria from authenticated;
revoke insert, update, delete on public.escala_alteracao   from authenticated;
revoke insert, update, delete on public.aviso              from authenticated;
revoke insert, update, delete on public.aviso_destinatario from authenticated;
revoke insert, update, delete on public.ministerio         from authenticated;
-- Não se apaga: pessoa, culto e tipo de culto são desativados ou cancelados.
revoke delete on public.pessoa, public.culto, public.tipo_culto,
                 public.membro_ministerio, public.grupo,
                 public.solicitacao_alteracao from authenticated;
-- Solicitação só muda pela função decidir_solicitacao.
revoke update on public.solicitacao_alteracao from authenticated;

-- A chave de serviço (funções de servidor) enxerga tudo, ignorando RLS.
grant all on all tables in schema public to service_role;

-- Funções auxiliares usadas pelas políticas: quem está logado precisa poder
-- executá-las, senão a política falha. Ficam no esquema privado, fora da API.
grant execute on function
  privado.e_sistema(),
  privado.minha_pessoa_id(),
  privado.e_admin(),
  privado.e_integrante(uuid),
  privado.e_lider_louvor(uuid),
  privado.e_lider_de_algum_ministerio(),
  privado.ministerio_do_grupo(uuid),
  privado.lidera_grupo(uuid),
  privado.lidera_algum_grupo(),
  privado.ministerio_da_escala(uuid),
  privado.pode_ver_escala(uuid),
  privado.lidera_grupo_na_escala(uuid),
  privado.pode_editar_repertorio(uuid, uuid),
  privado.sou_destinatario(uuid)
to authenticated;

grant execute on all functions in schema privado to service_role;

-- Funções que o app chama (RPC). Cada uma confere o papel por dentro.
grant execute on function
  public.aprovar_conta(uuid, uuid, boolean),
  public.recusar_conta(uuid),
  public.desativar_conta(uuid),
  public.definir_administrador(uuid, boolean),
  public.marcar_senha_temporaria(uuid),
  public.atualizar_meu_contato(text),
  public.gerar_cultos(date),
  public.preencher_escala_com_grupo(uuid, uuid),
  public.decidir_solicitacao(uuid, boolean, text),
  public.mover_musica_no_repertorio(uuid, integer),
  public.marcar_aviso_lido(uuid)
to authenticated;

-- Só o sistema (painel do Supabase ou chave de serviço).
grant execute on function
  public.processar_avisos_pendentes(interval),
  public.inicializar_primeiro_admin(text, text)
to service_role;

-- -----------------------------------------------------------------------------
-- Agendamento: processa os avisos a cada minuto (RN-45).
-- Usa o pg_cron do Supabase. Em um Postgres sem pg_cron (testes locais),
-- este bloco não faz nada.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule(
      'processar-avisos',
      '* * * * *',
      'select public.processar_avisos_pendentes()'
    );
  end if;
end;
$$;
