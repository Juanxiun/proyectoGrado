BEGIN;

-- Datos funcionales para pruebas: catálogo curricular completo y estudiantes
-- solo en 1ro de secundaria A/B. Las cuentas usan el generador institucional.

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

-- Turnos (jornada Bolivia 07:00 a 12:00, receso 09:30 a 10:00)
INSERT INTO "turnos" ("codigo", "nombre", "hora_inicio", "hora_fin", "receso_inicio", "receso_fin", "duracion_periodo_minutos", "activo")
VALUES
  ('manana', 'Turno Mañana', '07:00', '12:00', '09:30', '10:00', 45, true),
  ('tarde',  'Turno Tarde',  '14:00', '18:30', '16:00', '16:30', 45, true)
ON CONFLICT ("codigo") DO UPDATE SET
  "nombre" = EXCLUDED."nombre",
  "hora_inicio" = EXCLUDED."hora_inicio",
  "hora_fin" = EXCLUDED."hora_fin",
  "receso_inicio" = EXCLUDED."receso_inicio",
  "receso_fin" = EXCLUDED."receso_fin",
  "duracion_periodo_minutos" = EXCLUDED."duracion_periodo_minutos",
  "activo" = true;

-- Aulas (24 aulas base, una por curso, mas laboratorio, taller y auditorio)
INSERT INTO "aulas" ("codigo", "nombre", "capacidad", "activa") VALUES
  ('A-101', 'Aula 101', 30, true), ('A-102', 'Aula 102', 30, true),
  ('A-103', 'Aula 103', 30, true), ('A-104', 'Aula 104', 30, true),
  ('A-105', 'Aula 105', 30, true), ('A-106', 'Aula 106', 30, true),
  ('A-201', 'Aula 201', 30, true), ('A-202', 'Aula 202', 30, true),
  ('A-203', 'Aula 203', 30, true), ('A-204', 'Aula 204', 30, true),
  ('A-205', 'Aula 205', 30, true), ('A-206', 'Aula 206', 30, true),
  ('B-101', 'Aula B-101', 28, true), ('B-102', 'Aula B-102', 28, true),
  ('B-103', 'Aula B-103', 28, true), ('B-104', 'Aula B-104', 28, true),
  ('B-105', 'Aula B-105', 28, true), ('B-106', 'Aula B-106', 28, true),
  ('C-101', 'Aula C-101', 28, true), ('C-102', 'Aula C-102', 28, true),
  ('C-103', 'Aula C-103', 28, true), ('C-104', 'Aula C-104', 28, true),
  ('C-105', 'Aula C-105', 28, true), ('C-106', 'Aula C-106', 28, true),
  ('LAB-1', 'Laboratorio de ciencias', 25, true),
  ('TALL-1','Taller de tecnología', 20, true),
  ('AUD-1', 'Auditorio', 120, true)
ON CONFLICT ("codigo") DO UPDATE SET
  "nombre" = EXCLUDED."nombre",
  "capacidad" = EXCLUDED."capacidad",
  "activa" = true;

-- Materias (pensum Bolivia Ley 070)
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

-- Cursos base (primaria y secundaria, paralelos A y B)
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

-- Materias por grado (primaria uniforme de 11, secundaria por ciclo con EFI)
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
    ('LEN-101',1), ('MAT-401',2), ('CNT-301',3), ('CSO-104',4),
    ('LIG-102',5), ('LEX-103',6), ('VER-201',7), ('EFI-105',8),
    ('MUS-106',9), ('ART-107',10), ('TTG-402',11)
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
  ('secundaria','1°','EFI-105',12),

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
  ('secundaria','2°','EFI-105',15),

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
  ('secundaria','3°','EFI-105',14),

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
  ('secundaria','4°','EFI-105',14),

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
  ('secundaria','5°','EFI-105',14),

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
  ('secundaria','6°','TTE-403',13),
  ('secundaria','6°','EFI-105',14)
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

