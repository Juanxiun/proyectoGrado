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

-- Dirección, control, gerencia y apoderados
INSERT INTO tmp_cuentas (username, rol_id, nombre, apellido_paterno, apellido_materno, nacimiento, genero, especialidad) VALUES
  ('director01',  1, 'Ramiro',   'Vargas',     'Flores',   DATE '1978-04-20', 'masculino', NULL),
  ('director02',  1, 'Carmen',   'Rojas',      'Torrez',   DATE '1982-09-11', 'femenino',  NULL),
  ('control01',   4, 'Elena',    'Ribera',     'Ortiz',    DATE '1988-03-14', 'femenino',  NULL),
  ('control02',   4, 'Marcelo',  'Quiroga',    'Céspedes', DATE '1990-07-22', 'masculino', NULL),
  ('control03',   4, 'Silvana',  'Ayoví',      'Terceros', DATE '1992-11-05', 'femenino',  NULL),
  ('gerencia01', 10, 'Rodrigo',  'Sanzetenea', 'Vargas',   DATE '1985-05-30', 'masculino', NULL),
  ('gerencia02', 10, 'Patricia', 'Mendoza',    'Loayza',   DATE '1987-09-18', 'femenino',  NULL),
  ('apoder01',    9, 'Jorge',    'Chumacero',  'Nina',     DATE '1983-01-25', 'masculino', NULL),
  ('apoder02',    9, 'Lourdes',  'Poma',       'Choque',   DATE '1986-04-11', 'femenino',  NULL),
  ('apoder03',    9, 'Wilson',   'Apaza',      'Mamani',   DATE '1984-12-02', 'masculino', NULL),
  ('apoder04',    9, 'Yeni',     'Condori',    'Rojas',    DATE '1989-08-19', 'femenino',  NULL),
  ('apoder05',    9, 'Freddy',   'Mamani',     'Quispe',   DATE '1981-06-30', 'masculino', NULL),
  ('apoder06',    9, 'Rosa',     'Flores',     'Condori',  DATE '1987-02-14', 'femenino',  NULL),
  ('apoder07',    9, 'Edwin',    'Quispe',     'Huanca',   DATE '1985-10-08', 'masculino', NULL),
  ('apoder08',    9, 'Maribel',  'Ticona',     'Apaza',    DATE '1990-05-27', 'femenino',  NULL),
  ('apoder09',    9, 'Grover',   'Siñani',     'Mamani',   DATE '1983-07-19', 'masculino', NULL),
  ('apoder10',    9, 'Delia',    'Choque',     'Callisaya',DATE '1988-12-03', 'femenino',  NULL),
  ('apoder11',    9, 'Rubén',    'Calle',      'Yujra',    DATE '1986-03-22', 'masculino', NULL),
  ('apoder12',    9, 'Nelly',    'Gutiérrez',  'Poma',     DATE '1991-08-15', 'femenino',  NULL);

-- Docentes (dos por materia para cubrir paralelos A y B)
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

-- Estudiantes: 20 por cada uno de los 24 cursos (480 inscritos)
DROP TABLE IF EXISTS tmp_destino;
CREATE TEMP TABLE tmp_destino ON COMMIT DROP AS
WITH orden AS (
  SELECT c."id" AS curso_id, c."nivel", c."grado",
         row_number() OVER (ORDER BY c."id") AS pos
  FROM "cursos" c
  WHERE c."activo"
)
SELECT o.curso_id, o."nivel", o."grado", s.n,
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
         'Zulma','Ariadna','Benjamin','Ciro','Dayana','Emilio'])[((d.n - 1) % 30) + 1],
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

-- Postulantes en reserva (sin inscripcion todavia)
INSERT INTO tmp_cuentas (username, rol_id, nombre, apellido_paterno, apellido_materno, nacimiento, genero, especialidad) VALUES
  ('est0481', 3, 'Thiago', 'Ramos',   'Vargas',  DATE '2019-05-10', 'masculino', NULL),
  ('est0482', 3, 'Aitana', 'Mercado', 'Flores',  DATE '2019-08-22', 'femenino',  NULL),
  ('est0483', 3, 'Dylan',  'Soruco',  'Mendez',  DATE '2020-01-15', 'masculino', NULL),
  ('est0484', 3, 'Alba',   'Roca',    'Justiniano', DATE '2019-11-30', 'femenino',  NULL);

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
  ('apoder03','Agricultor'),  ('apoder04','Enfermera'),
  ('apoder05','Albañil'),     ('apoder06','Costurera'),
  ('apoder07','Chofer'),      ('apoder08','Contadora'),
  ('apoder09','Carpintero'),  ('apoder10','Vendedora'),
  ('apoder11','Electricista'),('apoder12','Cocinera')
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
       (ARRAY['Villa Fatima','Zona Central','Alto Lima','Barrio San Juan','Villa Productiva'])[((u."id" % 5)) + 1],
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

-- Relación estudiante-apoderado (reparto entre los 12 apoderados)
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
JOIN tmp_apoderados a ON a.idx = ((e_n.n - 1) % 12) + 1
ON CONFLICT ("estudiante_id", "apoderado_id") DO NOTHING;

-- Inscripciones: cada estudiante va al curso que le toco en tmp_destino
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
JOIN tmp_destino d ON d.n = e_n.n
JOIN "cursos_periodo" cp ON cp."curso_id" = d.curso_id
                        AND cp."periodo_id" = (SELECT "id" FROM tmp_periodo)
ON CONFLICT ("estudiante_id", "curso_periodo_id") DO UPDATE SET "estado" = 'activo';

-- Solicitudes de inscripción (promociones aprobadas y reservas pendientes)
INSERT INTO "solicitudes_inscripcion"
  ("estudiante_id", "periodo_id", "curso_periodo_destino_id", "tipo", "estado", "motivo", "solicitante_id", "procesado_por", "fecha_solicitud", "fecha_proceso", "observacion")
SELECT e."id", (SELECT "id" FROM tmp_periodo), cp."id", v.tipo, v.estado, v.motivo,
       sol."id", proc."id", v.fs::timestamptz, v.fp::timestamptz, v.obs
FROM (VALUES
  ('est0201', 'secundaria', '1°', 'A', 'promocion', 'aprobada',  'Promoción de 6° de primaria', 'control01', 'control01', '2025-12-10 09:00:00-04', '2025-12-15 10:00:00-04', 'Promoción de fin de gestión'),
  ('est0202', 'secundaria', '1°', 'A', 'promocion', 'aprobada',  'Promoción de 6° de primaria', 'control01', 'control01', '2025-12-10 09:10:00-04', '2025-12-15 10:05:00-04', 'Promoción de fin de gestión'),
  ('est0221', 'secundaria', '1°', 'B', 'promocion', 'aprobada',  'Promoción de 6° de primaria', 'control01', 'control01', '2025-12-10 09:20:00-04', '2025-12-15 10:10:00-04', 'Promoción de fin de gestión'),
  ('est0222', 'secundaria', '1°', 'B', 'promocion', 'aprobada',  'Promoción de 6° de primaria', 'control01', 'control01', '2025-12-10 09:30:00-04', '2025-12-15 10:15:00-04', 'Promoción de fin de gestión'),
  ('est0241', 'secundaria', '2°', 'A', 'promocion', 'rechazada', 'Promoción anticipada de curso', 'control01', 'control01', '2026-03-05 09:00:00-04', '2026-03-08 10:00:00-04', 'No cumple requisito de edad'),
  ('est0481', 'primaria',   '1°', 'A', 'reserva',   'pendiente', 'Reserva de cupo 1° de primaria', 'apoder05', NULL,        '2026-09-20 09:00:00-04', NULL, 'En espera de verificación de documentos'),
  ('est0482', 'primaria',   '1°', 'A', 'reserva',   'pendiente', 'Reserva de cupo 1° de primaria', 'apoder06', NULL,        '2026-09-22 09:00:00-04', NULL, 'En espera de verificación de documentos'),
  ('est0483', 'primaria',   '1°', 'B', 'reserva',   'pendiente', 'Reserva de cupo 1° de primaria', 'apoder07', NULL,        '2026-09-25 09:00:00-04', NULL, 'En espera de verificación de documentos'),
  ('est0484', 'primaria',   '1°', 'B', 'reserva',   'pendiente', 'Reserva de cupo 1° de primaria', 'apoder08', NULL,        '2026-09-28 09:00:00-04', NULL, 'En espera de verificación de documentos')
) AS v(username, nivel, grado, paralelo, tipo, estado, motivo, solicitante, procesado, fs, fp, obs)
JOIN "usuario_cuenta" uc ON uc."username" = v.username
JOIN "estudiantes" e ON e."usuario_id" = uc."usuario_id"
JOIN "cursos" c ON c."nivel" = v.nivel AND c."grado" = v.grado AND c."paralelo" = v.paralelo
JOIN "cursos_periodo" cp ON cp."curso_id" = c."id" AND cp."periodo_id" = (SELECT "id" FROM tmp_periodo)
JOIN "usuarios" sol ON sol."id" = (SELECT u2."id" FROM "usuario_cuenta" x JOIN "usuarios" u2 ON u2."id" = x."usuario_id" WHERE x."username" = v.solicitante)
LEFT JOIN "usuarios" proc ON v.procesado IS NOT NULL AND proc."id" = (SELECT u3."id" FROM "usuario_cuenta" y JOIN "usuarios" u3 ON u3."id" = y."usuario_id" WHERE y."username" = v.procesado)
WHERE NOT EXISTS (
  SELECT 1 FROM "solicitudes_inscripcion" s
  WHERE s."estudiante_id" = e."id" AND s."curso_periodo_destino_id" = cp."id" AND s."tipo" = v.tipo
);

