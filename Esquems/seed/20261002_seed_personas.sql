-- =============================================================================
-- DATOS DE PRUEBA · parte 2: personas y actividad académica.
--
-- Depende de la parte 1 (20261001_seed_estructura.sql).
--
-- Contiene:
--   · Administración sin director: 3 de control, 2 de gerencia, 4 apoderados
--   · 32 maestros (2 por cada una de las 16 materias)
--   · 205 estudiantes de 1° A y 1° B de secundaria, inscritos y matriculados
--   · Matriz completa de asignaciones docentes para los 24 cursos del periodo
--   · Encargos publicados del 1er trimestre con sus notas y asistencia
--   · Plan de pago y pensiones
--
-- Contraseña de todas las cuentas: Shalom2026
--   director   → `director`
--   control    → `control01` … `control03`
--   gerencia   → `gerencia01`, `gerencia02`
--   apoderado  → `apoder01` … `apoder04`
--   maestro    → `maestro01` … `maestro32`
--   estudiante → `est0001` … `est0205`
--
-- Los 205 estudiantes se reparten en cuatro perfiles para que el módulo de
-- seguimiento tenga de todo: normal, observación, riesgo y riesgo alto. El
-- perfil sale del número de secuencia (el que va en el username), así que la
-- mezcla es idéntica en cada ejecución.
--
-- Aplicar con:  psql -d ShalomDB -f Esquems/seed/20261002_seed_personas.sql
-- =============================================================================

BEGIN;

-- Hash bcrypt de 12 rondas de "Shalom2026", en el mismo formato que genera
-- ServiceUser ($2a$ de bcryptjs). Para cambiar la clave:
--   import bcrypt from "bcryptjs"; await bcrypt.hash("OtraClave", 12);

-- El periodo no se fija a un id: se toma el que quedó activo en la parte 1,
-- para que el seed funcione sobre una base que ya tenía una gestión en curso.
DROP TABLE IF EXISTS tmp_periodo;
CREATE TEMP TABLE tmp_periodo (
  id bigint PRIMARY KEY
) ON COMMIT PRESERVE ROWS;

INSERT INTO tmp_periodo (id)
SELECT "id" FROM "periodos_academicos" WHERE "activo" AND "anio" = 2026 ORDER BY "id" LIMIT 1;

-- =============================================================================
-- 1 · LISTA MAESTRA DE CUENTAS
-- =============================================================================
-- Se arma una sola vez en una tabla temporal y se usa para `usuarios` y para
-- `usuario_cuenta`. Así no hay que duplicar los nombres en dos sentencias.
CREATE TEMP TABLE tmp_cuentas (
  username            text PRIMARY KEY,
  rol_id              bigint NOT NULL,
  nombre              text   NOT NULL,
  apellido_paterno    text   NOT NULL,
  apellido_materno    text   NOT NULL,
  nacimiento          date   NOT NULL,
  genero              text   NOT NULL,
  especialidad        text            -- solo maestros: código de la materia
) ON COMMIT DROP;

INSERT INTO tmp_cuentas (username, rol_id, nombre, apellido_paterno, apellido_materno, nacimiento, genero, especialidad) VALUES
  -- ── Control / administración ──
  ('control01',  4, 'Elena',    'Ribera',     'Ortiz',    DATE '1988-03-14', 'femenino',  NULL),
  ('control02',  4, 'Marcelo',  'Quiroga',    'Céspedes', DATE '1990-07-22', 'masculino', NULL),
  ('control03',  4, 'Silvana',  'Ayoví',      'Terceros', DATE '1992-11-05', 'femenino',  NULL),
  -- ── Gerencia ──
  ('gerencia01', 10, 'Rodrigo',  'Sanzetenea', 'Vargas',   DATE '1985-05-30', 'masculino', NULL),
  ('gerencia02', 10, 'Patricia', 'Mendoza',    'Loayza',   DATE '1987-09-18', 'femenino',  NULL),
  -- ── Apoderados: se reparten entre los 205 estudiantes ──
  ('apoder01',    9, 'Jorge',    'Chumacero',  'Nina',     DATE '1983-01-25', 'masculino', NULL),
  ('apoder02',    9, 'Lourdes',  'Poma',       'Choque',   DATE '1986-04-11', 'femenino',  NULL),
  ('apoder03',    9, 'Wilson',   'Apaza',      'Mamani',   DATE '1984-12-02', 'masculino', NULL),
  ('apoder04',    9, 'Yeni',     'Condori',    'Rojas',    DATE '1989-08-19', 'femenino',  NULL);

