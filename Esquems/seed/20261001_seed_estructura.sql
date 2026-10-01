-- =============================================================================
-- DATOS DE PRUEBA · parte 1: estructura (roles, materias, cursos, materias por
-- grado, maya curricular, aulas, periodo, cursos del periodo).
--
-- Todas las tablas se siembran con `ON CONFLICT DO NOTHING` / `DO UPDATE`, así
-- que el archivo se puede volver a ejecutar sin duplicar nada ni romper el que
-- ya estaba.
--
-- Contraseña de TODAS las cuentas sembradas: Shalom2026
-- (hash bcrypt de 12 rondas, el mismo formato que genera ServiceUser)
--
-- Aplicar con:  psql -d ShalomDB -f Esquems/seed/20261001_seed_estructura.sql
-- =============================================================================

BEGIN;

-- ── Roles ────────────────────────────────────────────────────────────────────
-- Los ids se fijan a propósito: el resto del seed (y las consultas de ejemplo
-- en la parte 2) los usan como constante. Gerencia queda en 10 y no en 5 para
-- dejar libre el rango 5-8.
INSERT INTO "roles" ("id", "rol", "descripcion", "activo") VALUES
  (1,  'director',     'Dirección General',          true),
  (2,  'profesor',     'Personal docente',           true),
  (3,  'estudiante',   'Estudiante',                 true),
  (4,  'control',      'Control / Administración',   true),
  (9,  'apoderado',    'Apoderado / Tutor',          true),
  (10, 'gerencia',     'Gerencia',                   true)
ON CONFLICT ("id") DO UPDATE
  SET "descripcion" = EXCLUDED."descripcion", "activo" = true;

SELECT setval(pg_get_serial_sequence('roles', 'id'), 10, true);

-- ── Materias ─────────────────────────────────────────────────────────────────
-- `peso_sintactico` y `carga_horaria_semanal` no son decorativos: el generador
-- de horarios y el de plan de pagos los leen.
INSERT INTO "materias"
  ("id", "codigo", "nombre", "descripcion", "tipo_materia", "carga_horaria_semanal", "peso_sintactico", "materia_pesada", "activo")
VALUES
  (1,  'LEN-101', 'Comunicación y Lenguaje (Castellana)',        'Lengua materna, lectura y escritura.',        'principal',       6, 5, false, true),
  (2,  'LIG-102', 'Lengua Originaria',                           'Lengua originaria de la comunidad.',           'principal',       3, 2, false, true),
  (3,  'LEX-103', 'Lengua Extranjera (Inglés)',                   'Inglés como segunda lengua.',                   'principal',       3, 2, false, true),
  (4,  'CSO-104', 'Ciencias Sociales',                           'Historia, geografía y ciudadanía.',            'principal',       3, 2, false, true),
  (5,  'EFI-105', 'Educación Física y Deportes',                 'Desarrollo corporal y deporte.',               'principal',       2, 1, false, true),
  (6,  'MUS-106', 'Educación Musical',                            'Expresión musical y expresión corporal.',                    'extracurricular', 2, 1, false, true),
  (7,  'ART-107', 'Artes Plásticas y Visuales',                  'Dibujo, pintura y artesanía.',                  'extracurricular', 2, 1, false, true),
  (8,  'VER-201', 'Valores, Espiritualidades y Religiones',       'Formación integral y espiritualidad.',          'principal',       2, 2, false, true),
  (9,  'FIL-202', 'Cosmovisiones, Filosofía y Psicología',       'Reflexión filosófica y psicológica.',           'principal',       3, 2, false, true),
  (10, 'CNT-301', 'Ciencias Naturales',                          'Introducción a las ciencias experimentales.',   'principal',       4, 4, true,  true),
  (11, 'BIO-302', 'Biología - Geografía',                         'Vida, ecosistema y territorio.',                'principal',       5, 4, true,  true),
  (12, 'FIS-303', 'Física',                                      'Movimiento, energía y fuerzas.',                'principal',       4, 4, true,  true),
  (13, 'QUI-304', 'Química',                                     'Materia y sus transformaciones.',               'principal',       4, 4, true,  true),
  (14, 'MAT-401', 'Matemática',                                  'Álgebra, geometría y estadística.',              'principal',       6, 5, true,  true),
  (15, 'TTG-402', 'Técnica Tecnológica General',                  'Taller de oficios y tecnología aplicada.',      'principal',       3, 3, true,  true),
  (16, 'TTE-403', 'Técnica Tecnológica Especializada / Robótica',     'Especialización técnica del último ciclo.',     'principal',       4, 3, true,  true)
