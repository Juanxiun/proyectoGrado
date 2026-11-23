#!/usr/bin/env bash
set -euo pipefail

# Permite ajustar conexión con variables estándar de libpq: PGHOST, PGPORT,
# PGUSER, PGPASSWORD, PGSSLMODE, etc. El password se solicita si no se define.
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-Juanxiu}"
export PGHOST PGPORT PGUSER

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

for database in ShalomDB ShalomDBGM; do
  echo "Limpiando ${database}..."
  psql --dbname="$database" --set=ON_ERROR_STOP=1 --file="${script_dir}/${database}.sql"
done

echo "Bases ShalomDB y ShalomDBGM vaciadas correctamente."