-- ── Maestros: 2 por materia, en orden. maestro01/02 → LEN-101, 03/04 → LIG-102…
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

-- ── Estudiantes ────────────────────────────────────────────────────────────
-- Los 205 nombres salen de dos arreglos: el nombre se toma del resto de la
-- división por 30 y el apellido paterno del cociente. Esa pareja es única para
-- 1..205 (30 × 30 = 900 combinaciones), así que ningún estudiante repite nombre
-- completo y el JOIN contra `usuarios` no multiplica filas.
INSERT INTO tmp_cuentas (username, rol_id, nombre, apellido_paterno, apellido_materno, nacimiento, genero, especialidad)
SELECT
  'est' || lpad(n::text, 4, '0'),
  3,
  (ARRAY['Abigail','Bruno','Camila','Dante','Elena','Facundo',
         'Gabriela','Hector','Ines','Joaquin','Karla','Lorenzo',
         'Mariana','Nicolas','Olivia','Pablo','Renata','Santiago',
         'Tatiana','Ursula','Valentina','Wilder','Ximena','Yohan',
         'Zulma','Ariadna','Benjmin','Ciro','Dayana','Emilio'])[((n - 1) % 30) + 1],
  (ARRAY['Vega','Salcedo','Zubieta','Mogrovejo','Cumbicus','Arocena',
         'Ynchausti','Quispe','Palomeque','Chuquimarca','Choque','Apuaza',
         'Tintaya','Zaragoza','Mamani','Guarangay','Callisaya','Ccahuana',
         'Mamani','Quisbert','Apaza','Mamani','Ponce','Condori',
         'Choque','Tintaya','Huayllani','Villarroel','Apuaza','Mayta'])[(((n - 1) / 30) % 30) + 1],
  (ARRAY['Roca','Paz','Aliaga','Lillo','Mamani','Chavez',
         'Copa','Mamani','Apaza','Vera','Ponce','Mayta',
         'Condori','Callo','Poma','Cori','Apaza','Callisaya',
         'Mamani','Antezana','Condori','Zeballos','Mamani','Tola',
         'Apaza','Zambrano','Callo','Mayta','Apuaza','Mayta'])[((n * 13) % 30) + 1],
  -- 14-15 años al entrar a 1° de secundaria en 2026
  (DATE '2011-02-07' + ((n * 3) % 640))::date,
  CASE WHEN n % 2 = 0 THEN 'femenino' ELSE 'masculino' END,
  NULL
FROM generate_series(1, 205) AS n;

-- =============================================================================
-- 2 · USUARIOS Y CUENTAS
-- =============================================================================
INSERT INTO "usuarios" ("rol_id", "nombre", "apellido_paterno", "apellido_materno", "nacimiento", "genero", "estado")
SELECT c.rol_id, c.nombre, c.apellido_paterno, c.apellido_materno, c.nacimiento, c.genero, 'activo'
FROM tmp_cuentas c
WHERE NOT EXISTS (SELECT 1 FROM "usuario_cuenta" uc WHERE uc."username" = c.username);

INSERT INTO "usuario_cuenta"
  ("usuario_id", "username", "email", "password_hash", "email_verificado",
   "primer_login", "datos_personales_actualizados", "contacto_tutor_actualizado",
   "password_actualizado", "ultimo_login")
