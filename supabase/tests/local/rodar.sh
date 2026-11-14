#!/usr/bin/env bash
# Recria um banco de teste do zero, aplica as migrações e roda o cenário.
# Uso: ./rodar.sh   (precisa de um Postgres; configure PGHOST/PGPORT/PGUSER)
set -euo pipefail
cd "$(dirname "$0")"

BANCO=iejb_hub_teste
PSQL="psql -v ON_ERROR_STOP=1 -q"

$PSQL -d postgres -c "drop database if exists $BANCO" -c "create database $BANCO" >/dev/null 2>&1

$PSQL -d $BANCO -f 00_simular_supabase.sql
for migracao in ../../migrations/*.sql; do
  echo "aplicando $(basename "$migracao")"
  $PSQL -d $BANCO -f "$migracao"
done
$PSQL -d $BANCO -f 01_ajudantes.sql
$PSQL -d $BANCO -f 02_cenario_piloto.sql 2>&1 >/dev/null | sed "s/^psql:[^:]*:[0-9]*: //; s/^NOTICE:  //"
$PSQL -d $BANCO -f 03_gestao_de_pessoas.sql 2>&1 >/dev/null | sed "s/^psql:[^:]*:[0-9]*: //; s/^NOTICE:  //"
