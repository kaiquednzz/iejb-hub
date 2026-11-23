#!/usr/bin/env bash
# Recria um banco de teste do zero, aplica as migrações e roda os cenários.
# Uso: ./rodar.sh   (precisa de um Postgres; configure PGHOST/PGPORT/PGUSER)
#
# Os cenários 02 a 05 testam o banco como era até a migração 14 (inclusive o
# pedido de alteração, que a 15 tirou). Por isso eles rodam ANTES da 15, e o
# cenário 06 roda depois, testando a regra nova sobre os mesmos dados.
set -euo pipefail
cd "$(dirname "$0")"

BANCO=iejb_hub_teste
PSQL="psql -v ON_ERROR_STOP=1 -q"
CORTE=20261114000600   # primeira migração que muda regra testada nos cenários antigos

cenario() {
  $PSQL -d $BANCO -f "$1" 2>&1 >/dev/null | sed "s/^psql:[^:]*:[0-9]*: //; s/^NOTICE:  //"
}

$PSQL -d postgres -c "drop database if exists $BANCO" -c "create database $BANCO" >/dev/null 2>&1
$PSQL -d $BANCO -f 00_simular_supabase.sql

depois=()
for migracao in ../../migrations/*.sql; do
  nome=$(basename "$migracao")
  if [[ "${nome%%_*}" < "$CORTE" ]]; then
    echo "aplicando $nome"
    $PSQL -d $BANCO -f "$migracao"
  else
    depois+=("$migracao")
  fi
done

$PSQL -d $BANCO -f 01_ajudantes.sql
cenario 02_cenario_piloto.sql
cenario 03_gestao_de_pessoas.sql
cenario 04_montar_escala_e_fotos.sql
cenario 05_push.sql

for migracao in "${depois[@]}"; do
  echo "aplicando $(basename "$migracao")"
  $PSQL -d $BANCO -f "$migracao"
done
cenario 06_lider_de_grupo_edita.sql
cenario 07_eventos_do_site.sql
cenario 08_nao_vou_e_repertorio.sql
cenario 09_historico.sql
cenario 10_jovens_e_grupos.sql
cenario 11_cargos_e_financeiro.sql
cenario 12_agenda.sql
cenario 13_codigo_de_verificacao.sql
cenario 14_testemunha_da_contagem.sql
cenario 15_primeiro_acesso.sql
cenario 16_mural.sql
cenario 17_contato_so_de_quem_serve.sql
cenario 18_oracao_aniversario_lembrete.sql
cenario 19_foto_de_membro.sql
cenario 20_cadastro_da_igreja.sql