ON CONFLICT ("id") DO UPDATE SET
  "codigo"               = EXCLUDED."codigo",
  "nombre"               = EXCLUDED."nombre",
  "descripcion"          = EXCLUDED."descripcion",
  "tipo_materia"         = EXCLUDED."tipo_materia",
  "carga_horaria_semanal"= EXCLUDED."carga_horaria_semanal",
  "peso_sintactico"      = EXCLUDED."peso_sintactico",
  "materia_pesada"       = EXCLUDED."materia_pesada",
  "activo"               = true;

SELECT setval(pg_get_serial_sequence('materias', 'id'), 16, true);

-- ── Cursos base ──────────────────────────────────────────────────────────────
-- Los paralelos siguen siendo filas propias porque horarios, inscripciones y
-- asignaciones docentes sí son por paralelo; lo que se comparte por grado es
-- la materia y la maya curricular.
INSERT INTO "cursos" ("id", "nivel", "grado", "paralelo", "capacidad_maxima", "activo") VALUES
  (15, 'primaria',   '1°', 'A', 30, true), (16, 'primaria',   '1°', 'B', 25, true),
  (17, 'primaria',   '2°', 'A', 30, true), (18, 'primaria',   '2°', 'B', 25, true),
  (19, 'primaria',   '3°', 'A', 30, true), (20, 'primaria',   '3°', 'B', 25, true),
  (21, 'primaria',   '4°', 'A', 30, true), (22, 'primaria',   '4°', 'B', 25, true),
  (23, 'primaria',   '5°', 'A', 30, true), (24, 'primaria',   '5°', 'B', 25, true),
  (25, 'primaria',   '6°', 'A', 30, true), (26, 'primaria',   '6°', 'B', 25, true),
  (27, 'secundaria', '1°', 'A', 25, true), (28, 'secundaria', '1°', 'B', 25, true),
  (29, 'secundaria', '2°', 'A', 30, true), (30, 'secundaria', '2°', 'B', 25, true),
  (31, 'secundaria', '3°', 'A', 30, true), (32, 'secundaria', '3°', 'B', 25, true),
  (33, 'secundaria', '4°', 'A', 30, true), (34, 'secundaria', '4°', 'B', 25, true),
  (35, 'secundaria', '5°', 'A', 30, true), (36, 'secundaria', '5°', 'B', 25, true),
  (37, 'secundaria', '6°', 'A', 30, true), (38, 'secundaria', '6°', 'B', 25, true)
ON CONFLICT ("id") DO UPDATE SET
  "capacidad_maxima" = EXCLUDED."capacidad_maxima", "activo" = true;

SELECT setval(pg_get_serial_sequence('cursos', 'id'), 38, true);