CREATE TEMP TABLE tmp_inscripciones ON COMMIT DROP AS
SELECT i."estudiante_id", i."curso_periodo_id", i."periodo_id",
       (substring(uc."username" from 4))::int AS n
FROM "inscripciones" i
JOIN "estudiantes" e ON e."id" = i."estudiante_id"
JOIN "usuario_cuenta" uc ON uc."usuario_id" = e."usuario_id"
WHERE i."estado" = 'activo' AND i."periodo_id" = (SELECT "id" FROM tmp_periodo)
  AND uc."username" ~ '^est[0-9]{4}$';

-- Perfiles de seguimiento: bajo 10%, regular 20%, estandar 10%, excelente 60%
CREATE TEMP TABLE tmp_perfiles ON COMMIT DROP AS
SELECT e_n.n,
       e_n."estudiante_id",
       CASE
         WHEN e_n.n % 20 IN (0, 1)       THEN 'bajo'
         WHEN e_n.n % 20 IN (2, 3, 4, 5) THEN 'regular'
         WHEN e_n.n % 20 IN (6, 7)       THEN 'estandar'
         ELSE 'excelente'
       END AS perfil
FROM (
  SELECT e."id" AS "estudiante_id", (substring(uc."username" from 4))::int AS n
  FROM "estudiantes" e
  JOIN "usuario_cuenta" uc ON uc."usuario_id" = e."usuario_id"
  WHERE uc."username" ~ '^est[0-9]{4}$'
) e_n;

-- Asignaciones docentes (paralelo A con el primer docente, B con el segundo)
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

-- Asesor de curso (primer docente asignado del curso)
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

-- Horarios 07:00 a 12:00 (22 bloques por curso, turno manana, sin choques)
-- Aula fija por curso (una por cada curso del periodo)
CREATE TEMP TABLE tmp_aula_curso ON COMMIT DROP AS
SELECT cp."id" AS curso_periodo_id, a."id" AS aula_id
FROM (SELECT cp."id", row_number() OVER (ORDER BY cp."id") AS rn
      FROM "cursos_periodo" cp WHERE cp."periodo_id" = (SELECT "id" FROM tmp_periodo)) cp
JOIN (SELECT a."id", row_number() OVER (ORDER BY a."codigo") AS rn
      FROM "aulas" a WHERE a."codigo" NOT IN ('LAB-1', 'TALL-1', 'AUD-1')) a ON a.rn = cp.rn;

INSERT INTO "horarios"
  ("curso_periodo_id", "materia_id", "asignacion_id", "maestro_id", "aula_id", "turno_id",
   "dia_semana", "hora_inicio", "hora_fin")
SELECT cp."id", m."id", ad."id", ad."maestro_id",
       ac.aula_id, cp."turno_id", v.dia, v.hi::time, v.hf::time
