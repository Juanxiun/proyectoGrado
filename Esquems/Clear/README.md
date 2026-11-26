# Limpieza de bases de datos

Estos scripts eliminan todos los registros de las tablas del esquema `public` en
`ShalomDB` y `ShalomDBGM`, y reinician los contadores `IDENTITY`. Conservan la
estructura (tablas, índices y restricciones). También vacían catálogos como roles,
materias, insignias y recompensas.

Desde la raíz del repositorio, con PostgreSQL accesible:

```bash
bash clear/clear.sh
```

El script usa `localhost:5432` y el usuario `Juanxiu` por defecto. Se puede
configurar con las variables estándar de PostgreSQL, por ejemplo:

```bash
PGHOST=localhost PGPORT=5432 PGUSER=Juanxiu PGPASSWORD='tu-clave' bash clear/clear.sh
```

También se puede limpiar una sola base conectándose con `psql` y ejecutando el
SQL correspondiente:

```bash
psql -U Juanxiu -d ShalomDB -v ON_ERROR_STOP=1 -f clear/ShalomDB.sql
psql -U Juanxiu -d ShalomDBGM -v ON_ERROR_STOP=1 -f clear/ShalomDBGM.sql
```

La operación es transaccional por base. `CASCADE` asegura que se vacíen tablas
relacionadas; `RESTART IDENTITY` reinicia sus secuencias. No ejecuta `DROP` ni
modifica las bases Redis, MinIO u Ollama.