-- ── Materias por GRADO ───────────────────────────────────────────────────────
-- 1°A y 1°B comparten estas listas. La primaria carga los siete campos base;
-- en secundaria las ciencias se abren según el grado y los dos últimos ciclos
-- incorporan la técnica tecnológica.
WITH grados(nivel, grado) AS (
  VALUES ('primaria','1°'), ('primaria','2°'), ('primaria','3°'),
         ('primaria','4°'), ('primaria','5°'), ('primaria','6°'),
         ('secundaria','1°'), ('secundaria','2°'), ('secundaria','3°'),
         ('secundaria','4°'), ('secundaria','5°'), ('secundaria','6°')
),
plan(nivel, grado, codigo, orden) AS (
  -- Primaria: los mismos siete campos base en los seis grados.
  SELECT 'primaria', g.grado, v.codigo, v.orden
  FROM grados g
  CROSS JOIN (VALUES
    ('LEN-101',1), ('LIG-102',2), ('LEX-103',3), ('CSO-104',4),
    ('EFI-105',5), ('MUS-106',6), ('ART-107',7)
  ) AS v(codigo, orden)
  WHERE g.nivel = 'primaria'

  UNION ALL SELECT nivel, grado, codigo, orden FROM (VALUES
  ('secundaria','1°','LEN-101',1),
  ('secundaria','1°','CSO-104',2),
  ('secundaria','1°','MAT-401',3),
  ('secundaria','1°','BIO-302',4),
  ('secundaria','1°','CNT-301',5),
  ('secundaria','1°','FIS-303',6),
  ('secundaria','1°','QUI-304',7),
  ('secundaria','1°','LEX-103',8),
  ('secundaria','1°','LIG-102',9),
  ('secundaria','1°','VER-201',10),
  ('secundaria','1°','ART-107',11),

  ('secundaria','2°','LEN-101',1),
  ('secundaria','2°','MAT-401',2),
  ('secundaria','2°','BIO-302',3),
  ('secundaria','2°','FIS-303',4),
  ('secundaria','2°','QUI-304',5),
  ('secundaria','2°','CNT-301',6),
  ('secundaria','2°','CSO-104',7),
  ('secundaria','2°','LIG-102',8),
  ('secundaria','2°','LEX-103',9),
  ('secundaria','2°','FIL-202',10),
  ('secundaria','2°','VER-201',11),
  ('secundaria','2°','MUS-106',12),
  ('secundaria','2°','ART-107',13),
  ('secundaria','2°','TTG-402',14),

  ('secundaria','3°','LEN-101',1),
  ('secundaria','3°','MAT-401',2),
  ('secundaria','3°','BIO-302',3),
  ('secundaria','3°','FIS-303',4),
  ('secundaria','3°','CNT-301',5),
  ('secundaria','3°','CSO-104',6),
  ('secundaria','3°','LIG-102',7),
  ('secundaria','3°','LEX-103',8),
  ('secundaria','3°','FIL-202',9),
  ('secundaria','3°','VER-201',10),
  ('secundaria','3°','MUS-106',11),
  ('secundaria','3°','ART-107',12),
  ('secundaria','3°','TTG-402',13),

  ('secundaria','4°','LEN-101',1),
  ('secundaria','4°','MAT-401',2),
  ('secundaria','4°','BIO-302',3),
  ('secundaria','4°','FIS-303',4),
  ('secundaria','4°','QUI-304',5),
  ('secundaria','4°','CNT-301',6),
  ('secundaria','4°','CSO-104',7),
  ('secundaria','4°','LIG-102',8),
  ('secundaria','4°','LEX-103',9),
  ('secundaria','4°','FIL-202',10),
  ('secundaria','4°','VER-201',11),
  ('secundaria','4°','ART-107',12),
  ('secundaria','4°','TTG-402',13),

  ('secundaria','5°','LEN-101',1),
  ('secundaria','5°','MAT-401',2),
  ('secundaria','5°','BIO-302',3),
  ('secundaria','5°','QUI-304',4),
  ('secundaria','5°','FIS-303',5),
  ('secundaria','5°','CNT-301',6),
  ('secundaria','5°','CSO-104',7),
  ('secundaria','5°','LIG-102',8),
  ('secundaria','5°','LEX-103',9),
  ('secundaria','5°','FIL-202',10),
  ('secundaria','5°','VER-201',11),
  ('secundaria','5°','MUS-106',12),
  ('secundaria','5°','TTG-402',13),

  ('secundaria','6°','LEN-101',1),
  ('secundaria','6°','MAT-401',2),
  ('secundaria','6°','BIO-302',3),
  ('secundaria','6°','FIS-303',4),
  ('secundaria','6°','QUI-304',5),
  ('secundaria','6°','CSO-104',6),
  ('secundaria','6°','LIG-102',7),
  ('secundaria','6°','LEX-103',8),
  ('secundaria','6°','FIL-202',9),
  ('secundaria','6°','VER-201',10),
  ('secundaria','6°','ART-107',11),
  ('secundaria','6°','TTG-402',12),
  ('secundaria','6°','TTE-403',13)
  ) AS s(nivel, grado, codigo, orden)
)
INSERT INTO "grado_materias"
  ("nivel", "grado", "materia_id", "tipo_materia", "carga_horaria_semanal", "orden")