FROM (VALUES
  ('primaria','1°','A','ART-107',2,'07:45','08:30'),
  ('primaria','1°','A','ART-107',5,'07:45','08:30'),
  ('primaria','1°','A','CNT-301',1,'10:45','11:30'),
  ('primaria','1°','A','CNT-301',4,'10:45','11:30'),
  ('primaria','1°','A','CSO-104',1,'08:30','09:15'),
  ('primaria','1°','A','CSO-104',2,'10:00','10:45'),
  ('primaria','1°','A','EFI-105',3,'10:00','10:45'),
  ('primaria','1°','A','EFI-105',4,'08:30','09:15'),
  ('primaria','1°','A','LEN-101',3,'07:45','08:30'),
  ('primaria','1°','A','LEN-101',4,'10:00','10:45'),
  ('primaria','1°','A','LEX-103',1,'10:00','10:45'),
  ('primaria','1°','A','LEX-103',3,'08:30','09:15'),
  ('primaria','1°','A','LIG-102',5,'07:00','07:45'),
  ('primaria','1°','A','LIG-102',5,'08:30','09:15'),
  ('primaria','1°','A','MAT-401',4,'07:45','08:30'),
  ('primaria','1°','A','MAT-401',5,'10:45','11:30'),
  ('primaria','1°','A','MUS-106',1,'07:00','07:45'),
  ('primaria','1°','A','MUS-106',5,'10:00','10:45'),
  ('primaria','1°','A','TTG-402',1,'07:45','08:30'),
  ('primaria','1°','A','TTG-402',3,'07:00','07:45'),
  ('primaria','1°','A','VER-201',2,'07:00','07:45'),
  ('primaria','1°','A','VER-201',3,'10:45','11:30'),
  ('primaria','1°','B','ART-107',1,'10:45','11:30'),
  ('primaria','1°','B','ART-107',2,'10:00','10:45'),
  ('primaria','1°','B','CNT-301',4,'10:00','10:45'),
  ('primaria','1°','B','CNT-301',4,'10:45','11:30'),
  ('primaria','1°','B','CSO-104',3,'07:00','07:45'),
  ('primaria','1°','B','CSO-104',3,'10:45','11:30'),
  ('primaria','1°','B','EFI-105',1,'07:00','07:45'),
  ('primaria','1°','B','EFI-105',5,'07:00','07:45'),
  ('primaria','1°','B','LEN-101',4,'07:45','08:30'),
  ('primaria','1°','B','LEN-101',5,'10:45','11:30'),
  ('primaria','1°','B','LEX-103',1,'08:30','09:15'),
  ('primaria','1°','B','LEX-103',3,'07:45','08:30'),
  ('primaria','1°','B','LIG-102',2,'07:00','07:45'),
  ('primaria','1°','B','LIG-102',5,'07:45','08:30'),
  ('primaria','1°','B','MAT-401',1,'10:00','10:45'),
  ('primaria','1°','B','MAT-401',4,'07:00','07:45'),
  ('primaria','1°','B','MUS-106',4,'08:30','09:15'),
  ('primaria','1°','B','MUS-106',5,'08:30','09:15'),
  ('primaria','1°','B','TTG-402',2,'07:45','08:30'),
  ('primaria','1°','B','TTG-402',3,'10:00','10:45'),
  ('primaria','1°','B','VER-201',1,'07:45','08:30'),
  ('primaria','1°','B','VER-201',5,'10:00','10:45'),
  ('primaria','2°','A','ART-107',1,'07:45','08:30'),
  ('primaria','2°','A','ART-107',3,'07:45','08:30'),
  ('primaria','2°','A','CNT-301',4,'07:45','08:30'),
  ('primaria','2°','A','CNT-301',4,'10:00','10:45'),
  ('primaria','2°','A','CSO-104',1,'10:00','10:45'),
  ('primaria','2°','A','CSO-104',3,'08:30','09:15'),
  ('primaria','2°','A','EFI-105',2,'07:00','07:45'),
  ('primaria','2°','A','EFI-105',2,'10:00','10:45'),
  ('primaria','2°','A','LEN-101',2,'08:30','09:15'),
  ('primaria','2°','A','LEN-101',4,'08:30','09:15'),
  ('primaria','2°','A','LEX-103',1,'10:45','11:30'),
  ('primaria','2°','A','LEX-103',5,'07:45','08:30'),
  ('primaria','2°','A','LIG-102',2,'07:45','08:30'),
  ('primaria','2°','A','LIG-102',3,'07:00','07:45'),
  ('primaria','2°','A','MAT-401',3,'10:45','11:30'),
  ('primaria','2°','A','MAT-401',5,'08:30','09:15'),
  ('primaria','2°','A','MUS-106',3,'10:00','10:45'),
  ('primaria','2°','A','MUS-106',5,'07:00','07:45'),
  ('primaria','2°','A','TTG-402',1,'07:00','07:45'),
  ('primaria','2°','A','TTG-402',4,'10:45','11:30'),
  ('primaria','2°','A','VER-201',5,'10:00','10:45'),
  ('primaria','2°','A','VER-201',5,'10:45','11:30'),
  ('primaria','2°','B','ART-107',2,'07:00','07:45'),
  ('primaria','2°','B','ART-107',2,'07:45','08:30'),
  ('primaria','2°','B','CNT-301',2,'10:00','10:45'),
  ('primaria','2°','B','CNT-301',3,'07:00','07:45'),
  ('primaria','2°','B','CSO-104',1,'07:00','07:45'),
  ('primaria','2°','B','CSO-104',4,'07:45','08:30'),
  ('primaria','2°','B','EFI-105',3,'10:00','10:45'),
  ('primaria','2°','B','EFI-105',4,'10:45','11:30'),
  ('primaria','2°','B','LEN-101',1,'08:30','09:15'),
  ('primaria','2°','B','LEN-101',1,'10:45','11:30'),
  ('primaria','2°','B','LEX-103',5,'07:00','07:45'),
  ('primaria','2°','B','LEX-103',5,'08:30','09:15'),
  ('primaria','2°','B','LIG-102',1,'10:00','10:45'),
  ('primaria','2°','B','LIG-102',2,'10:45','11:30'),
  ('primaria','2°','B','MAT-401',4,'10:00','10:45'),
  ('primaria','2°','B','MAT-401',5,'10:00','10:45'),
  ('primaria','2°','B','MUS-106',1,'07:45','08:30'),
  ('primaria','2°','B','MUS-106',3,'07:45','08:30'),
  ('primaria','2°','B','TTG-402',4,'08:30','09:15'),
  ('primaria','2°','B','TTG-402',5,'10:45','11:30'),
  ('primaria','2°','B','VER-201',3,'10:45','11:30'),
  ('primaria','2°','B','VER-201',5,'07:45','08:30'),
  ('primaria','3°','A','ART-107',1,'07:00','07:45'),
  ('primaria','3°','A','ART-107',1,'08:30','09:15'),
  ('primaria','3°','A','CNT-301',3,'07:00','07:45'),
  ('primaria','3°','A','CNT-301',5,'10:45','11:30'),
  ('primaria','3°','A','CSO-104',4,'07:00','07:45'),
  ('primaria','3°','A','CSO-104',5,'10:00','10:45'),
  ('primaria','3°','A','EFI-105',1,'10:45','11:30'),
  ('primaria','3°','A','EFI-105',3,'10:45','11:30'),
  ('primaria','3°','A','LEN-101',1,'07:45','08:30'),
  ('primaria','3°','A','LEN-101',5,'08:30','09:15'),
  ('primaria','3°','A','LEX-103',2,'07:00','07:45'),
  ('primaria','3°','A','LEX-103',2,'07:45','08:30'),
  ('primaria','3°','A','LIG-102',4,'08:30','09:15'),
  ('primaria','3°','A','LIG-102',5,'07:45','08:30'),
  ('primaria','3°','A','MAT-401',3,'07:45','08:30'),
  ('primaria','3°','A','MAT-401',5,'07:00','07:45'),
  ('primaria','3°','A','MUS-106',2,'10:00','10:45'),
  ('primaria','3°','A','MUS-106',4,'07:45','08:30'),
  ('primaria','3°','A','TTG-402',3,'10:00','10:45'),
  ('primaria','3°','A','TTG-402',4,'10:00','10:45'),
  ('primaria','3°','A','VER-201',3,'08:30','09:15'),
  ('primaria','3°','A','VER-201',4,'10:45','11:30'),
  ('primaria','3°','B','ART-107',3,'10:00','10:45'),
  ('primaria','3°','B','ART-107',5,'10:45','11:30'),
  ('primaria','3°','B','CNT-301',3,'08:30','09:15'),
  ('primaria','3°','B','CNT-301',4,'07:00','07:45'),
  ('primaria','3°','B','CSO-104',1,'10:45','11:30'),
  ('primaria','3°','B','CSO-104',2,'07:00','07:45'),
  ('primaria','3°','B','EFI-105',4,'08:30','09:15'),
  ('primaria','3°','B','EFI-105',5,'10:00','10:45'),
  ('primaria','3°','B','LEN-101',1,'07:45','08:30'),
  ('primaria','3°','B','LEN-101',2,'07:45','08:30'),
  ('primaria','3°','B','LEX-103',1,'07:00','07:45'),
  ('primaria','3°','B','LEX-103',4,'10:00','10:45'),
  ('primaria','3°','B','LIG-102',1,'08:30','09:15'),
  ('primaria','3°','B','LIG-102',4,'07:45','08:30'),
  ('primaria','3°','B','MAT-401',3,'07:00','07:45'),
  ('primaria','3°','B','MAT-401',3,'07:45','08:30'),
  ('primaria','3°','B','MUS-106',2,'10:00','10:45'),
  ('primaria','3°','B','MUS-106',5,'07:00','07:45'),
  ('primaria','3°','B','TTG-402',3,'10:45','11:30'),
  ('primaria','3°','B','TTG-402',5,'07:45','08:30'),
  ('primaria','3°','B','VER-201',4,'10:45','11:30'),
  ('primaria','3°','B','VER-201',5,'08:30','09:15'),
  ('primaria','4°','A','ART-107',2,'10:00','10:45'),
  ('primaria','4°','A','ART-107',4,'08:30','09:15'),
  ('primaria','4°','A','CNT-301',2,'07:00','07:45'),
  ('primaria','4°','A','CNT-301',3,'08:30','09:15'),
  ('primaria','4°','A','CSO-104',2,'07:45','08:30'),
  ('primaria','4°','A','CSO-104',3,'10:00','10:45'),
  ('primaria','4°','A','EFI-105',4,'07:45','08:30'),
  ('primaria','4°','A','EFI-105',5,'08:30','09:15'),
  ('primaria','4°','A','LEN-101',3,'07:00','07:45'),
  ('primaria','4°','A','LEN-101',5,'10:00','10:45'),
  ('primaria','4°','A','LEX-103',3,'07:45','08:30'),
  ('primaria','4°','A','LEX-103',4,'07:00','07:45'),
  ('primaria','4°','A','LIG-102',1,'07:00','07:45'),
  ('primaria','4°','A','LIG-102',5,'10:45','11:30'),
  ('primaria','4°','A','MAT-401',1,'07:45','08:30'),
  ('primaria','4°','A','MAT-401',1,'10:45','11:30'),
  ('primaria','4°','A','MUS-106',3,'10:45','11:30'),
  ('primaria','4°','A','MUS-106',4,'10:45','11:30'),
  ('primaria','4°','A','TTG-402',5,'07:00','07:45'),
  ('primaria','4°','A','TTG-402',5,'07:45','08:30'),
  ('primaria','4°','A','VER-201',1,'08:30','09:15'),
  ('primaria','4°','A','VER-201',4,'10:00','10:45'),
  ('primaria','4°','B','ART-107',5,'08:30','09:15'),
  ('primaria','4°','B','ART-107',5,'10:00','10:45'),
  ('primaria','4°','B','CNT-301',2,'07:00','07:45'),
  ('primaria','4°','B','CNT-301',3,'07:45','08:30'),
  ('primaria','4°','B','CSO-104',2,'10:00','10:45'),
  ('primaria','4°','B','CSO-104',2,'10:45','11:30'),
  ('primaria','4°','B','EFI-105',1,'08:30','09:15'),
  ('primaria','4°','B','EFI-105',5,'10:45','11:30'),
  ('primaria','4°','B','LEN-101',2,'08:30','09:15'),
  ('primaria','4°','B','LEN-101',4,'07:00','07:45'),
  ('primaria','4°','B','LEX-103',1,'07:45','08:30'),
  ('primaria','4°','B','LEX-103',5,'07:45','08:30'),
  ('primaria','4°','B','LIG-102',3,'07:00','07:45'),
  ('primaria','4°','B','LIG-102',4,'08:30','09:15'),
  ('primaria','4°','B','MAT-401',3,'10:00','10:45'),
  ('primaria','4°','B','MAT-401',4,'10:45','11:30'),
  ('primaria','4°','B','MUS-106',3,'10:45','11:30'),
  ('primaria','4°','B','MUS-106',4,'07:45','08:30'),
  ('primaria','4°','B','TTG-402',4,'10:00','10:45'),
  ('primaria','4°','B','TTG-402',5,'07:00','07:45'),
  ('primaria','4°','B','VER-201',1,'07:00','07:45'),
  ('primaria','4°','B','VER-201',2,'07:45','08:30'),
  ('primaria','5°','A','ART-107',2,'07:00','07:45'),
  ('primaria','5°','A','ART-107',5,'07:00','07:45'),
  ('primaria','5°','A','CNT-301',1,'10:00','10:45'),
  ('primaria','5°','A','CNT-301',2,'07:45','08:30'),
  ('primaria','5°','A','CSO-104',3,'10:45','11:30'),
  ('primaria','5°','A','CSO-104',5,'10:45','11:30'),
  ('primaria','5°','A','EFI-105',1,'07:45','08:30'),
  ('primaria','5°','A','EFI-105',4,'10:45','11:30'),
  ('primaria','5°','A','LEN-101',1,'08:30','09:15'),
  ('primaria','5°','A','LEN-101',2,'10:45','11:30'),
  ('primaria','5°','A','LEX-103',2,'10:00','10:45'),
  ('primaria','5°','A','LEX-103',4,'10:00','10:45'),
  ('primaria','5°','A','LIG-102',3,'07:45','08:30'),
  ('primaria','5°','A','LIG-102',3,'08:30','09:15'),
  ('primaria','5°','A','MAT-401',3,'10:00','10:45'),
  ('primaria','5°','A','MAT-401',5,'10:00','10:45'),
  ('primaria','5°','A','MUS-106',5,'07:45','08:30'),
  ('primaria','5°','A','MUS-106',5,'08:30','09:15'),
  ('primaria','5°','A','TTG-402',4,'07:45','08:30'),
  ('primaria','5°','A','TTG-402',4,'08:30','09:15'),
  ('primaria','5°','A','VER-201',1,'07:00','07:45'),
  ('primaria','5°','A','VER-201',3,'07:00','07:45'),
  ('primaria','5°','B','ART-107',3,'10:45','11:30'),
  ('primaria','5°','B','ART-107',4,'07:45','08:30'),
  ('primaria','5°','B','CNT-301',1,'07:00','07:45'),
  ('primaria','5°','B','CNT-301',1,'10:00','10:45'),
  ('primaria','5°','B','CSO-104',5,'07:00','07:45'),
  ('primaria','5°','B','CSO-104',5,'10:00','10:45'),
  ('primaria','5°','B','EFI-105',1,'07:45','08:30'),
  ('primaria','5°','B','EFI-105',5,'08:30','09:15'),
  ('primaria','5°','B','LEN-101',2,'10:00','10:45'),
  ('primaria','5°','B','LEN-101',3,'08:30','09:15'),
  ('primaria','5°','B','LEX-103',4,'10:45','11:30'),
  ('primaria','5°','B','LEX-103',5,'10:45','11:30'),
  ('primaria','5°','B','LIG-102',1,'10:45','11:30'),
  ('primaria','5°','B','LIG-102',3,'10:00','10:45'),
  ('primaria','5°','B','MAT-401',1,'08:30','09:15'),
  ('primaria','5°','B','MAT-401',5,'07:45','08:30'),
  ('primaria','5°','B','MUS-106',2,'07:45','08:30'),
  ('primaria','5°','B','MUS-106',4,'10:00','10:45'),
  ('primaria','5°','B','TTG-402',2,'07:00','07:45'),
  ('primaria','5°','B','TTG-402',3,'07:45','08:30'),
  ('primaria','5°','B','VER-201',3,'07:00','07:45'),
  ('primaria','5°','B','VER-201',4,'08:30','09:15'),
  ('primaria','6°','A','ART-107',4,'10:45','11:30'),
  ('primaria','6°','A','ART-107',5,'08:30','09:15'),
  ('primaria','6°','A','CNT-301',1,'07:45','08:30'),
  ('primaria','6°','A','CNT-301',3,'10:00','10:45'),
  ('primaria','6°','A','CSO-104',3,'07:45','08:30'),
  ('primaria','6°','A','CSO-104',4,'10:00','10:45'),
  ('primaria','6°','A','EFI-105',1,'07:00','07:45'),
  ('primaria','6°','A','EFI-105',5,'07:45','08:30'),
  ('primaria','6°','A','LEN-101',4,'07:45','08:30'),
  ('primaria','6°','A','LEN-101',5,'10:45','11:30'),
  ('primaria','6°','A','LEX-103',3,'10:45','11:30'),
  ('primaria','6°','A','LEX-103',5,'07:00','07:45'),
  ('primaria','6°','A','LIG-102',2,'10:00','10:45'),
  ('primaria','6°','A','LIG-102',5,'10:00','10:45'),
  ('primaria','6°','A','MAT-401',1,'08:30','09:15'),
  ('primaria','6°','A','MAT-401',2,'08:30','09:15'),
  ('primaria','6°','A','MUS-106',3,'07:00','07:45'),
  ('primaria','6°','A','MUS-106',4,'08:30','09:15'),
  ('primaria','6°','A','TTG-402',2,'07:00','07:45'),
  ('primaria','6°','A','TTG-402',2,'07:45','08:30'),
  ('primaria','6°','A','VER-201',1,'10:00','10:45'),
  ('primaria','6°','A','VER-201',1,'10:45','11:30'),
  ('primaria','6°','B','ART-107',4,'10:00','10:45'),
  ('primaria','6°','B','ART-107',5,'07:00','07:45'),
  ('primaria','6°','B','CNT-301',3,'10:45','11:30'),
  ('primaria','6°','B','CNT-301',5,'07:45','08:30'),
  ('primaria','6°','B','CSO-104',4,'08:30','09:15'),
  ('primaria','6°','B','CSO-104',5,'10:45','11:30'),
  ('primaria','6°','B','EFI-105',4,'07:00','07:45'),
  ('primaria','6°','B','EFI-105',4,'07:45','08:30'),
  ('primaria','6°','B','LEN-101',3,'07:45','08:30'),
  ('primaria','6°','B','LEN-101',3,'10:00','10:45'),
  ('primaria','6°','B','LEX-103',2,'07:45','08:30'),
  ('primaria','6°','B','LEX-103',3,'07:00','07:45'),
  ('primaria','6°','B','LIG-102',5,'08:30','09:15'),
  ('primaria','6°','B','LIG-102',5,'10:00','10:45'),
  ('primaria','6°','B','MAT-401',1,'07:45','08:30'),
  ('primaria','6°','B','MAT-401',2,'10:00','10:45'),
  ('primaria','6°','B','MUS-106',2,'07:00','07:45'),
  ('primaria','6°','B','MUS-106',4,'10:45','11:30'),
  ('primaria','6°','B','TTG-402',1,'07:00','07:45'),
  ('primaria','6°','B','TTG-402',1,'08:30','09:15'),
  ('primaria','6°','B','VER-201',1,'10:45','11:30'),
  ('primaria','6°','B','VER-201',3,'08:30','09:15'),
  ('secundaria','1°','A','ART-107',3,'10:45','11:30'),
  ('secundaria','1°','A','BIO-302',2,'07:45','08:30'),
  ('secundaria','1°','A','BIO-302',5,'10:00','10:45'),
  ('secundaria','1°','A','CNT-301',1,'07:00','07:45'),
  ('secundaria','1°','A','CNT-301',5,'07:00','07:45'),
  ('secundaria','1°','A','CSO-104',3,'07:00','07:45'),
  ('secundaria','1°','A','CSO-104',4,'07:45','08:30'),
  ('secundaria','1°','A','EFI-105',1,'08:30','09:15'),
  ('secundaria','1°','A','FIS-303',3,'07:45','08:30'),
  ('secundaria','1°','A','FIS-303',3,'10:00','10:45'),
  ('secundaria','1°','A','LEN-101',2,'10:00','10:45'),
  ('secundaria','1°','A','LEN-101',5,'07:45','08:30'),
  ('secundaria','1°','A','LEX-103',1,'07:45','08:30'),
  ('secundaria','1°','A','LEX-103',5,'08:30','09:15'),
  ('secundaria','1°','A','LIG-102',1,'10:45','11:30'),
  ('secundaria','1°','A','LIG-102',2,'08:30','09:15'),
  ('secundaria','1°','A','MAT-401',2,'10:45','11:30'),
  ('secundaria','1°','A','MAT-401',4,'10:45','11:30'),
  ('secundaria','1°','A','QUI-304',2,'07:00','07:45'),
  ('secundaria','1°','A','QUI-304',5,'10:45','11:30'),
  ('secundaria','1°','A','VER-201',4,'07:00','07:45'),
  ('secundaria','1°','A','VER-201',4,'08:30','09:15'),
  ('secundaria','1°','B','ART-107',4,'08:30','09:15'),
  ('secundaria','1°','B','BIO-302',2,'07:00','07:45'),
  ('secundaria','1°','B','BIO-302',2,'07:45','08:30'),
  ('secundaria','1°','B','CNT-301',5,'10:00','10:45'),
  ('secundaria','1°','B','CNT-301',5,'10:45','11:30'),
  ('secundaria','1°','B','CSO-104',1,'10:00','10:45'),
  ('secundaria','1°','B','CSO-104',4,'10:00','10:45'),
  ('secundaria','1°','B','EFI-105',3,'07:45','08:30'),
  ('secundaria','1°','B','FIS-303',3,'10:00','10:45'),
  ('secundaria','1°','B','FIS-303',5,'08:30','09:15'),
  ('secundaria','1°','B','LEN-101',3,'07:00','07:45'),
  ('secundaria','1°','B','LEN-101',5,'07:00','07:45'),
  ('secundaria','1°','B','LEX-103',1,'10:45','11:30'),
  ('secundaria','1°','B','LEX-103',4,'07:00','07:45'),
  ('secundaria','1°','B','LIG-102',1,'07:45','08:30'),
  ('secundaria','1°','B','LIG-102',2,'10:00','10:45'),
  ('secundaria','1°','B','MAT-401',1,'07:00','07:45'),
  ('secundaria','1°','B','MAT-401',3,'10:45','11:30'),
  ('secundaria','1°','B','QUI-304',4,'10:45','11:30'),
  ('secundaria','1°','B','QUI-304',5,'07:45','08:30'),
  ('secundaria','1°','B','VER-201',1,'08:30','09:15'),
  ('secundaria','1°','B','VER-201',4,'07:45','08:30'),
  ('secundaria','2°','A','ART-107',3,'10:00','10:45'),
  ('secundaria','2°','A','BIO-302',1,'07:00','07:45'),
  ('secundaria','2°','A','BIO-302',5,'07:00','07:45'),
  ('secundaria','2°','A','CNT-301',4,'07:00','07:45'),
  ('secundaria','2°','A','CNT-301',5,'07:45','08:30'),
  ('secundaria','2°','A','CSO-104',2,'07:00','07:45'),
  ('secundaria','2°','A','CSO-104',5,'08:30','09:15'),
  ('secundaria','2°','A','EFI-105',5,'10:00','10:45'),
  ('secundaria','2°','A','FIL-202',4,'08:30','09:15'),
  ('secundaria','2°','A','FIS-303',1,'07:45','08:30'),
  ('secundaria','2°','A','FIS-303',3,'10:45','11:30'),
  ('secundaria','2°','A','LEN-101',3,'08:30','09:15'),
  ('secundaria','2°','A','LEN-101',4,'10:45','11:30'),
  ('secundaria','2°','A','LEX-103',4,'07:45','08:30'),
  ('secundaria','2°','A','LIG-102',1,'08:30','09:15'),
  ('secundaria','2°','A','MAT-401',1,'10:00','10:45'),
  ('secundaria','2°','A','MAT-401',4,'10:00','10:45'),
  ('secundaria','2°','A','MUS-106',3,'07:45','08:30'),
  ('secundaria','2°','A','QUI-304',2,'10:00','10:45'),
  ('secundaria','2°','A','QUI-304',3,'07:00','07:45'),
  ('secundaria','2°','A','TTG-402',5,'10:45','11:30'),
  ('secundaria','2°','A','VER-201',2,'07:45','08:30'),
  ('secundaria','2°','B','ART-107',3,'07:00','07:45'),
  ('secundaria','2°','B','BIO-302',1,'08:30','09:15'),
  ('secundaria','2°','B','BIO-302',4,'10:45','11:30'),
  ('secundaria','2°','B','CNT-301',4,'08:30','09:15'),
  ('secundaria','2°','B','CNT-301',5,'07:00','07:45'),
  ('secundaria','2°','B','CSO-104',2,'07:45','08:30'),
  ('secundaria','2°','B','CSO-104',5,'07:45','08:30'),
  ('secundaria','2°','B','EFI-105',3,'10:45','11:30'),
  ('secundaria','2°','B','FIL-202',2,'10:00','10:45'),
  ('secundaria','2°','B','FIS-303',1,'10:45','11:30'),
  ('secundaria','2°','B','FIS-303',4,'10:00','10:45'),
  ('secundaria','2°','B','LEN-101',1,'07:00','07:45'),
  ('secundaria','2°','B','LEN-101',5,'08:30','09:15'),
  ('secundaria','2°','B','LEX-103',5,'10:00','10:45'),
  ('secundaria','2°','B','LIG-102',3,'07:45','08:30'),
  ('secundaria','2°','B','MAT-401',2,'07:00','07:45'),
  ('secundaria','2°','B','MAT-401',3,'08:30','09:15'),
  ('secundaria','2°','B','MUS-106',3,'10:00','10:45'),
  ('secundaria','2°','B','QUI-304',1,'07:45','08:30'),
  ('secundaria','2°','B','QUI-304',5,'10:45','11:30'),
  ('secundaria','2°','B','TTG-402',4,'07:45','08:30'),
  ('secundaria','2°','B','VER-201',4,'07:00','07:45'),
  ('secundaria','3°','A','ART-107',5,'10:45','11:30'),
  ('secundaria','3°','A','BIO-302',1,'07:45','08:30'),
  ('secundaria','3°','A','BIO-302',4,'10:00','10:45'),
  ('secundaria','3°','A','CNT-301',1,'08:30','09:15'),
  ('secundaria','3°','A','CNT-301',5,'10:00','10:45'),
  ('secundaria','3°','A','CSO-104',4,'10:45','11:30'),
  ('secundaria','3°','A','CSO-104',5,'07:00','07:45'),
  ('secundaria','3°','A','EFI-105',3,'07:00','07:45'),
  ('secundaria','3°','A','FIL-202',3,'10:00','10:45'),
  ('secundaria','3°','A','FIS-303',2,'10:00','10:45'),
  ('secundaria','3°','A','FIS-303',4,'07:45','08:30'),
  ('secundaria','3°','A','LEN-101',2,'07:00','07:45'),
  ('secundaria','3°','A','LEN-101',3,'10:45','11:30'),
  ('secundaria','3°','A','LEX-103',1,'07:00','07:45'),
  ('secundaria','3°','A','LEX-103',4,'08:30','09:15'),
  ('secundaria','3°','A','LIG-102',1,'10:00','10:45'),
  ('secundaria','3°','A','LIG-102',2,'10:45','11:30'),
  ('secundaria','3°','A','MAT-401',4,'07:00','07:45'),
  ('secundaria','3°','A','MAT-401',5,'07:45','08:30'),
  ('secundaria','3°','A','MUS-106',2,'07:45','08:30'),
  ('secundaria','3°','A','TTG-402',3,'07:45','08:30'),
  ('secundaria','3°','A','VER-201',5,'08:30','09:15'),
  ('secundaria','3°','B','ART-107',3,'07:45','08:30'),
  ('secundaria','3°','B','BIO-302',4,'07:45','08:30'),
  ('secundaria','3°','B','BIO-302',5,'07:00','07:45'),
  ('secundaria','3°','B','CNT-301',1,'08:30','09:15'),
  ('secundaria','3°','B','CNT-301',1,'10:45','11:30'),
  ('secundaria','3°','B','CSO-104',3,'08:30','09:15'),
  ('secundaria','3°','B','CSO-104',4,'07:00','07:45'),
  ('secundaria','3°','B','EFI-105',3,'07:00','07:45'),
  ('secundaria','3°','B','FIL-202',2,'07:00','07:45'),
  ('secundaria','3°','B','FIS-303',1,'07:45','08:30'),
  ('secundaria','3°','B','FIS-303',2,'07:45','08:30'),
  ('secundaria','3°','B','LEN-101',4,'10:45','11:30'),
  ('secundaria','3°','B','LEN-101',5,'07:45','08:30'),
  ('secundaria','3°','B','LEX-103',3,'10:00','10:45'),
  ('secundaria','3°','B','LEX-103',3,'10:45','11:30'),
  ('secundaria','3°','B','LIG-102',4,'10:00','10:45'),
  ('secundaria','3°','B','LIG-102',5,'10:45','11:30'),
  ('secundaria','3°','B','MAT-401',4,'08:30','09:15'),
  ('secundaria','3°','B','MAT-401',5,'08:30','09:15'),
  ('secundaria','3°','B','MUS-106',1,'07:00','07:45'),
  ('secundaria','3°','B','TTG-402',5,'10:00','10:45'),
  ('secundaria','3°','B','VER-201',2,'10:00','10:45'),
  ('secundaria','4°','A','ART-107',3,'07:00','07:45'),
  ('secundaria','4°','A','BIO-302',5,'07:45','08:30'),
  ('secundaria','4°','A','BIO-302',5,'10:45','11:30'),
  ('secundaria','4°','A','CNT-301',2,'10:00','10:45'),
  ('secundaria','4°','A','CNT-301',3,'07:45','08:30'),
  ('secundaria','4°','A','CSO-104',2,'10:45','11:30'),
  ('secundaria','4°','A','CSO-104',4,'08:30','09:15'),
  ('secundaria','4°','A','EFI-105',4,'10:00','10:45'),
  ('secundaria','4°','A','FIL-202',5,'10:00','10:45'),
  ('secundaria','4°','A','FIS-303',1,'08:30','09:15'),
  ('secundaria','4°','A','FIS-303',1,'10:45','11:30'),
  ('secundaria','4°','A','LEN-101',4,'07:00','07:45'),
  ('secundaria','4°','A','LEN-101',5,'07:00','07:45'),
  ('secundaria','4°','A','LEX-103',3,'10:00','10:45'),
  ('secundaria','4°','A','LIG-102',2,'07:00','07:45'),
  ('secundaria','4°','A','LIG-102',3,'10:45','11:30'),
  ('secundaria','4°','A','MAT-401',1,'07:00','07:45'),
  ('secundaria','4°','A','MAT-401',2,'07:45','08:30'),
  ('secundaria','4°','A','QUI-304',1,'07:45','08:30'),
  ('secundaria','4°','A','QUI-304',4,'10:45','11:30'),
  ('secundaria','4°','A','TTG-402',5,'08:30','09:15'),
  ('secundaria','4°','A','VER-201',4,'07:45','08:30'),
  ('secundaria','4°','B','ART-107',1,'08:30','09:15'),
  ('secundaria','4°','B','BIO-302',1,'07:00','07:45'),
  ('secundaria','4°','B','BIO-302',5,'07:45','08:30'),
  ('secundaria','4°','B','CNT-301',3,'10:00','10:45'),
  ('secundaria','4°','B','CNT-301',4,'07:45','08:30'),
  ('secundaria','4°','B','CSO-104',1,'07:45','08:30'),
  ('secundaria','4°','B','CSO-104',5,'08:30','09:15'),
  ('secundaria','4°','B','EFI-105',1,'10:45','11:30'),
  ('secundaria','4°','B','FIL-202',3,'07:45','08:30'),
  ('secundaria','4°','B','FIS-303',2,'10:00','10:45'),
  ('secundaria','4°','B','FIS-303',3,'07:00','07:45'),
  ('secundaria','4°','B','LEN-101',1,'10:00','10:45'),
  ('secundaria','4°','B','LEN-101',5,'10:00','10:45'),
  ('secundaria','4°','B','LEX-103',2,'07:00','07:45'),
  ('secundaria','4°','B','LIG-102',3,'10:45','11:30'),
  ('secundaria','4°','B','LIG-102',5,'07:00','07:45'),
  ('secundaria','4°','B','MAT-401',2,'07:45','08:30'),
  ('secundaria','4°','B','MAT-401',2,'08:30','09:15'),
  ('secundaria','4°','B','QUI-304',4,'08:30','09:15'),
  ('secundaria','4°','B','QUI-304',4,'10:00','10:45'),
  ('secundaria','4°','B','TTG-402',4,'10:45','11:30'),
  ('secundaria','4°','B','VER-201',5,'10:45','11:30'),
  ('secundaria','5°','A','BIO-302',1,'08:30','09:15'),
  ('secundaria','5°','A','BIO-302',3,'07:45','08:30'),
  ('secundaria','5°','A','CNT-301',4,'08:30','09:15'),
  ('secundaria','5°','A','CNT-301',5,'08:30','09:15'),
  ('secundaria','5°','A','CSO-104',1,'07:45','08:30'),
  ('secundaria','5°','A','CSO-104',5,'07:45','08:30'),
  ('secundaria','5°','A','EFI-105',5,'10:45','11:30'),
  ('secundaria','5°','A','FIL-202',2,'07:45','08:30'),
  ('secundaria','5°','A','FIS-303',4,'07:00','07:45'),
  ('secundaria','5°','A','FIS-303',4,'10:00','10:45'),
  ('secundaria','5°','A','LEN-101',1,'07:00','07:45'),
  ('secundaria','5°','A','LEN-101',1,'10:45','11:30'),
  ('secundaria','5°','A','LEX-103',3,'07:00','07:45'),
  ('secundaria','5°','A','LIG-102',4,'07:45','08:30'),
  ('secundaria','5°','A','LIG-102',4,'10:45','11:30'),
  ('secundaria','5°','A','MAT-401',2,'10:00','10:45'),
  ('secundaria','5°','A','MAT-401',3,'08:30','09:15'),
  ('secundaria','5°','A','MUS-106',2,'07:00','07:45'),
  ('secundaria','5°','A','QUI-304',3,'10:45','11:30'),
  ('secundaria','5°','A','QUI-304',5,'07:00','07:45'),
  ('secundaria','5°','A','TTG-402',5,'10:00','10:45'),
  ('secundaria','5°','A','VER-201',3,'10:00','10:45'),
  ('secundaria','5°','B','BIO-302',4,'10:00','10:45'),
  ('secundaria','5°','B','BIO-302',5,'10:00','10:45'),
  ('secundaria','5°','B','CNT-301',1,'07:45','08:30'),
  ('secundaria','5°','B','CNT-301',2,'07:45','08:30'),
  ('secundaria','5°','B','CSO-104',3,'07:45','08:30'),
  ('secundaria','5°','B','CSO-104',3,'10:00','10:45'),
  ('secundaria','5°','B','EFI-105',5,'07:45','08:30'),
  ('secundaria','5°','B','FIL-202',5,'10:45','11:30'),
  ('secundaria','5°','B','FIS-303',4,'07:45','08:30'),
  ('secundaria','5°','B','FIS-303',5,'07:00','07:45'),
  ('secundaria','5°','B','LEN-101',3,'10:45','11:30'),
  ('secundaria','5°','B','LEN-101',4,'08:30','09:15'),
  ('secundaria','5°','B','LEX-103',2,'10:00','10:45'),
  ('secundaria','5°','B','LIG-102',1,'07:00','07:45'),
  ('secundaria','5°','B','LIG-102',4,'10:45','11:30'),
  ('secundaria','5°','B','MAT-401',1,'10:45','11:30'),
  ('secundaria','5°','B','MAT-401',2,'10:45','11:30'),
  ('secundaria','5°','B','MUS-106',3,'07:00','07:45'),
  ('secundaria','5°','B','QUI-304',1,'08:30','09:15'),
  ('secundaria','5°','B','QUI-304',4,'07:00','07:45'),
  ('secundaria','5°','B','TTG-402',5,'08:30','09:15'),
  ('secundaria','5°','B','VER-201',2,'07:00','07:45'),
  ('secundaria','6°','A','ART-107',4,'07:45','08:30'),
  ('secundaria','6°','A','BIO-302',3,'07:00','07:45'),
  ('secundaria','6°','A','BIO-302',4,'10:45','11:30'),
  ('secundaria','6°','A','CSO-104',1,'07:00','07:45'),
  ('secundaria','6°','A','CSO-104',1,'10:45','11:30'),
  ('secundaria','6°','A','EFI-105',2,'07:45','08:30'),
  ('secundaria','6°','A','FIL-202',3,'10:45','11:30'),
  ('secundaria','6°','A','FIS-303',5,'08:30','09:15'),
  ('secundaria','6°','A','FIS-303',5,'10:00','10:45'),
  ('secundaria','6°','A','LEN-101',1,'10:00','10:45'),
  ('secundaria','6°','A','LEN-101',3,'10:00','10:45'),
  ('secundaria','6°','A','LEX-103',1,'08:30','09:15'),
  ('secundaria','6°','A','LIG-102',4,'07:00','07:45'),
  ('secundaria','6°','A','LIG-102',4,'10:00','10:45'),
  ('secundaria','6°','A','MAT-401',2,'07:00','07:45'),
  ('secundaria','6°','A','MAT-401',4,'08:30','09:15'),
  ('secundaria','6°','A','QUI-304',3,'07:45','08:30'),
  ('secundaria','6°','A','QUI-304',5,'07:45','08:30'),
  ('secundaria','6°','A','TTE-403',5,'07:00','07:45'),
  ('secundaria','6°','A','TTE-403',5,'10:45','11:30'),
  ('secundaria','6°','A','TTG-402',2,'10:00','10:45'),
  ('secundaria','6°','A','VER-201',1,'07:45','08:30'),
  ('secundaria','6°','B','ART-107',1,'07:00','07:45'),
  ('secundaria','6°','B','BIO-302',3,'10:00','10:45'),
  ('secundaria','6°','B','BIO-302',5,'08:30','09:15'),
  ('secundaria','6°','B','CSO-104',1,'08:30','09:15'),
  ('secundaria','6°','B','CSO-104',4,'10:45','11:30'),
  ('secundaria','6°','B','EFI-105',2,'07:45','08:30'),
  ('secundaria','6°','B','FIL-202',1,'07:45','08:30'),
  ('secundaria','6°','B','FIS-303',5,'10:00','10:45'),
  ('secundaria','6°','B','FIS-303',5,'10:45','11:30'),
  ('secundaria','6°','B','LEN-101',2,'07:00','07:45'),
  ('secundaria','6°','B','LEN-101',4,'10:00','10:45'),
  ('secundaria','6°','B','LEX-103',4,'08:30','09:15'),
  ('secundaria','6°','B','LIG-102',3,'08:30','09:15'),
  ('secundaria','6°','B','LIG-102',4,'07:00','07:45'),
  ('secundaria','6°','B','MAT-401',4,'07:45','08:30'),
  ('secundaria','6°','B','MAT-401',5,'07:00','07:45'),
  ('secundaria','6°','B','QUI-304',1,'10:45','11:30'),
  ('secundaria','6°','B','QUI-304',3,'10:45','11:30'),
  ('secundaria','6°','B','TTE-403',2,'10:00','10:45'),
  ('secundaria','6°','B','TTE-403',5,'07:45','08:30'),
  ('secundaria','6°','B','TTG-402',3,'07:00','07:45'),
  ('secundaria','6°','B','VER-201',3,'07:45','08:30')
) AS v(nivel, grado, paralelo, mat, dia, hi, hf)
JOIN "cursos" c ON c."nivel" = v.nivel AND c."grado" = v.grado AND c."paralelo" = v.paralelo
JOIN "cursos_periodo" cp ON cp."curso_id" = c."id" AND cp."periodo_id" = (SELECT "id" FROM tmp_periodo)
JOIN "materias" m ON m."codigo" = v.mat
JOIN "asignaciones_docentes" ad ON ad."curso_periodo_id" = cp."id"
                               AND ad."materia_id" = m."id"
                               AND ad."estado" = 'activo'