SELECT u."id", c.username, c.username || '@shalom.test',
       '$2a$12$C9nSW/5Mi5KlhQYiFnK59OWnacZJlA5.h.bfoNAlYKTv28yIwDtAe',
       true, false, true, true, true, NOW()
FROM tmp_cuentas c
JOIN "usuarios" u
  ON u."rol_id"      = c.rol_id
 AND u."nombre"      = c.nombre
 AND u."apellido_paterno" = c.apellido_paterno
 AND u."apellido_materno" = c.apellido_materno
WHERE NOT EXISTS (SELECT 1 FROM "usuario_cuenta" x WHERE x."username" = c.username);

-- =============================================================================
-- 3 · APODERADOS, MAESTROS Y ESTUDIANTES (filas de dominio)
-- =============================================================================
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

INSERT INTO "maestros" ("usuario_id", "especialidad", "fecha_contratacion", "materias_configuradas", "estado")
SELECT u."id", m."nombre",
       -- antigüedad escalonada para que las fechas no se repitan
       (DATE '2010-02-01' + ((substring(c.username from 8)::int) * 90))::date,
       true, 'activo'
FROM tmp_cuentas c
JOIN "usuario_cuenta" uc ON uc."username" = c.username
JOIN "usuarios" u ON u."id" = uc."usuario_id"
JOIN "materias" m ON m."codigo" = c.especialidad
WHERE c.especialidad IS NOT NULL
ON CONFLICT ("usuario_id") DO UPDATE SET
  "especialidad" = EXCLUDED."especialidad", "estado" = 'activo';

-- Cada maestro queda habilitado para impartir su materia.
INSERT INTO "maestro_materias" ("maestro_id", "materia_id")
SELECT ms."id", m."id"
FROM "maestros" ms
JOIN "usuario_cuenta" uc ON uc."usuario_id" = ms."usuario_id"
JOIN "materias" m ON m."codigo" = ms."especialidad"
ON CONFLICT DO NOTHING;

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

-- =============================================================================
-- 4 · DOCUMENTOS, DIRECCIONES Y CONTACTOS
-- =============================================================================
-- `numero_doc` es único en toda la tabla, así que se numera de forma global.
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

-- =============================================================================
-- 5 · ESTUDIANTE ↔ APODERADO
-- =============================================================================
-- 4 tutores repartidos en round-robin entre los 205 estudiantes.
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

-- =============================================================================
-- 6 · INSCRIPCIONES
-- =============================================================================
-- est0001…est0102 → 1° A (curso 27) · est0103…est0205 → 1° B (curso 28)
INSERT INTO "inscripciones"
  ("estudiante_id", "curso_periodo_id", "periodo_id", "origen", "fecha_inscripcion", "estado", "observacion")
SELECT e_n."id", cp."id", cp."periodo_id", 'nueva', DATE '2026-02-02', 'activo',
       'Inscripción generada para pruebas'
FROM (
  SELECT e."id", (substring(uc."username" from 4))::int AS n
  FROM "estudiantes" e
  JOIN "usuario_cuenta" uc ON uc."usuario_id" = e."usuario_id"
  WHERE uc."username" ~ '^est[0-9]{4}$'
) e_n
JOIN "cursos" c ON c."id" = CASE WHEN e_n.n <= 102 THEN 27 ELSE 28 END
JOIN "cursos_periodo" cp ON cp."curso_id" = c."id" AND cp."periodo_id" = (SELECT "id" FROM tmp_periodo)
ON CONFLICT ("estudiante_id", "curso_periodo_id") DO UPDATE SET "estado" = 'activo';

-- Índice de las inscripciones sembradas. Se arma DESPUÉS del INSERT para que
-- incluya también las filas que ya venían de una ejecución anterior.
CREATE TEMP TABLE tmp_inscripciones ON COMMIT DROP AS
SELECT i."estudiante_id", i."curso_periodo_id", i."periodo_id",
       (substring(uc."username" from 4))::int AS n