SELECT g.nivel, g.grado, m.id, m.tipo_materia, m.carga_horaria_semanal, p.orden
FROM grados g
JOIN plan p ON p.nivel = g.nivel AND (p.grado = g.grado OR p.grado IS NULL)
JOIN "materias" m ON m.codigo = p.codigo
ON CONFLICT ("nivel", "grado", "materia_id") DO UPDATE SET
  "orden" = EXCLUDED."orden",
  "carga_horaria_semanal" = EXCLUDED."carga_horaria_semanal";

-- ── Maya curricular: temas del 1° de secundaria ─────────────────────────────
-- Es el contenido de la materia y se reutiliza en todas las gestión. Se deja
-- un temario de tres unidades por materia; el resto de grados arranca vacío a
-- propósito, para probar el flujo de carga desde la interfaz.
WITH temas(nivel, grado, codigo, unidad, titulo, contenidos, horas, es_eval) AS (
  VALUES
  ('secundaria','1°','LEN-101',1,'Narrativa y lectura crítica','Del relato al ensayo: personajes y trama.',6,false),
  ('secundaria','1°','LEN-101',2,'Escritura argumentativa','Tesis, pruebas y citación de fuentes.',6,false),
  ('secundaria','1°','LEN-101',3,'Evaluación de unidad','Examen parcial de comunicación.',2,true),
  ('secundaria','1°','CSO-104',1,'Familia y comunidad','Estructura familiar y roles comunitarios.',4,false),
  ('secundaria','1°','CSO-104',2,'Pueblos y ciudades','Población, urbanismo y citizenship.',4,false),
  ('secundaria','1°','CSO-104',3,'Evaluación de unidad','Examen parcial de ciencias sociales.',2,true),
  ('secundaria','1°','MAT-401',1,'Números naturales y enteros','Operaciones, divisibilidad y potenciación.',8,false),
  ('secundaria','1°','MAT-401',2,'Fracciones y proporcionalidad','Operaciones con fracciones y razones.',8,false),
  ('secundaria','1°','MAT-401',3,'Evaluación de unidad','Examen parcial de matemática.',2,true),
  ('secundaria','1°','BIO-302',1,'La célula y la vida','Nivel celular, tejidos y sistemas.',6,false),
  ('secundaria','1°','BIO-302',2,'Ecosistemas y ambiente','Cadenas alimentarías y equilibrio ambiental.',6,false),
  ('secundaria','1°','BIO-302',3,'Evaluación de unidad','Examen parcial de biología.',2,true),
  ('secundaria','1°','FIS-303',1,'Medida y magnitudes','Unidades, errores y notación científica.',4,false),
  ('secundaria','1°','FIS-303',2,'Movimiento y fuerzas','Velocidad, aceleración y diagramas de cuerpo libre.',6,false),
  ('secundaria','1°','FIS-303',3,'Evaluación de unidad','Examen parcial de física.',2,true),
  ('secundaria','1°','QUI-304',1,'Estructura de la materia','Átomos, enlaces y tabla periódica.',4,false),
  ('secundaria','1°','QUI-304',2,'Reacciones químicas','Balanceo y tipos de reacción.',6,false),
  ('secundaria','1°','QUI-304',3,'Evaluación de unidad','Examen parcial de química.',2,true),
  ('secundaria','1°','CNT-301',1,'Ciencia y método','Observación, hipótesis y experimentación.',3,false),
  ('secundaria','1°','CNT-301',2,'Evaluación de unidad','Trabajo de investigación.',2,true),
  ('secundaria','1°','CNT-301',3,'Cierre de unidad','Sustentación del trabajo.',1,true),
  ('secundaria','1°','LEX-103',1,'Everyday English','Greetings, pronouns and the present simple.',4,false),
  ('secundaria','1°','LEX-103',2,'Reading and telling stories','Reading comprehension and narrative tenses.',4,false),
  ('secundaria','1°','LEX-103',3,'Evaluation','Unit exam.',2,true),
  ('secundaria','1°','LIG-102',1,'La comunicación','Prácticas ancestrales de comunicación.',4,false),
  ('secundaria','1°','LIG-102',2,'Evaluación','Examen parcial de lengua originaria.',2,true),
  ('secundaria','1°','VER-201',1,'La persona y sus valores','Identidad, valores y respeto.',3,false),
  ('secundaria','1°','VER-201',2,'Evaluación','Reflexión escrita.',1,true),
  ('secundaria','1°','ART-107',1,'Lenguaje visual','Línea, forma, color y composición.',3,false),
  ('secundaria','1°','ART-107',2,'Evaluación','Exposición de obras.',1,true)
)
INSERT INTO "malla_temas"
  ("nivel", "grado", "materia_id", "unidad", "titulo", "contenidos", "horas_previstas", "es_evaluacion", "orden")