JOIN tmp_aula_curso ac ON ac.curso_periodo_id = cp."id"
WHERE NOT EXISTS (
  SELECT 1 FROM "horarios" h
  WHERE h."curso_periodo_id" = cp."id"
    AND h."dia_semana" = v.dia AND h."hora_inicio" = v.hi::time
);

-- Encargos por trimestre (T1 y T2 cerrados, T3 en curso al 13 de octubre)
INSERT INTO "encargos"
  ("asignacion_id", "tipo", "titulo", "descripcion", "ponderacion",
   "fecha_publicacion", "fecha_limite", "estado")
SELECT ad."id", v.tipo, v.titulo, v.descripcion, v.pond::numeric,
       v.pub::timestamptz, v.lim::timestamptz, v.estado
FROM "asignaciones_docentes" ad
CROSS JOIN (VALUES
  ('Tarea',  'Guía de trabajo T1',   'Actividad inicial de la unidad del primer trimestre.', 40, '2026-02-16 08:00:00-04', '2026-03-13 20:00:00-04', 'cerrado'),
  ('Examen', 'Evaluación sumativa T1','Examen parcial del primer trimestre.',                 60, '2026-04-06 08:00:00-04', '2026-04-10 20:00:00-04', 'cerrado'),
  ('Tarea',  'Guía de trabajo T2',   'Actividad inicial de la unidad del segundo trimestre.', 40, '2026-06-01 08:00:00-04', '2026-07-10 20:00:00-04', 'cerrado'),
  ('Examen', 'Evaluación sumativa T2','Examen parcial del segundo trimestre.',                60, '2026-08-10 08:00:00-04', '2026-08-14 20:00:00-04', 'cerrado'),
  ('Tarea',  'Guía de trabajo T3',   'Actividad en curso del tercer trimestre.',              40, '2026-09-21 08:00:00-04', '2026-10-30 20:00:00-04', 'publicado')
) AS v(tipo, titulo, descripcion, pond, pub, lim, estado)
WHERE ad."estado" = 'activo'
  AND NOT EXISTS (
    SELECT 1 FROM "encargos" x WHERE x."asignacion_id" = ad."id" AND x."titulo" = v.titulo
  );