-- Malla curricular por ciclo y materia (U1 y U2 desarrollo, U3 integracion y evaluacion)
WITH temas(ciclo, codigo, unidad, titulo, contenidos, horas, es_eval) AS (
  VALUES
  ('primaria','LEN-101',1,'Lectura comprensiva y escritura','Lectura de cuentos y fábulas; escritura de sílabas, palabras y oraciones.',6,false),
  ('primaria','LEN-101',2,'Producción de textos cortos','Narración de experiencias y descripción de la familia y la comunidad.',6,false),
  ('primaria','LEN-101',3,'Integración y evaluación de lenguaje','Dictado, lectura oral y feria de textos del trimestre.',2,true),
  ('primaria','LIG-102',1,'Saludos y presentación en lengua originaria','Saludos, presentación personal y normas de cortesía en lengua originaria.',4,false),
  ('primaria','LIG-102',2,'Vocabulario de la familia y la chacra','Palabras de la familia, los animales y los cultivos de la comunidad.',4,false),
  ('primaria','LIG-102',3,'Diálogos y evaluación oral','Diálogos breves y evaluación oral del trimestre.',2,true),
  ('primaria','LEX-103',1,'My classroom and colors','Greetings, colors, school objects and classroom commands.',4,false),
  ('primaria','LEX-103',2,'Family and animals','Family members, pets and farm animals with short descriptions.',4,false),
  ('primaria','LEX-103',3,'Songs, games and unit review','Songs, vocabulary games and unit review.',2,true),
  ('primaria','CSO-104',1,'Mi familia y mi comunidad','La familia, los vecinos y las costumbres de la comunidad.',4,false),
  ('primaria','CSO-104',2,'El barrio, la zona y sus autoridades','Calles, servicios, autoridades locales y cuidado del barrio.',4,false),
  ('primaria','CSO-104',3,'Símbolos patrios y evaluación','Bandera, escudo e himno nacional con evaluación del trimestre.',2,true),
  ('primaria','CNT-301',1,'Los seres vivos y su ambiente','Plantas, animales y el entorno natural de la región.',5,false),
  ('primaria','CNT-301',2,'El cuerpo humano y la alimentación','Partes del cuerpo, higiene y alimentos nutritivos.',5,false),
  ('primaria','CNT-301',3,'Cuidado del agua y evaluación','Uso racional del agua y evaluación del trimestre.',2,true),
  ('primaria','MAT-401',1,'Números naturales y operaciones','Conteo, suma, resta y resolución de problemas cotidianos.',8,false),
  ('primaria','MAT-401',2,'Geometría, medidas y fracciones','Figuras geométricas, longitud, peso y noción de fracción.',8,false),
  ('primaria','MAT-401',3,'Resolución de problemas y evaluación','Problemas integradores y evaluación del trimestre.',2,true),
  ('primaria','EFI-105',1,'Esquema corporal y lateralidad','Reconocimiento corporal, equilibrio y lateralidad mediante juegos.',3,false),
  ('primaria','EFI-105',2,'Juegos predeportivos y coordinación','Carreras, saltos, lanzamientos y juegos de equipo.',3,false),
  ('primaria','EFI-105',3,'Mini olimpiadas y evaluación','Jornada predeportiva y evaluación de destrezas.',1,true),
  ('primaria','MUS-106',1,'Ritmo, pulso y cantos escolares','Pulso, ritmo y cantos del repertorio escolar boliviano.',3,false),
  ('primaria','MUS-106',2,'Instrumentos de la región','Percusión menor e instrumentos tradicionales de la comunidad.',3,false),
  ('primaria','MUS-106',3,'Presentación musical y evaluación','Muestra de cantos y evaluación del trimestre.',1,true),
  ('primaria','ART-107',1,'Línea, forma y color','Trazo, formas básicas y mezcla de colores primarios.',3,false),
  ('primaria','ART-107',2,'Dibujo, pintura y artesanía local','Paisaje, retrato familiar y manualidades con material reciclado.',3,false),
  ('primaria','ART-107',3,'Exposición de trabajos y evaluación','Galería de aula y evaluación del trimestre.',1,true),
  ('primaria','VER-201',1,'Valores en la familia y la escuela','Respeto, solidaridad y responsabilidad en la convivencia diaria.',3,false),
  ('primaria','VER-201',2,'Respeto a la Madre Tierra y reciprocidad','Cuidado de la naturaleza, ayni y trabajo comunitario.',3,false),
  ('primaria','VER-201',3,'Reflexión y evaluación','Relato de buenas acciones y evaluación del trimestre.',1,true),
  ('primaria','TTG-402',1,'Herramientas y materiales del taller','Reconocimiento y uso seguro de herramientas básicas.',3,false),
  ('primaria','TTG-402',2,'Manualidades productivas','Elaboración de objetos útiles con material local.',3,false),
  ('primaria','TTG-402',3,'Feria productiva y evaluación','Exposición de productos y evaluación del trimestre.',1,true),
  ('secundaria','LEN-101',1,'Narrativa y lectura crítica','Del relato al ensayo: personajes, trama y postura crítica.',6,false),
  ('secundaria','LEN-101',2,'Escritura argumentativa y ensayo','Tesis, pruebas, citación de fuentes y redacción del ensayo.',6,false),
  ('secundaria','LEN-101',3,'Proyecto de escritura y evaluación','Antología de curso y examen del trimestre.',2,true),
  ('secundaria','LIG-102',1,'Comunicación ancestral y cosmovisión','Prácticas ancestrales de comunicación y relato oral.',4,false),
  ('secundaria','LIG-102',2,'Gramática y producción oral','Estructura de la lengua originaria y narración oral.',4,false),
  ('secundaria','LIG-102',3,'Debate en lengua originaria y evaluación','Debate temático y evaluación del trimestre.',2,true),
  ('secundaria','LEX-103',1,'Everyday English and present tenses','Daily routines, present simple and present continuous.',4,false),
  ('secundaria','LEX-103',2,'Past and future: telling stories','Past simple, going to and narrative writing.',4,false),
  ('secundaria','LEX-103',3,'Project and unit evaluation','Class magazine project and unit exam.',2,true),
  ('secundaria','CSO-104',1,'Historia de Bolivia y pueblos originarios','Periodo precolonial, colonia y fundación de la república.',4,false),
  ('secundaria','CSO-104',2,'Geografía, territorio y economía','Pisos ecológicos, recursos naturales y economía comunitaria.',4,false),
  ('secundaria','CSO-104',3,'Ciudadanía y evaluación','Derechos, deberes y evaluación del trimestre.',2,true),
  ('secundaria','VER-201',1,'Identidad, valores y espiritualidad','Identidad cultural, valores sociocomunitarios y espiritualidad.',3,false),
  ('secundaria','VER-201',2,'Ética comunitaria y reciprocidad','Ayni, mink_a y resolución comunitaria de conflictos.',3,false),
  ('secundaria','VER-201',3,'Reflexión escrita y evaluación','Ensayo reflexivo y evaluación del trimestre.',1,true),
  ('secundaria','FIL-202',1,'Introducción a la cosmovisión andina','Dualidad, Pachamama y pensamiento originario.',4,false),
  ('secundaria','FIL-202',2,'Filosofía, lógica y psicología del adolescente','Argumentación lógica y desarrollo afectivo del adolescente.',4,false),
  ('secundaria','FIL-202',3,'Ensayo filosófico y evaluación','Ensayo breve y evaluación del trimestre.',2,true),
  ('secundaria','CNT-301',1,'Método científico y laboratorio','Observación, hipótesis, experimentación y reporte.',4,false),
  ('secundaria','CNT-301',2,'Materia, energía y ambiente','Estados de la materia, energía y equilibrio ambiental.',4,false),
  ('secundaria','CNT-301',3,'Investigación y evaluación','Trabajo de investigación con sustentación.',2,true),
  ('secundaria','BIO-302',1,'La célula, tejidos y sistemas','Nivel celular, tejidos y sistemas del cuerpo humano.',6,false),
  ('secundaria','BIO-302',2,'Ecosistemas, genética y salud','Cadenas alimentarias, herencia y salud preventiva.',6,false),
  ('secundaria','BIO-302',3,'Práctica de laboratorio y evaluación','Informe de laboratorio y examen del trimestre.',2,true),
  ('secundaria','FIS-303',1,'Magnitudes, medida y notación científica','Unidades, errores de medición y notación científica.',5,false),
  ('secundaria','FIS-303',2,'Movimiento, fuerza y energía','Velocidad, aceleración, leyes de Newton y energía.',5,false),
  ('secundaria','FIS-303',3,'Problemas y evaluación','Solución de problemas y examen del trimestre.',2,true),
  ('secundaria','QUI-304',1,'Átomos, enlaces y tabla periódica','Estructura atómica, enlaces y familias de elementos.',5,false),
  ('secundaria','QUI-304',2,'Reacciones químicas y estequiometría','Balanceo, tipos de reacción y cálculos básicos.',5,false),
  ('secundaria','QUI-304',3,'Práctica y evaluación','Práctica de laboratorio y examen del trimestre.',2,true),
  ('secundaria','MAT-401',1,'Álgebra: ecuaciones y polinomios','Operaciones con polinomios y ecuaciones de primer y segundo grado.',8,false),
  ('secundaria','MAT-401',2,'Geometría, trigonometría y funciones','Triángulos, razones trigonométricas y función lineal.',8,false),
  ('secundaria','MAT-401',3,'Estadística aplicada y evaluación','Tablas, gráficos y examen del trimestre.',2,true),
  ('secundaria','TTG-402',1,'Dibujo técnico y tecnología productiva','Proyecciones, escalas y lectura de planos básicos.',4,false),
  ('secundaria','TTG-402',2,'Electricidad básica y emprendimiento','Circuitos simples, seguridad y plan de microemprendimiento.',4,false),
  ('secundaria','TTG-402',3,'Proyecto tecnológico y evaluación','Prototipo funcional y evaluación del trimestre.',2,true),
  ('secundaria','TTE-403',1,'Robótica: sensores y actuadores','Componentes electrónicos, sensores y placas programables.',5,false),
  ('secundaria','TTE-403',2,'Programación de prototipos','Lógica de programación y control de mecanismos.',5,false),
  ('secundaria','TTE-403',3,'Feria de robótica y evaluación','Demostración de prototipos y evaluación del trimestre.',2,true),
  ('secundaria','EFI-105',1,'Acondicionamiento físico y atletismo','Resistencia, velocidad y pruebas atléticas básicas.',3,false),
  ('secundaria','EFI-105',2,'Deportes de conjunto: fútbol y voleibol','Fundamentos, reglas y juego de equipo.',3,false),
  ('secundaria','EFI-105',3,'Campeonato interno y evaluación','Torneo de curso y evaluación de destrezas.',1,true),
  ('secundaria','MUS-106',1,'Teoría musical y lectura de partituras','Notas, figuras rítmicas y lectura básica.',3,false),
  ('secundaria','MUS-106',2,'Folklore boliviano e instrumentos','Ritmos nacionales e instrumentos autóctonos y mestizos.',3,false),
  ('secundaria','MUS-106',3,'Concierto y evaluación','Presentación de conjunto y evaluación del trimestre.',1,true),
  ('secundaria','ART-107',1,'Dibujo artístico y perspectiva','Sombreado, proporción y perspectiva básica.',3,false),
  ('secundaria','ART-107',2,'Pintura, muralismo y arte originario','Técnicas pictóricas y iconografía de los pueblos.',3,false),
  ('secundaria','ART-107',3,'Exposición y evaluación','Mural de curso y evaluación del trimestre.',1,true)
)
INSERT INTO "malla_temas"
  ("nivel", "grado", "materia_id", "unidad", "titulo", "contenidos", "horas_previstas", "es_evaluacion", "orden")