SELECT t.nivel, t.grado, m.id, t.unidad, t.titulo, t.contenidos, t.horas, t.es_eval, t.unidad
FROM temas t
JOIN "materias" m ON m.codigo = t.codigo
ON CONFLICT ("nivel", "grado", "materia_id", "unidad") DO UPDATE SET
  "titulo" = EXCLUDED."titulo",
  "contenidos" = EXCLUDED."contenidos",
  "horas_previstas" = EXCLUDED."horas_previstas",
  "es_evaluacion" = EXCLUDED."es_evaluacion";

-- ── Aulas ────────────────────────────────────────────────────────────────────
INSERT INTO "aulas" ("codigo", "nombre", "capacidad", "activa") VALUES
  ('A-101', 'Aula 101', 30, true),
  ('A-102', 'Aula 102', 30, true),
  ('A-103', 'Aula 103', 30, true),
  ('A-104', 'Aula 104', 25, true),
  ('A-201', 'Aula 201', 30, true),
  ('A-202', 'Aula 202', 30, true),
  ('LAB-1', 'Laboratorio de ciencias', 25, true),
  ('TALL-1','Taller de tecnología', 20, true),
  ('AUD-1', 'Auditorio', 120, true)
ON CONFLICT ("codigo") DO UPDATE SET
  "nombre" = EXCLUDED."nombre", "capacidad" = EXCLUDED."capacidad", "activa" = true;

-- ── Periodo académico 2026 ──────────────────────────────────────────────────
-- No se fuerza el id: si ya hay un periodo activo (se lo ve al repetir el seed
-- sobre una base en uso) se lo reutiliza tal cual. `uq_periodo_activo` permite
-- un único `activo = true`, así que antes hay que soltar el de otros años.
-- Sobrevive al COMMIT porque la parte 2 lo vuelve a necesitar.
DROP TABLE IF EXISTS tmp_periodo;
CREATE TEMP TABLE tmp_periodo (
  id bigint PRIMARY KEY
) ON COMMIT PRESERVE ROWS;

INSERT INTO tmp_periodo (id)
SELECT "id" FROM "periodos_academicos"
WHERE "activo" AND "anio" = 2026
ORDER BY "id" LIMIT 1;

-- Otros años pasan a inactivos para liberar el índice parcial.
UPDATE "periodos_academicos" SET "activo" = false
WHERE "activo" AND ("anio" <> 2026 OR "id" <> COALESCE((SELECT "id" FROM tmp_periodo), -1));

INSERT INTO "periodos_academicos"
  ("anio", "nombre", "fecha_inicio", "fecha_fin", "inicio_gestion", "fin_gestion",
   "estado", "estructura_generada", "horarios_generados", "plan_pagos_generado",
   "activado_at", "activo")
SELECT 2026, 'Gestión 2026', '2026-02-02', '2026-12-18', '2026-02-02', '2026-12-18',
       'activo', true, false, false, NOW(), true
WHERE NOT EXISTS (SELECT 1 FROM tmp_periodo);