-- Entregas de guías (T1 y T2 completas, T3 solo excelente y estandar)
INSERT INTO "encargo_entregas"
  ("encargo_id", "estudiante_id", "archivo_url", "nombre_archivo", "tipo_mime",
   "tamanio_bytes", "comentario", "fecha_entrega", "estado_entrega")
SELECT e."id", ins."estudiante_id",
       'entregas/2026/enc-' || e."id" || '-est-' || ins."estudiante_id" || '.pdf',
       'tarea.pdf', 'application/pdf',
       (100000 + ((ins."estudiante_id" * 13 + e."id") % 900000))::bigint,
       CASE WHEN p.perfil IN ('bajo', 'regular') THEN 'Entrega con apoyo del tutor.' ELSE NULL END,
       CASE
         WHEN ((ins."estudiante_id" * 13 + e."id") % 5) < v.retraso THEN e."fecha_limite" + ((((ins."estudiante_id" * 13 + e."id") % 3) + 1) || ' days')::interval
         ELSE e."fecha_publicacion" + ((((ins."estudiante_id" * 13 + e."id") % 10) + 1) || ' days')::interval
       END,
       CASE WHEN ((ins."estudiante_id" * 13 + e."id") % 5) < v.retraso THEN 'con_retraso' ELSE 'a_tiempo' END