SELECT gm."nivel", gm."grado", m.id, t.unidad, t.titulo, t.contenidos, t.horas, t.es_eval, t.unidad
FROM temas t
JOIN "materias" m ON m.codigo = t.codigo
JOIN "grado_materias" gm ON gm."materia_id" = m.id AND gm."nivel" = t.ciclo
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

-- Cursos del período (todos en turno mañana 07:00 a 12:00)
INSERT INTO "cursos_periodo" ("curso_id", "periodo_id", "capacidad_maxima", "turno_id", "estado")
SELECT c."id", p."id", c."capacidad_maxima", tm."id", 'activo'
FROM "cursos" c
CROSS JOIN tmp_periodo p
CROSS JOIN (SELECT "id" FROM "turnos" WHERE "codigo" = 'manana') tm
WHERE c."activo"
ON CONFLICT ("curso_id", "periodo_id") DO UPDATE SET
  "capacidad_maxima" = EXCLUDED."capacidad_maxima",
  "turno_id" = EXCLUDED."turno_id", "estado" = 'activo';

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


-- Credenciales de prueba: contrasena Shalom2026 (hash bcrypt compatible con ServiceUser).
-- Los usernames se generan con la misma regla de ServiceUser/utils/username.ts:
-- 2 letras apellido paterno + 2 apellido materno + 2 nombre + CI + checksum.
CREATE TEMP TABLE tmp_personas (
  rol text NOT NULL,
  nombre text NOT NULL,
  apellido_paterno text NOT NULL,
  apellido_materno text NOT NULL,
  nacimiento date NOT NULL,
  genero text NOT NULL,
  ci text NOT NULL,
  especialidad text,
  paralelo text
);