-- Si se acaba de crear, el id es el último; si ya existía, tmp_periodo lo tiene.
INSERT INTO tmp_periodo (id)
SELECT "id" FROM "periodos_academicos"
WHERE "activo" AND "anio" = 2026
  AND NOT EXISTS (SELECT 1 FROM tmp_periodo)
ORDER BY "id" LIMIT 1;

-- Trimestres. El módulo de seguimiento toma el que esté vigente; con
-- SEG_TRIMESTRE_ACTUAL=1 hay que sembrar el trimestre 1 con actividad.
INSERT INTO "trimestres" ("periodo_id", "numero", "inicio", "fin")
SELECT (SELECT "id" FROM tmp_periodo), v.numero, v.inicio::date, v.fin::date
FROM (VALUES
  (1, '2026-02-02', '2026-05-15'),
  (2, '2026-05-18', '2026-09-04'),
  (3, '2026-09-07', '2026-12-18')
) AS v(numero, inicio, fin)
ON CONFLICT ("periodo_id", "numero") DO UPDATE SET
  "inicio" = EXCLUDED."inicio", "fin" = EXCLUDED."fin";

-- ── Cursos del periodo ───────────────────────────────────────────────────────
-- Se crea uno por cada curso base, así el panel de aulas e inscripciones tiene
-- los 24 paralelos. La tabla `cursos_periodo` es la que usan las inscripciones,
-- las asignaciones docentes y el módulo de seguimiento.
INSERT INTO "cursos_periodo" ("curso_id", "periodo_id", "capacidad_maxima", "turno_id", "estado")
SELECT c."id", p."id", c."capacidad_maxima",
       CASE WHEN c."nivel" = 'secundaria' THEN t."id" ELSE tm."id" END,
       'activo'
FROM "cursos" c
CROSS JOIN tmp_periodo p
CROSS JOIN (SELECT "id" FROM "turnos" WHERE "codigo" = 'manana') tm
CROSS JOIN (SELECT "id" FROM "turnos" WHERE "codigo" = 'tarde') t
WHERE c."activo"
ON CONFLICT ("curso_id", "periodo_id") DO UPDATE SET
  "capacidad_maxima" = EXCLUDED."capacidad_maxima", "estado" = 'activo';

-- ── Malla curricular del periodo ─────────────────────────────────────────────
-- A partir de las materias del grado. Esta tabla responde "qué materia existe
-- en ESTA gestión"; el temario vive en `malla_temas`.
INSERT INTO "mallas_curriculares"
  ("periodo_id", "nivel", "grado", "materia_id", "tipo_materia", "carga_horaria_semanal", "peso_sintactico", "activo")
SELECT p."id", gm."nivel", gm."grado", gm."materia_id", gm."tipo_materia",
       gm."carga_horaria_semanal", m."peso_sintactico", true
FROM "grado_materias" gm
JOIN "materias" m ON m."id" = gm."materia_id"
CROSS JOIN tmp_periodo p
WHERE m."activo"
ON CONFLICT ("periodo_id", "nivel", "grado", "materia_id") DO UPDATE SET
  "carga_horaria_semanal" = EXCLUDED."carga_horaria_semanal",
  "peso_sintactico"      = EXCLUDED."peso_sintactico",
  "activo"               = true;

COMMIT;

-- ── Verificación rápida ──────────────────────────────────────────────────────
SELECT 'roles'      AS entidad, COUNT(*) AS total FROM "roles"
UNION ALL SELECT 'materias',             COUNT(*) FROM "materias"
UNION ALL SELECT 'cursos',               COUNT(*) FROM "cursos"
UNION ALL SELECT 'grado_materias',       COUNT(*) FROM "grado_materias"
UNION ALL SELECT 'malla_temas',          COUNT(*) FROM "malla_temas"
UNION ALL SELECT 'aulas',                COUNT(*) FROM "aulas"
UNION ALL SELECT 'trimestres',           COUNT(*) FROM "trimestres"
UNION ALL SELECT 'cursos_periodo',       COUNT(*) FROM "cursos_periodo"
UNION ALL SELECT 'mallas_curriculares',  COUNT(*) FROM "mallas_curriculares"
ORDER BY 1;