FROM "encargos" e
JOIN "asignaciones_docentes" ad ON ad."id" = e."asignacion_id"
JOIN tmp_inscripciones ins ON ins."curso_periodo_id" = ad."curso_periodo_id"
JOIN tmp_perfiles p ON p."estudiante_id" = ins."estudiante_id"
CROSS JOIN LATERAL (
  SELECT CASE WHEN e."titulo" LIKE '%T3' THEN 0
              WHEN p.perfil = 'bajo' THEN 2
              WHEN p.perfil = 'regular' THEN 1
              ELSE 0 END AS retraso
) v
WHERE e."tipo" = 'Tarea'
  AND (e."titulo" LIKE '%T1' OR e."titulo" LIKE '%T2'
       OR (e."titulo" LIKE '%T3' AND p.perfil IN ('excelente', 'estandar')))
ON CONFLICT ("encargo_id", "estudiante_id") DO NOTHING;

-- Calificaciones (excelente 84-96, estandar 70-82, regular 52-64, bajo 29-41)
INSERT INTO "calificaciones" ("encargo_id", "estudiante_id", "nota", "fecha_calificacion")
SELECT e."id", ins."estudiante_id",
       ROUND(CAST(GREATEST(0, LEAST(100,
         CASE p.perfil
           WHEN 'bajo'     THEN 35
           WHEN 'regular'  THEN 58
           WHEN 'estandar' THEN 76
           ELSE 90
         END + ((ins."estudiante_id" + e."id") % 13) - 6
       )) AS numeric), 2),
       e."fecha_publicacion" + interval '14 days'