FROM "inscripciones" i
JOIN "estudiantes" e ON e."id" = i."estudiante_id"
JOIN "usuario_cuenta" uc ON uc."usuario_id" = e."usuario_id"
WHERE i."estado" = 'activo' AND i."periodo_id" = (SELECT "id" FROM tmp_periodo)
  AND uc."username" ~ '^est[0-9]{4}$';

-- =============================================================================
-- 7 · PERFIL ACADÉMICO POR ESTUDIANTE
-- =============================================================================
-- El módulo de seguimiento no guarda el riesgo: lo recalcula. Estas son las
-- notas y las inasistencias que lo llevan a cada banda. Los umbrales viven en
-- ServiceAcademic/config/seguimiento.config.ts:
--   riesgo        → promedio < 60  o  asistencia < 75 %
--   riesgo alto   → promedio < 50  y  asistencia < 60 %
--   observación   → asistencia entre 75 % y 85 %
--
-- La mezcla sale del número de secuencia:
--   n % 20 ∈ {0,1}        → riesgo alto   (~10 %)
--   n % 20 ∈ {2,3,4,5}    → riesgo        (~20 %)
--   n % 20 ∈ {6,7}        → observación   (~10 %)
--   resto                 → normal        (~60 %)
CREATE TEMP TABLE tmp_perfiles ON COMMIT DROP AS
SELECT e_n.n,
       e_n."estudiante_id",
       CASE
         WHEN e_n.n % 20 IN (0, 1)     THEN 'alto'
         WHEN e_n.n % 20 IN (2, 3, 4, 5) THEN 'riesgo'
         WHEN e_n.n % 20 IN (6, 7)     THEN 'observacion'
         ELSE 'normal'
       END AS perfil
FROM (
  SELECT e."id" AS "estudiante_id", (substring(uc."username" from 4))::int AS n
  FROM "estudiantes" e
  JOIN "usuario_cuenta" uc ON uc."usuario_id" = e."usuario_id"
  WHERE uc."username" ~ '^est[0-9]{4}$'
) e_n;

-- =============================================================================
-- 8 · ASIGNACIONES DOCENTES
-- =============================================================================
-- Los dos maestros de una materia se reparten: el primero da el paralelo A y
-- el segundo el B. Como la materia es por grado, cada maestro termina cubriendo
-- todos los grados donde cursa la misma.
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

-- =============================================================================
-- 9 · ASESORES DE CURSO
-- =============================================================================
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

-- =============================================================================
-- 10 · ENCARGOS DEL 1ER TRIMESTRE
-- =============================================================================
-- El seguimiento promedia `SUM(nota * ponderacion) / SUM(ponderacion)` sobre los
-- encargos PUBLICADOS cuya fecha de publicación cae dentro del trimestre. Por
-- eso los dos van al 50 % y publicados dentro del 1er trimestre.
-- `encargos` no tiene restricción única, así que el control de duplicados es
-- explícito con NOT EXISTS.
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

-- =============================================================================
-- 11 · CALIFICACIONES
-- =============================================================================
-- El promedio de cada materia se mueve ±6 puntos alrededor de la base del perfil,
-- así que el promedio ponderado total queda claramente dentro de la banda.
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
       -- la nota se registra dos semanas después de la publicación
       e."fecha_publicacion" + interval '14 days'
FROM "encargos" e
JOIN "asignaciones_docentes" ad ON ad."id" = e."asignacion_id"
JOIN tmp_inscripciones ins ON ins."curso_periodo_id" = ad."curso_periodo_id"
JOIN tmp_perfiles p ON p."estudiante_id" = ins."estudiante_id"
WHERE e."estado" = 'publicado'
ON CONFLICT ("encargo_id", "estudiante_id") DO UPDATE SET "nota" = EXCLUDED."nota";