CREATE OR REPLACE FUNCTION pg_temp.limpiar_nombre_usuario(valor text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(regexp_replace(
    translate(coalesce(valor, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'),
    '[^a-zA-Z]', '', 'g'
  ))
$$;

CREATE OR REPLACE FUNCTION pg_temp.digito_control_usuario(total integer)
RETURNS integer LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  resultado integer := abs(total);
BEGIN
  WHILE resultado >= 10 LOOP
    resultado := (resultado / 10) + (resultado % 10);
    IF resultado >= 10 THEN
      resultado := (resultado / 10) + (resultado % 10);
    END IF;
  END LOOP;
  RETURN resultado;
END
$$;

CREATE OR REPLACE FUNCTION pg_temp.generar_username(
  nombre text, apellido_paterno text, apellido_materno text, ci text
) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  nom text := pg_temp.limpiar_nombre_usuario(nombre);
  pat text := pg_temp.limpiar_nombre_usuario(apellido_paterno);
  mat text := pg_temp.limpiar_nombre_usuario(apellido_materno);
  ap_pat text;
  ap_mat text;
  nom_dos text;
  digitos text := regexp_replace(coalesce(ci, ''), '[^0-9]', '', 'g');
  ci_inicio text := '10';
  ci_final text := '25';
  checksum integer := 7;
  hash_num integer;
BEGIN
  IF nom = '' AND pat = '' THEN RETURN ''; END IF;
  ap_pat := CASE WHEN length(pat) >= 2 THEN left(pat, 2)
                 WHEN length(pat) = 1 THEN pat || coalesce(left(nom, 1), 'a')
                 ELSE coalesce(left(nom, 2), 'sh') END;
  ap_mat := CASE WHEN length(mat) >= 2 THEN left(mat, 2)
                 WHEN length(pat) > 2 THEN substr(pat, 3, 2)
                 ELSE 'sh' END;
  nom_dos := CASE WHEN length(nom) >= 2 THEN left(nom, 2)
                  WHEN length(nom) = 1 THEN nom || coalesce(left(pat, 1), 'a')
                  ELSE coalesce(left(pat, 2), 'sh') END;
  IF length(digitos) >= 4 THEN
    ci_inicio := left(digitos, 2);
    ci_final := right(digitos, 2);
    checksum := pg_temp.digito_control_usuario(
      substr(ci_inicio, 1, 1)::integer + substr(ci_inicio, 2, 1)::integer +
      substr(ci_final, 1, 1)::integer + substr(ci_final, 2, 1)::integer
    );
  ELSIF length(digitos) > 0 THEN
    ci_inicio := rpad(digitos, 2, '1');
    ci_final := lpad(digitos, 2, '2');
    checksum := pg_temp.digito_control_usuario(
      substr(ci_inicio, 1, 1)::integer + substr(ci_final, 1, 1)::integer
    );
  ELSE
    hash_num := (length(nom) * 13 + length(pat) * 7 + greatest(length(mat), 3)) % 90 + 10;
    ci_inicio := hash_num::text;
    ci_final := (99 - hash_num)::text;
    checksum := pg_temp.digito_control_usuario(hash_num);
  END IF;
  RETURN ap_pat || ap_mat || nom_dos || ci_inicio || ci_final || checksum::text;
END
$$;

INSERT INTO tmp_personas
  (rol, nombre, apellido_paterno, apellido_materno, nacimiento, genero, ci, especialidad, paralelo)
VALUES
  ('director', 'Ramiro', 'Vargas', 'Flores', DATE '1978-04-20', 'masculino', '71030001', NULL, NULL),
  ('control', 'Elena', 'Ribera', 'Ortiz', DATE '1988-03-14', 'femenino', '71030002', NULL, NULL),
  ('profesor', 'Claudia', 'Apaza', 'Lozano', DATE '1988-06-12', 'femenino', '73020001', 'LEN-101', NULL),
  ('profesor', 'Nina', 'Callisaya', 'Huanca', DATE '1990-02-27', 'femenino', '73020002', 'LIG-102', NULL),
  ('profesor', 'Veronica', 'Aliaga', 'Zeballos', DATE '1991-07-08', 'femenino', '73020003', 'LEX-103', NULL),
  ('profesor', 'Marisol', 'Ccahuana', 'Bustamante', DATE '1989-12-01', 'femenino', '73020004', 'CSO-104', NULL),
  ('profesor', 'Danilo', 'Chavez', 'Ordonez', DATE '1992-03-30', 'masculino', '73020005', 'EFI-105', NULL),
  ('profesor', 'Renzo', 'Caceres', 'Daza', DATE '1991-04-09', 'masculino', '73020006', 'ART-107', NULL),
  ('profesor', 'Guido', 'Tola', 'Mamani', DATE '1986-11-11', 'masculino', '73020007', 'VER-201', NULL),
  ('profesor', 'Bruno', 'Colque', 'Mamani', DATE '1985-07-07', 'masculino', '73020008', 'CNT-301', NULL),
  ('profesor', 'Gabriel', 'Quisbert', 'Antezana', DATE '1988-12-29', 'masculino', '73020009', 'BIO-302', NULL),
  ('profesor', 'Erick', 'Choque', 'Zambrano', DATE '1990-10-24', 'masculino', '73020010', 'FIS-303', NULL),
  ('profesor', 'Homero', 'Chuquimarca', 'Mamani', DATE '1987-06-11', 'masculino', '73020011', 'QUI-304', NULL),
  ('profesor', 'Zenon', 'Apaza', 'Kallisaya', DATE '1984-01-28', 'masculino', '73020012', 'MAT-401', NULL),
  ('estudiante', 'Ana', 'Luna', 'Flores', DATE '2012-03-12', 'femenino', '74010001', NULL, 'A'),
  ('estudiante', 'Bruno', 'Rojas', 'Paredes', DATE '2012-05-03', 'masculino', '74010002', NULL, 'A'),
  ('estudiante', 'Carla', 'Salas', 'Terceros', DATE '2012-08-21', 'femenino', '74010003', NULL, 'A'),
  ('estudiante', 'Diego', 'Poma', 'Vargas', DATE '2012-01-16', 'masculino', '74010004', NULL, 'A'),
  ('estudiante', 'Elisa', 'Quispe', 'Rocha', DATE '2012-11-09', 'femenino', '74010005', NULL, 'A'),
  ('estudiante', 'Fabio', 'Condori', 'Nina', DATE '2012-07-30', 'masculino', '74010006', NULL, 'A'),
  ('estudiante', 'Gabriela', 'Vega', 'Rojas', DATE '2012-02-04', 'femenino', '74010007', NULL, 'B'),
  ('estudiante', 'Hugo', 'Calle', 'Flores', DATE '2012-09-18', 'masculino', '74010008', NULL, 'B'),
  ('estudiante', 'Ines', 'Mamani', 'Paredes', DATE '2012-04-26', 'femenino', '74010009', NULL, 'B'),
  ('estudiante', 'Javier', 'Apaza', 'Roca', DATE '2012-06-15', 'masculino', '74010010', NULL, 'B'),
  ('estudiante', 'Karen', 'Choque', 'Soria', DATE '2012-10-02', 'femenino', '74010011', NULL, 'B'),
  ('estudiante', 'Luis', 'Tola', 'Mercado', DATE '2012-12-07', 'masculino', '74010012', NULL, 'B');

CREATE TEMP TABLE tmp_cuentas ON COMMIT PRESERVE ROWS AS
SELECT pg_temp.generar_username(nombre, apellido_paterno, apellido_materno, ci) AS username,
       p.*
FROM tmp_personas p;
ALTER TABLE tmp_cuentas ADD PRIMARY KEY (username);

INSERT INTO "usuarios"
  ("rol_id", "nombre", "apellido_paterno", "apellido_materno", "nacimiento", "genero", "estado")
SELECT r."id", c.nombre, c.apellido_paterno, c.apellido_materno, c.nacimiento, c.genero, 'activo'
FROM tmp_cuentas c
JOIN "roles" r ON r."rol" = c.rol
ORDER BY c.username;

CREATE TEMP TABLE tmp_usuario_ids ON COMMIT PRESERVE ROWS AS
SELECT c.username, u.id AS usuario_id
FROM tmp_cuentas c
JOIN "roles" r ON r.rol = c.rol
JOIN "usuarios" u ON u.rol_id = r.id
  AND u.nombre = c.nombre
  AND u.apellido_paterno = c.apellido_paterno
  AND u.apellido_materno = c.apellido_materno;

INSERT INTO "usuario_cuenta"
  ("usuario_id", "username", "email", "password_hash", "email_verificado",
   "primer_login", "datos_personales_actualizados", "contacto_tutor_actualizado", "password_actualizado")
SELECT ui.usuario_id, c.username, c.username || '@shalom.edu.bo',
       '$2a$12$C9nSW/5Mi5KlhQYiFnK59OWnacZJlA5.h.bfoNAlYKTv28yIwDtAe',
       true, false, true, true, true
FROM tmp_cuentas c
JOIN tmp_usuario_ids ui USING (username);

INSERT INTO "usuario_documentos" ("usuario_id", "tipo_doc", "numero_doc")
SELECT ui.usuario_id, 'CI', c.ci FROM tmp_cuentas c JOIN tmp_usuario_ids ui USING (username);
INSERT INTO "usuario_direcciones" ("usuario_id", "zona", "distrito", "calle", "numero", "referencia")
SELECT ui.usuario_id, 'Villa Adela', 'Distrito 3', 'Calle de prueba', c.ci, 'Domicilio de datos de prueba'
FROM tmp_cuentas c JOIN tmp_usuario_ids ui USING (username);
INSERT INTO "usuario_contactos" ("usuario_id", "tipo", "contenido", "principal")
SELECT ui.usuario_id, 'telefono', '+5917' || right(c.ci, 8), true
FROM tmp_cuentas c JOIN tmp_usuario_ids ui USING (username);

INSERT INTO "maestros" ("usuario_id", "especialidad", "fecha_contratacion", "materias_configuradas", "estado")
SELECT ui.usuario_id, m.nombre, DATE '2020-02-01', true, 'activo'
FROM tmp_cuentas c
JOIN tmp_usuario_ids ui USING (username)
JOIN "materias" m ON m.codigo = c.especialidad
WHERE c.rol = 'profesor';

CREATE TEMP TABLE tmp_maestros ON COMMIT PRESERVE ROWS AS
SELECT c.username, ms.id AS maestro_id, m.id AS materia_id, m.codigo
FROM tmp_cuentas c
JOIN tmp_usuario_ids ui USING (username)
JOIN "maestros" ms ON ms.usuario_id = ui.usuario_id
JOIN "materias" m ON m.codigo = c.especialidad
WHERE c.rol = 'profesor';

INSERT INTO "maestro_materias" ("maestro_id", "materia_id")
SELECT maestro_id, materia_id FROM tmp_maestros;

INSERT INTO "estudiantes"
  ("usuario_id", "fecha_ingreso", "tutor_nombre", "tutor_telefono", "tutor_parentesco", "estado")
SELECT ui.usuario_id, DATE '2026-02-02', 'Familia de ' || c.nombre, '+59170000000', 'Madre', 'activo'
FROM tmp_cuentas c JOIN tmp_usuario_ids ui USING (username)
WHERE c.rol = 'estudiante';

CREATE TEMP TABLE tmp_estudiantes ON COMMIT PRESERVE ROWS AS
SELECT c.username, c.paralelo, ui.usuario_id, e.id AS estudiante_id,
       c.nombre, c.apellido_paterno, c.apellido_materno
FROM tmp_cuentas c
JOIN tmp_usuario_ids ui USING (username)
JOIN "estudiantes" e ON e.usuario_id = ui.usuario_id
WHERE c.rol = 'estudiante';

INSERT INTO "inscripciones"
  ("estudiante_id", "curso_periodo_id", "periodo_id", "origen", "fecha_inscripcion", "estado", "observacion")
SELECT e.estudiante_id, cp.id, cp.periodo_id, 'nueva', DATE '2026-02-02', 'activo', 'Inscripcion de prueba - 1ro de secundaria'
FROM tmp_estudiantes e
JOIN "cursos" c ON c.nivel = 'secundaria' AND c.grado = '1°' AND c.paralelo = e.paralelo
JOIN "cursos_periodo" cp ON cp.curso_id = c.id AND cp.periodo_id = (SELECT id FROM tmp_periodo);

INSERT INTO "asignaciones_docentes" ("maestro_id", "materia_id", "curso_periodo_id", "estado", "fecha_asignacion")
SELECT tm.maestro_id, tm.materia_id, cp.id, 'activo', DATE '2026-02-02'
FROM tmp_maestros tm
JOIN "grado_materias" gm ON gm.materia_id = tm.materia_id AND gm.nivel = 'secundaria' AND gm.grado = '1°'
JOIN "cursos_periodo" cp ON cp.periodo_id = (SELECT id FROM tmp_periodo)
JOIN "cursos" c ON c.id = cp.curso_id AND c.nivel = 'secundaria' AND c.grado = '1°' AND c.paralelo IN ('A', 'B');

-- Una evaluacion cerrada por trimestre y materia/curso; genera notas visibles en los tres trimestres.
INSERT INTO "encargos"
  ("asignacion_id", "tipo", "titulo", "descripcion", "ponderacion", "fecha_publicacion", "fecha_limite", "estado")
SELECT ad.id, 'Examen', 'Evaluacion de prueba T' || t.numero,
       'Evaluacion de prueba para datos academicos.', 100,
       (t.inicio + 10)::timestamptz, (t.inicio + 14)::timestamptz, 'cerrado'
FROM "asignaciones_docentes" ad
JOIN "cursos_periodo" cp ON cp.id = ad.curso_periodo_id
JOIN "trimestres" t ON t.periodo_id = cp.periodo_id;

INSERT INTO "calificaciones" ("encargo_id", "estudiante_id", "nota", "fecha_calificacion")
SELECT en.id, i.estudiante_id,
       (60 + ((i.estudiante_id * 7 + ad.id * 3 + t.numero * 11) % 36))::numeric(5,2),
       en.fecha_publicacion + interval '14 days'
FROM "encargos" en
JOIN "asignaciones_docentes" ad ON ad.id = en.asignacion_id
JOIN "cursos_periodo" cp ON cp.id = ad.curso_periodo_id
JOIN "trimestres" t ON t.periodo_id = cp.periodo_id
  AND en.titulo = 'Evaluacion de prueba T' || t.numero
JOIN "inscripciones" i ON i.curso_periodo_id = cp.id AND i.estado = 'activo';

INSERT INTO "asistencia" ("estudiante_id", "asignacion_id", "fecha", "estado", "justificacion")
SELECT i.estudiante_id, ad.id, t.inicio + dias.dia,
       CASE WHEN (i.estudiante_id + ad.id + t.numero + dias.dia) % 11 = 0 THEN 'ausente'
            WHEN (i.estudiante_id + ad.id + t.numero + dias.dia) % 7 = 0 THEN 'atraso'
            ELSE 'presente' END,
       CASE WHEN (i.estudiante_id + ad.id + t.numero + dias.dia) % 11 = 0 THEN 'Ausencia de prueba' ELSE NULL END
FROM "asignaciones_docentes" ad
JOIN "cursos_periodo" cp ON cp.id = ad.curso_periodo_id
JOIN "trimestres" t ON t.periodo_id = cp.periodo_id
JOIN "inscripciones" i ON i.curso_periodo_id = cp.id AND i.estado = 'activo'
CROSS JOIN (VALUES (5), (12), (19)) AS dias(dia);

COMMIT;

SELECT r.rol, uc.username, uc.email
FROM "usuario_cuenta" uc
JOIN "usuarios" u ON u.id = uc.usuario_id
JOIN "roles" r ON r.id = u.rol_id
ORDER BY CASE r.rol WHEN 'director' THEN 1 WHEN 'control' THEN 2 WHEN 'profesor' THEN 3 ELSE 4 END,
         uc.username;


-- Copia las filas de esta consulta a Esquems/datos_gamificacion.sql,
-- en el bloque INSERT INTO tmp_gm_seed indicado allí.
SELECT string_agg(
         format('(%s, %s, %s, %L, %L, %L)', u.id, e.id, cp.id,
                c.paralelo, u.nombre, u.apellido_paterno),
         E',\n' ORDER BY c.paralelo, u.apellido_paterno, u.nombre
       ) AS filas_para_gamificacion
FROM "estudiantes" e
JOIN "usuarios" u ON u.id = e.usuario_id
JOIN "inscripciones" i ON i.estudiante_id = e.id AND i.estado = 'activo'
JOIN "cursos_periodo" cp ON cp.id = i.curso_periodo_id
JOIN "cursos" c ON c.id = cp.curso_id
WHERE c.nivel = 'secundaria' AND c.grado = '1°' AND c.paralelo IN ('A', 'B');