FROM "encargos" e
JOIN "asignaciones_docentes" ad ON ad."id" = e."asignacion_id"
JOIN tmp_inscripciones ins ON ins."curso_periodo_id" = ad."curso_periodo_id"
JOIN tmp_perfiles p ON p."estudiante_id" = ins."estudiante_id"
WHERE e."estado" IN ('publicado', 'cerrado')
  AND (e."titulo" LIKE '%T1' OR e."titulo" LIKE '%T2'
       OR (e."titulo" LIKE '%T3' AND p.perfil IN ('excelente', 'estandar')))
ON CONFLICT ("encargo_id", "estudiante_id") DO UPDATE SET "nota" = EXCLUDED."nota";

-- Asistencia hasta el tercer trimestre (excelente perfecta, bajo con faltas)
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
          AND ((ins."estudiante_id" * 7919 + ad."id" * 104729 + d.dia * 31) % 100) >= v.tarde
         THEN 'Justificación médica'
         ELSE NULL
       END
FROM tmp_inscripciones ins
JOIN "asignaciones_docentes" ad ON ad."curso_periodo_id" = ins."curso_periodo_id"
CROSS JOIN (VALUES
  (1, DATE '2026-02-17'),
  (2, DATE '2026-02-19'),
  (3, DATE '2026-03-03'),
  (4, DATE '2026-03-19'),
  (5, DATE '2026-04-07'),
  (6, DATE '2026-04-09'),
  (7, DATE '2026-05-26'),
  (8, DATE '2026-06-11'),
  (9, DATE '2026-07-16'),
  (10, DATE '2026-08-13'),
  (11, DATE '2026-09-17'),
  (12, DATE '2026-10-08')
) AS d(dia, fecha)
JOIN tmp_perfiles p ON p."estudiante_id" = ins."estudiante_id"
CROSS JOIN LATERAL (
  SELECT CASE p.perfil WHEN 'bajo' THEN 45 WHEN 'regular' THEN 28 WHEN 'estandar' THEN 8 ELSE 0 END AS faltan,
         CASE p.perfil WHEN 'bajo' THEN 52 WHEN 'regular' THEN 36 WHEN 'estandar' THEN 12 ELSE 0 END AS tarde,
         CASE p.perfil WHEN 'bajo' THEN 58 WHEN 'regular' THEN 42 WHEN 'estandar' THEN 15 ELSE 0 END AS justificado
) v
WHERE ad."estado" = 'activo'
ON CONFLICT ("estudiante_id", "asignacion_id", "fecha") DO NOTHING;

