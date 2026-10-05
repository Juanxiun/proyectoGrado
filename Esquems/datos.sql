BEGIN;

-- Roles
INSERT INTO "roles" ("id", "rol", "descripcion", "activo") VALUES
  (1,  'director',     'Dirección General',          true),
  (2,  'profesor',     'Personal docente',           true),
  (3,  'estudiante',   'Estudiante',                 true),
  (4,  'control',      'Control / Administración',   true),
  (9,  'apoderado',    'Apoderado / Tutor',          true),
  (10, 'gerencia',     'Gerencia',                   true)
ON CONFLICT ("id") DO UPDATE
  SET "descripcion" = EXCLUDED."descripcion", "activo" = true;

SELECT setval(pg_get_serial_sequence('roles', 'id'), GREATEST(10, (SELECT MAX(id) FROM "roles")), true);

-- Turnos
INSERT INTO "turnos" ("codigo", "nombre", "hora_inicio", "hora_fin", "receso_inicio", "receso_fin", "duracion_periodo_minutos", "activo")
VALUES
  ('manana', 'Turno Mañana', '07:00', '12:30', '09:30', '10:00', 45, true),
  ('tarde',  'Turno Tarde',  '14:00', '18:30', '16:00', '16:30', 45, true)
ON CONFLICT ("codigo") DO UPDATE SET
  "nombre" = EXCLUDED."nombre",
  "hora_inicio" = EXCLUDED."hora_inicio",
  "hora_fin" = EXCLUDED."hora_fin",
  "receso_inicio" = EXCLUDED."receso_inicio",
  "receso_fin" = EXCLUDED."receso_fin",
  "duracion_periodo_minutos" = EXCLUDED."duracion_periodo_minutos",
  "activo" = true;

-- Aulas
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
  "nombre" = EXCLUDED."nombre",
  "capacidad" = EXCLUDED."capacidad",
  "activa" = true;

-- Materias
INSERT INTO "materias"
  ("id", "codigo", "nombre", "descripcion", "tipo_materia", "carga_horaria_semanal", "peso_sintactico", "materia_pesada", "activo")
VALUES
  (1,  'LEN-101', 'Comunicación y Lenguaje (Castellana)',        'Lengua materna, lectura y escritura.',        'principal',       6, 5, false, true),
  (2,  'LIG-102', 'Lengua Originaria',                           'Lengua originaria de la comunidad.',           'principal',       3, 2, false, true),
  (3,  'LEX-103', 'Lengua Extranjera (Inglés)',                   'Inglés como segunda lengua.',                   'principal',       3, 2, false, true),
  (4,  'CSO-104', 'Ciencias Sociales',                           'Historia, geografía y ciudadanía.',            'principal',       3, 2, false, true),
  (5,  'EFI-105', 'Educación Física y Deportes',                 'Desarrollo corporal y deporte.',               'principal',       2, 1, false, true),
  (6,  'MUS-106', 'Educación Musical',                            'Expresión musical y expresión corporal.',     'extracurricular', 2, 1, false, true),
  (7,  'ART-107', 'Artes Plásticas y Visuales',                  'Dibujo, pintura y artesanía.',                  'extracurricular', 2, 1, false, true),
  (8,  'VER-201', 'Valores, Espiritualidades y Religiones',       'Formación integral y espiritualidad.',          'principal',       2, 2, false, true),
  (9,  'FIL-202', 'Cosmovisiones, Filosofía y Psicología',       'Reflexión filosófica y psicológica.',           'principal',       3, 2, false, true),
  (10, 'CNT-301', 'Ciencias Naturales',                          'Introducción a las ciencias experimentales.',   'principal',       4, 4, true,  true),
  (11, 'BIO-302', 'Biología - Geografía',                         'Vida, ecosistema y territorio.',                'principal',       5, 4, true,  true),
  (12, 'FIS-303', 'Física',                                      'Movimiento, energía y fuerzas.',                'principal',       4, 4, true,  true),
  (13, 'QUI-304', 'Química',                                     'Materia y sus transformaciones.',               'principal',       4, 4, true,  true),
  (14, 'MAT-401', 'Matemática',                                  'Álgebra, geometría y estadística.',              'principal',       6, 5, true,  true),
  (15, 'TTG-402', 'Técnica Tecnológica General',                  'Taller de oficios y tecnología aplicada.',      'principal',       3, 3, true,  true),
  (16, 'TTE-403', 'Técnica Tecnológica Especializada / Robótica', 'Especialización técnica del último ciclo.',     'principal',       4, 3, true,  true)