-- =============================================================================
-- 12 · ASISTENCIA — 3 días lectivos del 1er trimestre
-- =============================================================================
-- Todo lo que no es "ausente" cuenta como asistencia efectiva (presente, atraso
-- y justificado), así que la tasa se controla con la proporción de ausencias.
-- Tres días por student's 11 materias bastan para mover la banda.
INSERT INTO "asistencia" ("estudiante_id", "asignacion_id", "fecha", "estado", "justificacion")
SELECT ins."estudiante_id",
       ad."id",
       d.fecha,
       CASE
         WHEN p.perfil = 'alto'        AND ((ins."estudiante_id" + d.dia) % 20) <  9 THEN 'ausente'
         WHEN p.perfil = 'riesgo'      AND ((ins."estudiante_id" + d.dia) % 10) <  3 THEN 'ausente'
         WHEN p.perfil = 'observacion' AND ((ins."estudiante_id" + d.dia) %  5) =  0 THEN 'ausente'
         WHEN p.perfil = 'normal'      AND ((ins."estudiante_id" + d.dia) % 20) =  0 THEN 'ausente'
         WHEN ((ins."estudiante_id" + d.dia) % 13) = 0 THEN 'atraso'
         WHEN ((ins."estudiante_id" + d.dia) % 37) = 0 THEN 'justificado'
         ELSE 'presente'
       END,
       CASE WHEN ((ins."estudiante_id" + d.dia) % 37) = 0 THEN 'Justificación médica' ELSE NULL END
FROM tmp_inscripciones ins
JOIN "asignaciones_docentes" ad ON ad."curso_periodo_id" = ins."curso_periodo_id"
CROSS JOIN (VALUES
  (1, DATE '2026-02-17'),
  (2, DATE '2026-03-03'),
  (3, DATE '2026-04-07')
) AS d(dia, fecha)
JOIN tmp_perfiles p ON p."estudiante_id" = ins."estudiante_id"
WHERE ad."estado" = 'activo'
ON CONFLICT ("estudiante_id", "asignacion_id", "fecha") DO NOTHING;

-- =============================================================================
-- 13 · PLAN DE PAGO Y PENSIONES
-- =============================================================================
INSERT INTO "planes_pago"
  ("periodo_id", "nivel", "nombre", "cantidad_cuotas", "monto_total", "monto_cuota", "dia_vencimiento", "estado")
SELECT p."id", 'general', 'Matrícula 2026', 9, 4500.00, 500.00, 10, 'generado'
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
SELECT ins."estudiante_id", p."id", pp."id", c."numero", 'Matrícula 2026', c."mes",
       c."monto", c."fecha_vencimiento", c."estado"
FROM tmp_inscripciones ins
CROSS JOIN tmp_periodo p
CROSS JOIN "planes_pago" pp
CROSS JOIN "cuotas_plan_pago" c
WHERE pp."periodo_id" = p."id" AND pp."nivel" = 'general' AND c."plan_id" = pp."id"
ON CONFLICT ("estudiante_id", "periodo_id", "concepto", "mes") DO NOTHING;

DROP TABLE tmp_periodo;

COMMIT;

-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================
SELECT 'administración (sin director)' AS entidad, COUNT(*) AS total
FROM "usuarios" u JOIN "roles" r ON r."id" = u."rol_id"
WHERE r."rol" IN ('control','gerencia','apoderado')
UNION ALL SELECT 'apoderados',    COUNT(*) FROM "apoderados"
UNION ALL SELECT 'maestros',      COUNT(*) FROM "maestros"
UNION ALL SELECT 'maestro_materias (habilitaciones)', COUNT(*) FROM "maestro_materias"
UNION ALL SELECT 'estudiantes',   COUNT(*) FROM "estudiantes"
UNION ALL SELECT 'inscripciones', COUNT(*) FROM "inscripciones" WHERE "estado" = 'activo'
UNION ALL SELECT 'asignaciones',  COUNT(*) FROM "asignaciones_docentes"
UNION ALL SELECT 'asesores',      COUNT(*) FROM "curso_asesor"
UNION ALL SELECT 'encargos',      COUNT(*) FROM "encargos"
UNION ALL SELECT 'calificaciones',COUNT(*) FROM "calificaciones"
UNION ALL SELECT 'asistencia',    COUNT(*) FROM "asistencia"
UNION ALL SELECT 'pensiones',     COUNT(*) FROM "pensiones"
ORDER BY 1;