-- Corte de avance al tercer trimestre (13 de octubre de 2026)
CREATE TEMP TABLE tmp_corte ON COMMIT DROP AS SELECT DATE '2026-10-13' AS corte;

-- Plan de pagos general 2026 (10 cuotas de febrero a noviembre)
INSERT INTO "planes_pago"
  ("periodo_id", "nivel", "nombre", "cantidad_cuotas", "monto_total", "monto_cuota", "dia_vencimiento", "estado")
SELECT p."id", 'general', 'Plan General 2026', 10, 4000.00, 400.00, 10, 'generado'
FROM tmp_periodo p
ON CONFLICT ("periodo_id", "nivel") DO UPDATE SET
  "nombre" = EXCLUDED."nombre",
  "cantidad_cuotas" = EXCLUDED."cantidad_cuotas", "monto_total" = EXCLUDED."monto_total",
  "monto_cuota" = EXCLUDED."monto_cuota", "estado" = 'generado';

INSERT INTO "cuotas_plan_pago" ("plan_id", "numero", "anio", "mes", "fecha_vencimiento", "monto", "estado")
SELECT pp."id", v.numero, 2026, v.mes,
       (DATE '2026-02-10' + ((v.numero - 1) * interval '1 month'))::date,
       400.00,
       CASE WHEN v.numero <= 9 THEN 'pagado' ELSE 'pendiente' END
FROM "planes_pago" pp
CROSS JOIN (VALUES (1,2),(2,3),(3,4),(4,5),(5,6),(6,7),(7,8),(8,9),(9,10),(10,11)) AS v(numero, mes)
WHERE pp."periodo_id" = (SELECT "id" FROM tmp_periodo) AND pp."nivel" = 'general'
ON CONFLICT ("plan_id", "numero") DO UPDATE SET
  "fecha_vencimiento" = EXCLUDED."fecha_vencimiento",
  "monto" = EXCLUDED."monto", "estado" = EXCLUDED."estado";

-- Limpieza de pensiones de conceptos viejos antes de regenerar
DELETE FROM "pago_pensiones"
WHERE "pension_id" IN (
  SELECT "id" FROM "pensiones"
  WHERE "periodo_id" = (SELECT "id" FROM tmp_periodo) AND "concepto" <> 'Matricula 2026'
);
DELETE FROM "pagos"
WHERE "id" NOT IN (SELECT "pago_id" FROM "pago_pensiones")
  AND "estudiante_id" IN (SELECT "estudiante_id" FROM tmp_inscripciones);
DELETE FROM "pensiones"
WHERE "periodo_id" = (SELECT "id" FROM tmp_periodo) AND "concepto" <> 'Matricula 2026';

-- Pensiones por cuota (al dia, mora leve, mora grave y becados anulados)
INSERT INTO "pensiones"
  ("estudiante_id", "periodo_id", "plan_pago_id", "numero_cuota", "concepto", "mes",
   "monto", "fecha_vencimiento", "estado")
SELECT ins."estudiante_id", p."id", pp."id", c."numero", 'Matricula 2026', c."mes",
       c."monto", c."fecha_vencimiento",
       CASE
         WHEN e.perfil >= 95 THEN 'anulado'
         WHEN c."numero" = 10 THEN 'pendiente'
         WHEN c."fecha_vencimiento" >= (SELECT corte FROM tmp_corte) AND c."numero" < 9 THEN 'pendiente'
         WHEN e.perfil < 55 THEN 'pagado'
         WHEN c."numero" < 9 - v.mora THEN 'pagado'
         WHEN c."numero" = 9 AND e.adelanto < 35 THEN 'pagado'
         ELSE 'vencido'
       END
FROM tmp_inscripciones ins
CROSS JOIN tmp_periodo p
JOIN "planes_pago" pp ON pp."periodo_id" = p."id" AND pp."nivel" = 'general'
JOIN "cuotas_plan_pago" c ON c."plan_id" = pp."id"
CROSS JOIN LATERAL (
  SELECT ((ins."estudiante_id" * 31 + 7) % 100) AS perfil,
         ((ins."estudiante_id" * 53 + 11) % 100) AS adelanto
) e
CROSS JOIN LATERAL (
  SELECT CASE WHEN e.perfil < 72 THEN 0
              WHEN e.perfil < 86 THEN 2
              ELSE 4 END AS mora
) v
ON CONFLICT ("estudiante_id", "periodo_id", "concepto", "mes") DO UPDATE SET
  "monto" = EXCLUDED."monto", "estado" = EXCLUDED."estado",
  "plan_pago_id" = EXCLUDED."plan_pago_id", "numero_cuota" = EXCLUDED."numero_cuota",
  "fecha_vencimiento" = EXCLUDED."fecha_vencimiento";

-- Pagos confirmados por cada pensión pagada
INSERT INTO "pagos"
  ("estudiante_id", "monto", "metodo", "numero_transaccion", "comprobante_url", "fecha_pago", "registrado_por", "estado", "observacion")
SELECT pe."estudiante_id",
       pe."monto",
       CASE ((pe."estudiante_id" * 13) % 4)::int
         WHEN 0 THEN 'Efectivo'
         WHEN 1 THEN 'Transferencia'
         WHEN 2 THEN 'QR'
         ELSE 'Tarjeta'
       END,
       'TRX-' || LPAD(pe."id"::text, 8, '0'),
       NULL,
       LEAST((pe."fecha_vencimiento" - (((pe."estudiante_id" * 17) % 5) || ' days')::interval)::date,
             (SELECT corte FROM tmp_corte)),
       (SELECT u."id" FROM "usuario_cuenta" x JOIN "usuarios" u ON u."id" = x."usuario_id" WHERE x."username" = 'control01'),
       'confirmado',
       NULL
FROM "pensiones" pe
WHERE pe."periodo_id" = (SELECT "id" FROM tmp_periodo) AND pe."estado" = 'pagado'
  AND NOT EXISTS (SELECT 1 FROM "pagos" pg WHERE pg."numero_transaccion" = 'TRX-' || LPAD(pe."id"::text, 8, '0'));

-- Vínculo pago con pensión
INSERT INTO "pago_pensiones" ("pago_id", "pension_id", "monto")
SELECT pg."id", pe."id", pe."monto"
FROM "pagos" pg
JOIN "pensiones" pe ON pg."numero_transaccion" = 'TRX-' || LPAD(pe."id"::text, 8, '0')
WHERE pe."periodo_id" = (SELECT "id" FROM tmp_periodo)
  AND NOT EXISTS (
    SELECT 1 FROM "pago_pensiones" x WHERE x."pago_id" = pg."id" AND x."pension_id" = pe."id"
  );

-- Marcas de generación del período
UPDATE "periodos_academicos"
SET "estructura_generada" = true, "horarios_generados" = true, "plan_pagos_generado" = true
WHERE "id" = (SELECT "id" FROM tmp_periodo);

DROP TABLE tmp_periodo;

COMMIT;
