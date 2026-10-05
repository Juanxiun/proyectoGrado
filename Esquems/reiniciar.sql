-- =============================================================================
-- REINICIO TOTAL DE LA BASE DE DATOS
--
-- Borra la base, la vuelve a crear desde el esquema y la puebla con los datos
-- de prueba. Deja el sistema como si recién hubiera salido del repositorio,
-- pero con los cambios nuevos ya aplicados:
--
--   · `grado_materias` reemplaza a `curso_materias`: las materias y la maya
--     curricular se configuran por GRADO (nivel + grado), no por paralelo. 1°A y
--     1°B siguen siendo filas de `cursos` porque horarios, inscripciones y
--     asignaciones docentes sí son por paralelo.
--   · `malla_temas` es el temario por grado y materia, reutilizable entre
--     gestión. Es distinto de `mallas_curriculares`, que sólo registra qué
--     materia existe en un período.
--
-- ── Orden de carga ───────────────────────────────────────────────────────────
--   1. BDmain.sql → esquema completo: tablas, índices y llaves foráneas.
--   2. datos.sql  → datos de prueba: roles, turnos, aulas, materias, cursos,
--                    materias por grado, temas, gestión 2026, personal,
--                    inscripciones, asignaciones, notas, asistencia y pagos.
--
-- Los roles, las materias y los cursos NO se crean acá: ya vienen en
-- datos.sql. Este script sólo orchestra la reconstrucción.
--
-- ── Cómo se ejecuta ──────────────────────────────────────────────────────────
--   psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f Esquems\reiniciar.sql
--
-- Para usar otra base o credenciales:
--   psql -v dbname=MiBase -f Esquems\reiniciar.sql
--
-- `ON_ERROR_STOP=1` es obligatorio: sin él, un error en BDmain.sql dejaría el
-- script siguiendo adelante sobre una base a medio construir. El propio
-- archivo también lo activa, así que funciona igual aunque se lo olvide en la
-- línea de comandos.
--
-- Es DESTRUCTIVO: borra todos los datos de la base indicada.
-- =============================================================================

\set ON_ERROR_STOP on
\echo ''
\echo '=============================================================='
\echo '  Reinicio total de la base. Se borra todo lo que haya ahora.'
\echo '=============================================================='
\echo ''

-- ── 1 · Recrear la base ──────────────────────────────────────────────────────
-- La conexión tiene que estar en otra base: Postgres no permite borrar la base
-- a la que está conectada. Por eso el script exige entrar con `-d postgres`.
\set dbname ShalomDB

\connect postgres

SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = :'dbname' AND pid <> pg_backend_pid();

DROP DATABASE IF EXISTS :"dbname";

\echo '  -> base :' :dbname 'eliminada, se vuelve a crear vacía'

CREATE DATABASE :"dbname" WITH OWNER = CURRENT_USER ENCODING = 'UTF8';
\connect :"dbname"

\echo '  -> base :' :dbname 'creada'
\echo ''

-- ── 2 · Esquema ──────────────────────────────────────────────────────────────
\echo '  -> cargando esquema (BDmain.sql)'
\echo ''
\ir BDmain.sql
\echo ''
\echo '  -> esquema listo'
\echo ''

-- ── 3 · Datos de prueba ──────────────────────────────────────────────────────
\echo '  -> cargando datos de prueba (datos.sql)'
\echo ''
\ir datos.sql
\echo ''
\echo '  -> datos listos'
\echo ''

-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================
\echo '=============================================================='
\echo '  Resultado'
\echo '=============================================================='

SELECT 'roles'                 AS entidad, COUNT(*) AS total FROM "roles"
UNION ALL SELECT 'materias',              COUNT(*) FROM "materias"
UNION ALL SELECT 'cursos',                COUNT(*) FROM "cursos"
UNION ALL SELECT 'grado_materias',        COUNT(*) FROM "grado_materias"
UNION ALL SELECT 'malla_temas',           COUNT(*) FROM "malla_temas"
UNION ALL SELECT 'aulas',                 COUNT(*) FROM "aulas"
UNION ALL SELECT 'trimestres',            COUNT(*) FROM "trimestres"
UNION ALL SELECT 'cursos_periodo',        COUNT(*) FROM "cursos_periodo"
UNION ALL SELECT 'mallas_curriculares',   COUNT(*) FROM "mallas_curriculares"
UNION ALL SELECT 'usuarios',              COUNT(*) FROM "usuarios"
UNION ALL SELECT 'apoderados',            COUNT(*) FROM "apoderados"
UNION ALL SELECT 'maestros',              COUNT(*) FROM "maestros"
UNION ALL SELECT 'maestro_materias',      COUNT(*) FROM "maestro_materias"
UNION ALL SELECT 'estudiantes',           COUNT(*) FROM "estudiantes"
UNION ALL SELECT 'inscripciones',         COUNT(*) FROM "inscripciones"
UNION ALL SELECT 'asignaciones_docentes', COUNT(*) FROM "asignaciones_docentes"
UNION ALL SELECT 'curso_asesor',          COUNT(*) FROM "curso_asesor"
UNION ALL SELECT 'encargos',              COUNT(*) FROM "encargos"
UNION ALL SELECT 'calificaciones',        COUNT(*) FROM "calificaciones"
UNION ALL SELECT 'asistencia',            COUNT(*) FROM "asistencia"
UNION ALL SELECT 'pensiones',             COUNT(*) FROM "pensiones"
ORDER BY 1;