-- Reparto de los 205 entre 1° A y 1° B de secundaria:
SELECT c."nivel", c."grado", c."paralelo", c."capacidad_maxima", COUNT(i."id") AS inscritos
FROM "cursos" c
JOIN "cursos_periodo" cp ON cp."curso_id" = c."id" AND cp."periodo_id" = 1
JOIN "inscripciones" i ON i."curso_periodo_id" = cp."id" AND i."estado" = 'activo'
GROUP BY c."nivel", c."grado", c."paralelo", c."capacidad_maxima"
ORDER BY c."nivel", c."grado", c."paralelo";

-- Las dos asignaciones por curso, por nivel:
SELECT c."nivel", c."grado", COUNT(DISTINCT ad."materia_id") AS materias,
       COUNT(DISTINCT ad."maestro_id") AS docentes
FROM "cursos" c
JOIN "cursos_periodo" cp ON cp."curso_id" = c."id" AND cp."periodo_id" = 1
JOIN "asignaciones_docentes" ad ON ad."curso_periodo_id" = cp."id" AND ad."estado" = 'activo'
GROUP BY c."nivel", c."grado"
ORDER BY c."nivel", c."grado";

-- Cómo quedaron las cuatro bandas de riesgo. Es el mismo cálculo que hace
-- ServiceAcademic/services/seguimiento.service.ts:
WITH notas AS (
  SELECT i."estudiante_id",
         SUM(cal."nota" * e."ponderacion") / NULLIF(SUM(e."ponderacion"), 0) AS promedio
  FROM "calificaciones" cal
  JOIN "encargos" e ON e."id" = cal."encargo_id"
  JOIN "asignaciones_docentes" ad ON ad."id" = e."asignacion_id"
  JOIN "cursos_periodo" cp ON cp."id" = ad."curso_periodo_id"
  JOIN "trimestres" t ON t."periodo_id" = cp."periodo_id" AND t."numero" = 1
  JOIN "inscripciones" i ON i."curso_periodo_id" = cp."id" AND i."estado" = 'activo'
  WHERE e."estado" = 'publicado' AND e."fecha_publicacion" BETWEEN t."inicio" AND t."fin"
  GROUP BY i."estudiante_id"
),
asist AS (
  SELECT i."estudiante_id",
         ROUND(100.0 * COUNT(*) FILTER (WHERE a."estado" <> 'ausente') / COUNT(*)) AS pct
  FROM "asistencia" a
  JOIN "asignaciones_docentes" ad ON ad."id" = a."asignacion_id"
  JOIN "cursos_periodo" cp ON cp."id" = ad."curso_periodo_id"
  JOIN "inscripciones" i ON i."curso_periodo_id" = cp."id" AND i."estado" = 'activo'
  GROUP BY i."estudiante_id"
),
combinado AS (
  SELECT n."estudiante_id", ROUND(n.promedio, 1) AS promedio, a.pct AS asistencia
  FROM notas n JOIN asist a ON a."estudiante_id" = n."estudiante_id"
)
SELECT CASE
         WHEN promedio < 50 AND asistencia < 60 THEN 'riesgo alto'
         WHEN promedio < 60 OR  asistencia < 75 THEN 'riesgo'
         WHEN asistencia < 85                  THEN 'observación'
         ELSE 'normal'
       END AS banda,
       COUNT(*) AS estudiantes,
       ROUND(MIN(promedio), 1) AS promedio_min,
       ROUND(MAX(promedio), 1) AS promedio_max,
       MIN(asistencia) AS asistencia_min,
       MAX(asistencia) AS asistencia_max
FROM combinado
GROUP BY 1
ORDER BY 1;