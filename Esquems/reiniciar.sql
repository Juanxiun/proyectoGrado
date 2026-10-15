

\set ON_ERROR_STOP on
\echo ''
\echo '=============================================================='
\echo '  Reinicio total de la base. Se borra todo lo que haya ahora.'
\echo '=============================================================='
\echo ''


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

\echo '  -> cargando esquema (BDmain.sql)'
\echo ''
\ir BDmain.sql
\echo ''
\echo '  -> esquema listo'
\echo ''

\echo '  -> cargando datos de prueba (datos.sql)'
\echo ''
\ir datos.sql
\echo ''
\echo '  -> datos listos'
\echo ''

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
UNION ALL SELECT 'encargo_entregas',       COUNT(*) FROM "encargo_entregas"
UNION ALL SELECT 'horarios',               COUNT(*) FROM "horarios"
UNION ALL SELECT 'solicitudes',            COUNT(*) FROM "solicitudes_inscripcion"
UNION ALL SELECT 'calificaciones',        COUNT(*) FROM "calificaciones"
UNION ALL SELECT 'asistencia',            COUNT(*) FROM "asistencia"
UNION ALL SELECT 'planes_pago',           COUNT(*) FROM "planes_pago"
UNION ALL SELECT 'cuotas_plan',           COUNT(*) FROM "cuotas_plan_pago"
UNION ALL SELECT 'pagos',                 COUNT(*) FROM "pagos"
UNION ALL SELECT 'pago_pensiones',        COUNT(*) FROM "pago_pensiones"
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

WITH notas AS (
  SELECT cal."estudiante_id",
         SUM(cal."nota" * e."ponderacion") / NULLIF(SUM(e."ponderacion"), 0) AS promedio
  FROM "calificaciones" cal
  JOIN "encargos" e            ON e."id" = cal."encargo_id"
  JOIN "asignaciones_docentes" ad ON ad."id" = e."asignacion_id"
  JOIN "cursos_periodo" cp     ON cp."id" = ad."curso_periodo_id"
  JOIN "trimestres" t          ON t."periodo_id" = cp."periodo_id" AND t."numero" = 1
  WHERE e."estado" IN ('publicado', 'cerrado')
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
\echo '    director01 / director02                  -> director'
\echo '    control01 / control02 / control03      -> control'
\echo '    gerencia01 / gerencia02               -> gerencia'
\echo '    apoder01 … apoder12                   -> apoderado'
\echo '    maestro01 … maestro32                 -> profesor'
\echo '    est0001 … est0480                     -> estudiante (inscrito)'
\echo '    est0481 … est0484                     -> estudiante (reserva pendiente)'
\echo '=============================================================='
\echo ''
\echo '  Falta levantar Redis y MinIO: sin Redis las sesiones y el bus de'
\echo '  notificaciones no funcionan, y sin MinIO no hay archivos.'
\echo ''