\echo ''
\echo '  Inscritos por aula (solo las que tienen estudiantes):'
SELECT c."nivel", c."grado", c."paralelo", c."capacidad_maxima", COUNT(i."id") AS inscritos
FROM "cursos" c
JOIN "cursos_periodo" cp ON cp."curso_id" = c."id"
JOIN "inscripciones" i   ON i."curso_periodo_id" = cp."id" AND i."estado" = 'activo'
GROUP BY c."nivel", c."grado", c."paralelo", c."capacidad_maxima"
HAVING COUNT(i."id") > 0
ORDER BY c."nivel", c."grado", c."paralelo";

\echo ''
\echo '  Materias y docentes por grado:'
SELECT c."nivel", c."grado",
       COUNT(DISTINCT ad."materia_id") AS materias,
       COUNT(DISTINCT ad."maestro_id") AS docentes
FROM "cursos" c
JOIN "cursos_periodo" cp ON cp."curso_id" = c."id"
JOIN "asignaciones_docentes" ad ON ad."curso_periodo_id" = cp."id" AND ad."estado" = 'activo'
GROUP BY c."nivel", c."grado"
ORDER BY c."nivel", c."grado";

\echo ''
\echo '  Bandas de riesgo del 1er trimestre (lo que calcula el seguimiento):'
-- El promedio sale de `calificaciones.estudiante_id` y NO de pasar por
-- `inscripciones`: una calificación pertenece al curso de su estudiante, así
-- que unir por `curso_periodo_id` contra las inscripciones del mismo curso
-- multiplicaría cada nota por el tamaño del aula (4510 filas → 462286).
WITH notas AS (
  SELECT cal."estudiante_id",
         SUM(cal."nota" * e."ponderacion") / NULLIF(SUM(e."ponderacion"), 0) AS promedio
  FROM "calificaciones" cal
  JOIN "encargos" e            ON e."id" = cal."encargo_id"
  JOIN "asignaciones_docentes" ad ON ad."id" = e."asignacion_id"
  JOIN "cursos_periodo" cp     ON cp."id" = ad."curso_periodo_id"
  JOIN "trimestres" t          ON t."periodo_id" = cp."periodo_id" AND t."numero" = 1
  WHERE e."estado" = 'publicado'
    AND e."fecha_publicacion" BETWEEN t."inicio" AND t."fin"
  GROUP BY cal."estudiante_id"
),
asist AS (
  SELECT a."estudiante_id",
         ROUND(100.0 * COUNT(*) FILTER (WHERE a."estado" <> 'ausente') / COUNT(*)) AS pct
  FROM "asistencia" a
  JOIN "asignaciones_docentes" ad ON ad."id" = a."asignacion_id"
  JOIN "cursos_periodo" cp     ON cp."id" = ad."curso_periodo_id"
  JOIN "trimestres" t          ON t."periodo_id" = cp."periodo_id" AND t."numero" = 1
  WHERE a."fecha" BETWEEN t."inicio" AND t."fin"
  GROUP BY a."estudiante_id"
),
clasificado AS (
  SELECT
    CASE
      WHEN n.promedio < 50 AND a.pct < 60 THEN 'riesgo alto'
      WHEN n.promedio < 60 OR  a.pct < 75 THEN 'riesgo'
      WHEN a.pct < 85                     THEN 'observacion'
      ELSE 'normal'
    END AS banda,
    ROUND(n.promedio, 1) AS promedio,
    a.pct AS asistencia
  FROM notas n
  JOIN asist a ON a."estudiante_id" = n."estudiante_id"
)
SELECT banda,
       COUNT(*) AS estudiantes,
       ROUND(MIN(promedio), 1) AS promedio_min,
       ROUND(MAX(promedio), 1) AS promedio_max,
       MIN(asistencia) AS asistencia_min,
       MAX(asistencia) AS asistencia_max
FROM clasificado
GROUP BY banda
ORDER BY banda;

\echo ''
\echo '=============================================================='
\echo '  Base lista. Contrasena de todas las cuentas: Shalom2026'
\echo ''
\echo '    control01 / control02 / control03      -> control'
\echo '    gerencia01 / gerencia02               -> gerencia'
\echo '    apoder01 … apoder04                   -> apoderado'
\echo '    maestro01 … maestro32                 -> profesor'
\echo '    est0001 … est0205                     -> estudiante'
\echo '=============================================================='
\echo ''
\echo '  Falta levantar Redis y MinIO: sin Redis las sesiones y el bus de'
\echo '  notificaciones no funcionan, y sin MinIO no hay archivos.'
\echo ''