ON CONFLICT ("id") DO UPDATE SET
  "codigo"                = EXCLUDED."codigo",
  "nombre"                = EXCLUDED."nombre",
  "descripcion"           = EXCLUDED."descripcion",
  "tipo_materia"          = EXCLUDED."tipo_materia",
  "carga_horaria_semanal" = EXCLUDED."carga_horaria_semanal",
  "peso_sintactico"       = EXCLUDED."peso_sintactico",
  "materia_pesada"        = EXCLUDED."materia_pesada",
  "activo"                = true;

SELECT setval(pg_get_serial_sequence('materias', 'id'), GREATEST(16, (SELECT MAX(id) FROM "materias")), true);

-- Cursos base
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
  "capacidad_maxima" = EXCLUDED."capacidad_maxima",
  "activo" = true;

SELECT setval(pg_get_serial_sequence('cursos', 'id'), GREATEST(38, (SELECT MAX(id) FROM "cursos")), true);

-- Materias por grado
WITH grados(nivel, grado) AS (
  VALUES ('primaria','1°'), ('primaria','2°'), ('primaria','3°'),
         ('primaria','4°'), ('primaria','5°'), ('primaria','6°'),
         ('secundaria','1°'), ('secundaria','2°'), ('secundaria','3°'),
         ('secundaria','4°'), ('secundaria','5°'), ('secundaria','6°')
),
plan(nivel, grado, codigo, orden) AS (
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

-- Temas de malla curricular
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

-- Gestión académica 2026
DROP TABLE IF EXISTS tmp_periodo;
CREATE TEMP TABLE tmp_periodo (
  id bigint PRIMARY KEY
) ON COMMIT PRESERVE ROWS;

INSERT INTO tmp_periodo (id)
SELECT "id" FROM "periodos_academicos"
WHERE "activo" AND "anio" = 2026
ORDER BY "id" LIMIT 1;

UPDATE "periodos_academicos" SET "activo" = false
WHERE "activo" AND ("anio" <> 2026 OR "id" <> COALESCE((SELECT "id" FROM tmp_periodo), -1));

INSERT INTO "periodos_academicos"
  ("anio", "nombre", "fecha_inicio", "fecha_fin", "inicio_gestion", "fin_gestion",
   "estado", "estructura_generada", "horarios_generados", "plan_pagos_generado",
   "activado_at", "activo")
SELECT 2026, 'Gestión 2026', '2026-02-02', '2026-12-18', '2026-02-02', '2026-12-18',
       'activo', true, false, false, NOW(), true
WHERE NOT EXISTS (SELECT 1 FROM tmp_periodo);

INSERT INTO tmp_periodo (id)
SELECT "id" FROM "periodos_academicos"
WHERE "activo" AND "anio" = 2026
  AND NOT EXISTS (SELECT 1 FROM tmp_periodo)
ORDER BY "id" LIMIT 1;

-- Trimestres 2026
INSERT INTO "trimestres" ("periodo_id", "numero", "inicio", "fin")
SELECT (SELECT "id" FROM tmp_periodo), v.numero, v.inicio::date, v.fin::date
FROM (VALUES
  (1, '2026-02-02', '2026-05-15'),
  (2, '2026-05-18', '2026-09-04'),
  (3, '2026-09-07', '2026-12-18')
) AS v(numero, inicio, fin)
ON CONFLICT ("periodo_id", "numero") DO UPDATE SET
  "inicio" = EXCLUDED."inicio", "fin" = EXCLUDED."fin";

-- Cursos del período
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

-- Malla curricular del período
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
  "peso_sintactico"       = EXCLUDED."peso_sintactico",
  "activo"                = true;

-- Cuentas de usuarios
CREATE TEMP TABLE tmp_cuentas (
  username            text PRIMARY KEY,
  rol_id              bigint NOT NULL,
  nombre              text   NOT NULL,
  apellido_paterno    text   NOT NULL,
  apellido_materno    text   NOT NULL,
  nacimiento          date   NOT NULL,
  genero              text   NOT NULL,
  especialidad        text
) ON COMMIT DROP;

-- Control, Gerencia y Apoderados
INSERT INTO tmp_cuentas (username, rol_id, nombre, apellido_paterno, apellido_materno, nacimiento, genero, especialidad) VALUES
  ('control01',  4, 'Elena',    'Ribera',     'Ortiz',    DATE '1988-03-14', 'femenino',  NULL),
  ('control02',  4, 'Marcelo',  'Quiroga',    'Céspedes', DATE '1990-07-22', 'masculino', NULL),
  ('control03',  4, 'Silvana',  'Ayoví',      'Terceros', DATE '1992-11-05', 'femenino',  NULL),
  ('gerencia01', 10, 'Rodrigo',  'Sanzetenea', 'Vargas',   DATE '1985-05-30', 'masculino', NULL),
  ('gerencia02', 10, 'Patricia', 'Mendoza',    'Loayza',   DATE '1987-09-18', 'femenino',  NULL),
  ('apoder01',    9, 'Jorge',    'Chumacero',  'Nina',     DATE '1983-01-25', 'masculino', NULL),
  ('apoder02',    9, 'Lourdes',  'Poma',       'Choque',   DATE '1986-04-11', 'femenino',  NULL),
  ('apoder03',    9, 'Wilson',   'Apaza',      'Mamani',   DATE '1984-12-02', 'masculino', NULL),
  ('apoder04',    9, 'Yeni',     'Condori',    'Rojas',    DATE '1989-08-19', 'femenino',  NULL);

-- Docentes
INSERT INTO tmp_cuentas (username, rol_id, nombre, apellido_paterno, apellido_materno, nacimiento, genero, especialidad) VALUES
  ('maestro01', 2, 'Claudia',  'Apaza',       'Lozano',       DATE '1988-06-12', 'femenino',  'LEN-101'),
  ('maestro02', 2, 'Ramiro',   'Choque',      'Salvatierra',  DATE '1984-10-03', 'masculino', 'LEN-101'),
  ('maestro03', 2, 'Nina',     'Callisaya',   'Huanca',       DATE '1990-02-27', 'femenino',  'LIG-102'),
  ('maestro04', 2, 'Felix',    'Mamani',      'Quispe',       DATE '1986-11-19', 'masculino', 'LIG-102'),
  ('maestro05', 2, 'Veronica', 'Aliaga',      'Zeballos',     DATE '1991-07-08', 'femenino',  'LEX-103'),
  ('maestro06', 2, 'Ivan',     'Pinedo',      'Rojas',        DATE '1985-09-23', 'masculino', 'LEX-103'),
  ('maestro07', 2, 'Marisol',  'Ccahuana',    'Bustamante',   DATE '1989-12-01', 'femenino',  'CSO-104'),
  ('maestro08', 2, 'Oscar',    'Huayllani',   'Macedo',       DATE '1983-05-16', 'masculino', 'CSO-104'),
  ('maestro09', 2, 'Danilo',   'Chavez',      'Ordonez',      DATE '1992-03-30', 'masculino', 'EFI-105'),
  ('maestro10', 2, 'Karina',   'Flores',      'Vera',         DATE '1993-08-21', 'femenino',  'EFI-105'),
  ('maestro11', 2, 'Julio',    'Mamani',      'Cori',         DATE '1987-01-14', 'masculino', 'MUS-106'),
  ('maestro12', 2, 'Antonia',  'Condori',     'Mamani',       DATE '1988-06-25', 'femenino',  'MUS-106'),
  ('maestro13', 2, 'Renzo',    'Caceres',     'Daza',         DATE '1991-04-09', 'masculino', 'ART-107'),
  ('maestro14', 2, 'Camila',   'Zeballos',    'Aguilar',      DATE '1994-10-18', 'femenino',  'ART-107'),
  ('maestro15', 2, 'Guido',    'Tola',        'Mamani',       DATE '1986-11-11', 'masculino', 'VER-201'),
  ('maestro16', 2, 'Noelia',   'Machicado',   'Choque',       DATE '1990-02-02', 'femenino',  'VER-201'),
  ('maestro17', 2, 'Ariel',    'Villarroel',  'Calsina',      DATE '1989-09-05', 'masculino', 'FIL-202'),
  ('maestro18', 2, 'Sara',     'Choque',      'Mamani',       DATE '1993-01-22', 'femenino',  'FIL-202'),
  ('maestro19', 2, 'Bruno',    'Colque',      'Mamani',       DATE '1985-07-07', 'masculino', 'CNT-301'),
  ('maestro20', 2, 'Debora',   'Apaza',       'Soto',         DATE '1992-05-13', 'femenino',  'CNT-301'),
  ('maestro21', 2, 'Gabriel',  'Quisbert',    'Antezana',     DATE '1988-12-29', 'masculino', 'BIO-302'),
  ('maestro22', 2, 'Yolanda',  'Ponce',       'Callisaya',    DATE '1991-03-08', 'femenino',  'BIO-302'),
  ('maestro23', 2, 'Erick',    'Choque',      'Zambrano',     DATE '1990-10-24', 'masculino', 'FIS-303'),
  ('maestro24', 2, 'Melissa',  'Ordonez',     'Apaza',        DATE '1994-04-17', 'femenino',  'FIS-303'),
  ('maestro25', 2, 'Homero',   'Chuquimarca', 'Mamani',       DATE '1987-06-11', 'masculino', 'QUI-304'),
  ('maestro26', 2, 'Lucia',    'Bustamante',  'Cari',         DATE '1992-08-02', 'femenino',  'QUI-304'),
  ('maestro27', 2, 'Zenon',    'Apaza',       'Kallisaya',    DATE '1984-01-28', 'masculino', 'MAT-401'),
  ('maestro28', 2, 'Amalia',   'Ccahuana',    'Mamani',       DATE '1989-05-15', 'femenino',  'MAT-401'),
  ('maestro29', 2, 'Wilson',   'Titi',        'Calsina',      DATE '1991-07-07', 'masculino', 'TTG-402'),
  ('maestro30', 2, 'Natalia',  'Hinojosa',    'Apaza',        DATE '1993-11-26', 'femenino',  'TTG-402'),
  ('maestro31', 2, 'Alvaro',   'Quispe',      'Tola',         DATE '1986-02-26', 'masculino', 'TTE-403'),
  ('maestro32', 2, 'Fabiola',  'Mamani',      'Choque',       DATE '1994-09-19', 'femenino',  'TTE-403');

-- Estudiantes: 20 por cada uno de los 24 cursos
--
-- El reparto sigue el orden de `cursos.id`, as? los 20 de un aula son
-- consecutivos. 24 cursos ? 20 = 480 estudiantes.
--
-- La fecha de nacimiento sale del GRADO del curso de destino: un 1? de primaria
-- tiene ~10 a?os en 2026 y un 1? de secundaria ~14. Con una sola f?rmula por
-- ?ndice todos nacer?an el mismo a?o.
DROP TABLE IF EXISTS tmp_destino;
CREATE TEMP TABLE tmp_destino ON COMMIT DROP AS
WITH orden AS (
  SELECT c."id" AS curso_id, c."nivel", c."grado",
         row_number() OVER (ORDER BY c."id") AS pos
  FROM "cursos" c
  WHERE c."activo"
)
SELECT o.curso_id, o."nivel", o."grado", s.n,
       -- 1? de primaria ~10 a?os y 1? de secundaria ~14 en 2026.
       make_date(
         2026
           - CASE WHEN o."nivel" = 'secundaria'
                  THEN 13 + (regexp_match(o."grado", '\d+'))[1]::int
                  ELSE  9 + (regexp_match(o."grado", '\d+'))[1]::int
             END,
         3, 31
       ) + (((s.n * 7) % 300)::int) AS nacimiento
FROM orden o
CROSS JOIN LATERAL generate_series((o.pos - 1) * 20 + 1, o.pos * 20) AS s(n);

INSERT INTO tmp_cuentas (username, rol_id, nombre, apellido_paterno, apellido_materno, nacimiento, genero, especialidad)
SELECT
  'est' || lpad(d.n::text, 4, '0'),
  3,
  (ARRAY['Abigail','Bruno','Camila','Dante','Elena','Facundo',
         'Gabriela','Hector','Ines','Joaquin','Karla','Lorenzo',
         'Mariana','Nicolas','Olivia','Pablo','Renata','Santiago',
         'Tatiana','Ursula','Valentina','Wilder','Ximena','Yohan',
         'Zulma','Ariadna','Benjmin','Ciro','Dayana','Emilio'])[((d.n - 1) % 30) + 1],
  -- El segundo apellido avanza de a 30 en 30, as? nombre + paterno identifican
  -- al estudiante sin repetirse dentro de los 480.
  (ARRAY['Vega','Salcedo','Zubieta','Mogrovejo','Cumbicus','Arocena',
         'Ynchausti','Quispe','Palomeque','Chuquimarca','Choque','Apuaza',
         'Tintaya','Zaragoza','Mamani','Guarangay','Callisaya','Ccahuana',
         'Mamani','Quisbert','Apaza','Mamani','Ponce','Condori',
         'Choque','Tintaya','Huayllani','Villarroel','Apuza','Mayta'])[(((d.n - 1) / 30) % 30) + 1],
  (ARRAY['Roca','Paz','Aliaga','Lillo','Mamani','Chavez',
         'Copa','Mamani','Apaza','Vera','Ponce','Mayta',
         'Condori','Callo','Poma','Cori','Apaza','Callisaya',
         'Mamani','Antezana','Condori','Zeballos','Mamani','Tola',
         'Apaza','Zambrano','Callo','Mayta','Apuza','Mayta'])[((d.n * 13) % 30) + 1],
  d.nacimiento,
  CASE WHEN d.n % 2 = 0 THEN 'femenino' ELSE 'masculino' END,
  NULL
FROM tmp_destino d;

-- Inserción en usuarios
INSERT INTO "usuarios" ("rol_id", "nombre", "apellido_paterno", "apellido_materno", "nacimiento", "genero", "estado")
SELECT c.rol_id, c.nombre, c.apellido_paterno, c.apellido_materno, c.nacimiento, c.genero, 'activo'
FROM tmp_cuentas c
WHERE NOT EXISTS (SELECT 1 FROM "usuario_cuenta" uc WHERE uc."username" = c.username);

-- Cuentas con clave Shalom2026
INSERT INTO "usuario_cuenta"
  ("usuario_id", "username", "email", "password_hash", "email_verificado",
   "primer_login", "datos_personales_actualizados", "contacto_tutor_actualizado",
   "password_actualizado", "ultimo_login")
SELECT u."id", c.username, c.username || '@shalom.test',
       '$2a$12$C9nSW/5Mi5KlhQYiFnK59OWnacZJlA5.h.bfoNAlYKTv28yIwDtAe',
       true, false, true, true, true, NOW()
FROM tmp_cuentas c
JOIN "usuarios" u
  ON u."rol_id"           = c.rol_id
 AND u."nombre"           = c.nombre
 AND u."apellido_paterno" = c.apellido_paterno
 AND u."apellido_materno" = c.apellido_materno
WHERE NOT EXISTS (SELECT 1 FROM "usuario_cuenta" x WHERE x."username" = c.username);

-- Apoderados
INSERT INTO "apoderados" ("usuario_id", "ocupacion")
SELECT u."id", v.ocupacion
FROM (VALUES
  ('apoder01','Comerciante'), ('apoder02','Docente'),
  ('apoder03','Agricultor'),   ('apoder04','Enfermera')
) AS v(username, ocupacion)
JOIN tmp_cuentas c ON c.username = v.username
JOIN "usuario_cuenta" uc ON uc."username" = c.username
JOIN "usuarios" u ON u."id" = uc."usuario_id"
ON CONFLICT ("usuario_id") DO NOTHING;

-- Maestros
INSERT INTO "maestros" ("usuario_id", "especialidad", "fecha_contratacion", "materias_configuradas", "estado")
SELECT u."id", m."nombre",
       (DATE '2010-02-01' + ((substring(c.username from 8)::int) * 90))::date,
       true, 'activo'
FROM tmp_cuentas c
JOIN "usuario_cuenta" uc ON uc."username" = c.username
JOIN "usuarios" u ON u."id" = uc."usuario_id"
JOIN "materias" m ON m."codigo" = c.especialidad
WHERE c.especialidad IS NOT NULL
ON CONFLICT ("usuario_id") DO UPDATE SET
  "especialidad" = EXCLUDED."especialidad", "estado" = 'activo';

INSERT INTO "maestro_materias" ("maestro_id", "materia_id")
SELECT ms."id", m."id"
FROM "maestros" ms
JOIN "materias" m ON m."nombre" = ms."especialidad"
WHERE ms."estado" = 'activo'
ON CONFLICT DO NOTHING;

-- Estudiantes
INSERT INTO "estudiantes"
  ("usuario_id", "fecha_ingreso", "tutor_nombre", "tutor_telefono", "tutor_parentesco", "estado")
SELECT uc."usuario_id", DATE '2026-02-02',
       u."nombre" || ' ' || u."apellido_paterno",
       '+5917' || lpad((70000000 + n * 137)::text, 8, '0'),
       CASE WHEN n % 2 = 0 THEN 'Madre' ELSE 'Padre' END,
       'activo'
FROM (
  SELECT uc."usuario_id", (substring(uc."username" from 4))::int AS n
  FROM "usuario_cuenta" uc
  WHERE uc."username" ~ '^est[0-9]{4}$'
) uc
JOIN "usuarios" u ON u."id" = uc."usuario_id"
ON CONFLICT ("usuario_id") DO NOTHING;

-- Documentos, direcciones y contactos
INSERT INTO "usuario_documentos" ("usuario_id", "tipo_doc", "numero_doc")
SELECT u."id", 'CI', lpad((80000000 + row_number() OVER (ORDER BY u."id"))::text, 8, '0')
FROM "usuarios" u
WHERE NOT EXISTS (SELECT 1 FROM "usuario_documentos" d WHERE d."usuario_id" = u."id");

INSERT INTO "usuario_direcciones"
  ("usuario_id", "zona", "distrito", "bloque", "calle", "numero", "edificio", "referencia")
SELECT u."id",
       (ARRAY['Villa Fatima','Zona Central','Av. Always','Barrio San Juan','Villaproductive'])[((u."id" % 5)) + 1],
       'Distrito ' || (1 + (u."id" % 12))::text,
       'M' || (1 + (u."id" % 20))::text,
       'Calle ' || (1 + (u."id" % 30))::text,
       (10 + (u."id" % 90))::text,
       'Bloque ' || chr((65 + (u."id" % 6))::int),
       'Dirección generada para pruebas.'
FROM "usuarios" u
WHERE NOT EXISTS (SELECT 1 FROM "usuario_direcciones" d WHERE d."usuario_id" = u."id");

INSERT INTO "usuario_contactos" ("usuario_id", "tipo", "contenido", "principal")
SELECT u."id", 'telefono', '+5917' || lpad((60000000 + u."id" * 271)::text, 8, '0'), true
FROM "usuarios" u
WHERE NOT EXISTS (SELECT 1 FROM "usuario_contactos" c WHERE c."usuario_id" = u."id");

-- Relación estudiante-apoderado
CREATE TEMP TABLE tmp_apoderados ON COMMIT DROP AS
SELECT ap."id", ap."usuario_id",
       row_number() OVER (ORDER BY ap."usuario_id") AS idx
FROM "apoderados" ap;

INSERT INTO "estudiante_apoderado"
  ("estudiante_id", "apoderado_id", "parentesco", "es_principal", "autorizado_recoger")
SELECT e."id", a."id",
       CASE WHEN e_n.n % 2 = 0 THEN 'Madre' ELSE 'Padre' END,
       true, true
FROM (
  SELECT e."id", (substring(uc."username" from 4))::int AS n
  FROM "estudiantes" e
  JOIN "usuario_cuenta" uc ON uc."usuario_id" = e."usuario_id"
  WHERE uc."username" ~ '^est[0-9]{4}$'
) e_n
JOIN "estudiantes" e ON e."id" = e_n."id"
JOIN tmp_apoderados a ON a.idx = ((e_n.n - 1) % 4) + 1
ON CONFLICT ("estudiante_id", "apoderado_id") DO NOTHING;

-- Inscripciones: cada estudiante va al curso que le toc? en tmp_destino
INSERT INTO "inscripciones"
  ("estudiante_id", "curso_periodo_id", "periodo_id", "origen", "fecha_inscripcion", "estado", "observacion")
SELECT e_n."id", cp."id", cp."periodo_id", 'nueva', DATE '2026-02-02', 'activo',
       'Inscripci?n generada para pruebas'
FROM (
  SELECT e."id", (substring(uc."username" from 4))::int AS n
  FROM "estudiantes" e
  JOIN "usuario_cuenta" uc ON uc."usuario_id" = e."usuario_id"
  WHERE uc."username" ~ '^est[0-9]{4}$'
) e_n
-- El destino sale de tmp_destino, no de un rango de n?meros: as? el aula de
-- cada grado tiene su propio grupo y ninguno se queda vac?o.
JOIN tmp_destino d ON d.n = e_n.n
JOIN "cursos_periodo" cp ON cp."curso_id" = d.curso_id
                        AND cp."periodo_id" = (SELECT "id" FROM tmp_periodo)
ON CONFLICT ("estudiante_id", "curso_periodo_id") DO UPDATE SET "estado" = 'activo';

CREATE TEMP TABLE tmp_inscripciones ON COMMIT DROP AS
SELECT i."estudiante_id", i."curso_periodo_id", i."periodo_id",
       (substring(uc."username" from 4))::int AS n
FROM "inscripciones" i
JOIN "estudiantes" e ON e."id" = i."estudiante_id"
JOIN "usuario_cuenta" uc ON uc."usuario_id" = e."usuario_id"
WHERE i."estado" = 'activo' AND i."periodo_id" = (SELECT "id" FROM tmp_periodo)
  AND uc."username" ~ '^est[0-9]{4}$';

-- Perfiles académicos para seguimiento
CREATE TEMP TABLE tmp_perfiles ON COMMIT DROP AS
SELECT e_n.n,
       e_n."estudiante_id",
       CASE
         WHEN e_n.n % 20 IN (0, 1)        THEN 'alto'
         WHEN e_n.n % 20 IN (2, 3, 4, 5)  THEN 'riesgo'
         WHEN e_n.n % 20 IN (6, 7)        THEN 'observacion'
         ELSE 'normal'
       END AS perfil
FROM (
  SELECT e."id" AS "estudiante_id", (substring(uc."username" from 4))::int AS n
  FROM "estudiantes" e
  JOIN "usuario_cuenta" uc ON uc."usuario_id" = e."usuario_id"
  WHERE uc."username" ~ '^est[0-9]{4}$'
) e_n;

-- Asignaciones docentes y asesores
WITH pares AS (
  SELECT mm."materia_id", ms."id" AS maestro_id,
         row_number() OVER (PARTITION BY mm."materia_id" ORDER BY ms."id") AS idx
  FROM "maestro_materias" mm
  JOIN "maestros" ms ON ms."id" = mm."maestro_id"
  WHERE ms."estado" = 'activo'
)
INSERT INTO "asignaciones_docentes"
  ("maestro_id", "materia_id", "curso_periodo_id", "estado", "fecha_asignacion")
SELECT p.maestro_id, p.materia_id, cp."id", 'activo', DATE '2026-02-02'
FROM pares p
JOIN "grado_materias" gm ON gm."materia_id" = p.materia_id
JOIN "cursos_periodo" cp ON cp."periodo_id" = (SELECT "id" FROM tmp_periodo)
JOIN "cursos" c ON c."id" = cp."curso_id"
             AND c."nivel" = gm."nivel"
             AND c."grado" = gm."grado"
             AND CASE c."paralelo" WHEN 'B' THEN 2 ELSE 1 END = p.idx
ON CONFLICT ("maestro_id", "materia_id", "curso_periodo_id") DO UPDATE SET "estado" = 'activo';

WITH candidatos AS (
  SELECT ad."curso_periodo_id", ad."maestro_id",
         row_number() OVER (PARTITION BY ad."curso_periodo_id" ORDER BY ad."maestro_id") AS idx
  FROM "asignaciones_docentes" ad
  WHERE ad."estado" = 'activo'
)
INSERT INTO "curso_asesor" ("curso_periodo_id", "maestro_id", "fecha_inicio", "fecha_fin")
SELECT "curso_periodo_id", "maestro_id", DATE '2026-02-02', DATE '2026-12-18'
FROM candidatos
WHERE idx = 1
ON CONFLICT ("curso_periodo_id") DO UPDATE SET "maestro_id" = EXCLUDED."maestro_id";

-- Encargos, calificaciones y asistencia
INSERT INTO "encargos"
  ("asignacion_id", "tipo", "titulo", "descripcion", "ponderacion",
   "fecha_publicacion", "fecha_limite", "estado")
SELECT ad."id", 'Tarea', 'Guía de trabajo 1',
       'Actividad inicial de la unidad. Entrega en la fecha límite.',
       50.00, TIMESTAMPTZ '2026-02-16 08:00:00-04', TIMESTAMPTZ '2026-03-13 20:00:00-04', 'publicado'
FROM "asignaciones_docentes" ad
WHERE ad."estado" = 'activo'
  AND NOT EXISTS (
    SELECT 1 FROM "encargos" x WHERE x."asignacion_id" = ad."id" AND x."titulo" = 'Guía de trabajo 1'
  );

INSERT INTO "encargos"
  ("asignacion_id", "tipo", "titulo", "descripcion", "ponderacion",
   "fecha_publicacion", "fecha_limite", "estado")
SELECT ad."id", 'Examen', 'Evaluación sumativa 1',
       'Examen parcial del primer trimestre.',
       50.00, TIMESTAMPTZ '2026-04-06 08:00:00-04', TIMESTAMPTZ '2026-04-10 20:00:00-04', 'publicado'
FROM "asignaciones_docentes" ad
WHERE ad."estado" = 'activo'
  AND NOT EXISTS (
    SELECT 1 FROM "encargos" x WHERE x."asignacion_id" = ad."id" AND x."titulo" = 'Evaluación sumativa 1'
  );

INSERT INTO "calificaciones" ("encargo_id", "estudiante_id", "nota", "fecha_calificacion")
SELECT e."id", ins."estudiante_id",
       ROUND(CAST(GREATEST(0, LEAST(100,
         CASE p.perfil
           WHEN 'alto'        THEN 42
           WHEN 'riesgo'      THEN 55
           WHEN 'observacion' THEN 78
           ELSE 82
         END + ((ins."estudiante_id" + e."id") % 13) - 6
       )) AS numeric), 2),
       e."fecha_publicacion" + interval '14 days'
FROM "encargos" e
JOIN "asignaciones_docentes" ad ON ad."id" = e."asignacion_id"
JOIN tmp_inscripciones ins ON ins."curso_periodo_id" = ad."curso_periodo_id"
JOIN tmp_perfiles p ON p."estudiante_id" = ins."estudiante_id"
WHERE e."estado" = 'publicado'
ON CONFLICT ("encargo_id", "estudiante_id") DO UPDATE SET "nota" = EXCLUDED."nota";

-- La tasa se saca de un hash de (estudiante, asignación, día) en vez de un
-- módulo sobre días correlativos: con días seguidos el 100 % de las ausencias
-- quedaba pegado al mismo grupo de estudiantes. Con el hash cada registro es un
-- tiro casi independiente y el promedio converge al objetivo de cada banda
-- (45 %, 30 %, 20 % y 5 % de inasistencia).
INSERT INTO "asistencia" ("estudiante_id", "asignacion_id", "fecha", "estado", "justificacion")
SELECT ins."estudiante_id",
       ad."id",
       d.fecha,
       CASE
         WHEN ((ins."estudiante_id" * 7919 + ad."id" * 104729 + d.dia * 31) % 100) < v.faltan      THEN 'ausente'
         WHEN ((ins."estudiante_id" * 7919 + ad."id" * 104729 + d.dia * 31) % 100) < v.tarde       THEN 'atraso'
         WHEN ((ins."estudiante_id" * 7919 + ad."id" * 104729 + d.dia * 31) % 100) < v.justificado THEN 'justificado'
         ELSE 'presente'
       END,
       CASE
         WHEN ((ins."estudiante_id" * 7919 + ad."id" * 104729 + d.dia * 31) % 100) < v.justificado
          AND ((ins."estudiante_id" * 7919 + ad."id" * 104729 + d.dia * 31) % 100) >= v.faltan
         THEN 'Justificación médica'
         ELSE NULL
       END
FROM tmp_inscripciones ins
JOIN "asignaciones_docentes" ad ON ad."curso_periodo_id" = ins."curso_periodo_id"
CROSS JOIN (VALUES
  (1, DATE '2026-02-17'),   -- martes
  (2, DATE '2026-02-19'),   -- jueves
  (3, DATE '2026-03-03'),   -- martes
  (4, DATE '2026-03-19'),   -- jueves
  (5, DATE '2026-04-07'),   -- martes
  (6, DATE '2026-04-09')    -- jueves
) AS d(dia, fecha)
JOIN tmp_perfiles p ON p."estudiante_id" = ins."estudiante_id"
-- Cortes acumulados del hash: [ausente, +atraso, +justificado]
CROSS JOIN LATERAL (
  SELECT CASE p.perfil WHEN 'alto' THEN 45 WHEN 'riesgo' THEN 30 WHEN 'observacion' THEN 20 ELSE 5 END AS faltan,
         CASE p.perfil WHEN 'alto' THEN 50 WHEN 'riesgo' THEN 40 WHEN 'observacion' THEN 26 ELSE 9 END AS tarde,
         CASE p.perfil WHEN 'alto' THEN 54 WHEN 'riesgo' THEN 45 WHEN 'observacion' THEN 30 ELSE 12 END AS justificado
) v
WHERE ad."estado" = 'activo'
ON CONFLICT ("estudiante_id", "asignacion_id", "fecha") DO NOTHING;
-- Planes de pago y pensiones
INSERT INTO "planes_pago"
  ("periodo_id", "nivel", "nombre", "cantidad_cuotas", "monto_total", "monto_cuota", "dia_vencimiento", "estado")
SELECT p."id", 'general', 'Matr?cula 2026', 9, 4500.00, 500.00, 10, 'generado'
FROM tmp_periodo p
ON CONFLICT ("periodo_id", "nivel") DO UPDATE SET
  "cantidad_cuotas" = EXCLUDED."cantidad_cuotas", "monto_total" = EXCLUDED."monto_total",
  "monto_cuota" = EXCLUDED."monto_cuota", "estado" = 'generado';

INSERT INTO "cuotas_plan_pago" ("plan_id", "numero", "anio", "mes", "fecha_vencimiento", "monto", "estado")
SELECT pp."id", v.numero, 2026, v.mes,
       (DATE '2026-02-10' + ((v.numero - 1) * interval '1 month'))::date,
       500.00,
       CASE WHEN (DATE '2026-02-10' + ((v.numero - 1) * interval '1 month'))::date < CURRENT_DATE
            THEN 'pagado' ELSE 'pendiente' END
FROM "planes_pago" pp
CROSS JOIN (VALUES (1,2),(2,3),(3,4),(4,5),(5,6),(6,7),(7,8),(8,9),(9,10)) AS v(numero, mes)
WHERE pp."periodo_id" = (SELECT "id" FROM tmp_periodo) AND pp."nivel" = 'general'
ON CONFLICT ("plan_id", "numero") DO NOTHING;

INSERT INTO "pensiones"
  ("estudiante_id", "periodo_id", "plan_pago_id", "numero_cuota", "concepto", "mes",
   "monto", "fecha_vencimiento", "estado")
SELECT ins."estudiante_id", p."id", pp."id", c."numero", 'Matr?cula 2026', c."mes",
       c."monto", c."fecha_vencimiento", c."estado"
FROM tmp_inscripciones ins
CROSS JOIN tmp_periodo p
CROSS JOIN "planes_pago" pp
CROSS JOIN "cuotas_plan_pago" c
WHERE pp."periodo_id" = p."id" AND pp."nivel" = 'general' AND c."plan_id" = pp."id"
ON CONFLICT ("estudiante_id", "periodo_id", "concepto", "mes") DO NOTHING;

DROP TABLE tmp_periodo;

COMMIT;
