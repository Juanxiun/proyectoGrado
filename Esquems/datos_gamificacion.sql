-- Ejecutar conectado a ShalomDBGM desde el Query Tool de pgAdmin.
-- Las bases son independientes: primero ejecuta datos.sql en ShalomDB;
-- copia el resultado de su consulta "filas_para_gamificacion" y pégalo aquí,
-- reemplazando la fila de ejemplo (-1, ...).
CREATE TEMP TABLE tmp_gm_seed (
  usuario_id bigint, estudiante_id bigint, curso_periodo_id bigint,
  paralelo text, nombre text, apellido_paterno text
);
INSERT INTO tmp_gm_seed VALUES
  (-1, -1, -1, 'A', '', ''); -- Reemplazar con las filas copiadas de datos.sql

BEGIN;
INSERT INTO "insignias" ("codigo", "nombre", "descripcion", "criterio", "activa") VALUES
  ('speedrun', 'Speedrun', 'Completa una actividad con rapidez y precision.', '{"tiempoMaxMs":30000,"aciertoMin":1}'::jsonb, true),
  ('nuevo_aprendizaje', 'Aprendiendo Nuevas Cosas', 'Completa una actividad de aprendizaje.', '{"primeraActividad":true}'::jsonb, true),
  ('mejor_semana', 'Mejor de la Semana', 'Obtiene el mejor puntaje semanal del paralelo.', '{"posicion":1}'::jsonb, true)
ON CONFLICT ("codigo") DO UPDATE SET
  "nombre" = EXCLUDED."nombre", "descripcion" = EXCLUDED."descripcion",
  "criterio" = EXCLUDED."criterio", "activa" = true;
INSERT INTO "trofeos" ("codigo", "nombre", "descripcion", "puntos", "criterio", "periodo", "activo") VALUES
  ('mejor_semana', 'Mejor de la Semana', 'Primer lugar en el ranking del paralelo.', 500, '{"posicion":1}'::jsonb, 'semanal', true),
  ('alto_rendimiento', 'Alto Rendimiento', 'Rendimiento trimestral sobresaliente.', 2000, '{"minAcierto":0.9}'::jsonb, 'trimestral', true)
ON CONFLICT ("codigo") DO UPDATE SET
  "nombre" = EXCLUDED."nombre", "descripcion" = EXCLUDED."descripcion",
  "puntos" = EXCLUDED."puntos", "criterio" = EXCLUDED."criterio",
  "periodo" = EXCLUDED."periodo", "activo" = true;
INSERT INTO "tienda_recompensas" ("nombre", "descripcion", "costo_puntos_individuales", "tipo", "activa")
SELECT v.nombre, v.descripcion, v.costo, v.tipo, true
FROM (VALUES
  ('Salvar Racha Diaria', 'Protege una racha diaria.', 50, 'salvar_racha'),
  ('Pista para Examen', 'Canjea puntos por una pista de estudio.', 40, 'pista_examen')
) AS v(nombre, descripcion, costo, tipo)
WHERE NOT EXISTS (
  SELECT 1 FROM "tienda_recompensas" r WHERE lower(r.nombre) = lower(v.nombre)
);

INSERT INTO "estudiantes_gamificacion"
  ("usuario_id", "estudiante_id", "curso_periodo_id", "paralelo", "nombre", "apellido_paterno")
SELECT usuario_id, estudiante_id, curso_periodo_id, paralelo, nombre, apellido_paterno
FROM tmp_gm_seed
WHERE usuario_id > 0;

INSERT INTO "rachas_diarias"
  ("usuario_id", "fecha", "completada", "aciertos", "total_preguntas", "porcentaje_acierto", "racha_actual", "mejor_racha")
SELECT eg.usuario_id, CURRENT_DATE - dias.dia, true, 8 + dias.dia, 10,
       (80 + dias.dia)::numeric(5,2), 3 - dias.dia, 3
FROM "estudiantes_gamificacion" eg
CROSS JOIN (VALUES (0), (1), (2)) AS dias(dia);

INSERT INTO "puntos_individuales"
  ("usuario_id", "curso_periodo_id", "paralelo", "fecha", "tipo", "puntos", "descripcion", "metadata")
SELECT eg.usuario_id, eg.curso_periodo_id, eg.paralelo, CURRENT_DATE - dias.dia,
       'respuesta_correcta', 10, 'Puntos de actividad de prueba', '{"origen":"seed_prueba"}'::jsonb
FROM "estudiantes_gamificacion" eg
CROSS JOIN (VALUES (0), (1), (2)) AS dias(dia);

INSERT INTO "puntos_globales"
  ("curso_periodo_id", "paralelo", "fecha", "puntos_ganados", "descripcion")
SELECT eg.curso_periodo_id, eg.paralelo, CURRENT_DATE - dias.dia,
       count(*)::integer * 10, 'Puntos del paralelo de prueba'
FROM "estudiantes_gamificacion" eg
CROSS JOIN (VALUES (0), (1), (2)) AS dias(dia)
GROUP BY eg.curso_periodo_id, eg.paralelo, dias.dia;

INSERT INTO "actividades_gamificadas"
  ("usuario_id", "estudiante_id", "curso_periodo_id", "paralelo", "tipo", "materia_id", "materia_nombre", "titulo", "preguntas", "respuestas", "aciertos", "total", "porcentaje_acierto", "tiempo_total_ms", "puntos_ganados", "puntos_calidad", "puntos_tiempo", "completada", "fecha_inicio", "fecha_fin")
SELECT eg.usuario_id, eg.estudiante_id, eg.curso_periodo_id, eg.paralelo,
       'flashcards', m.id, m.nombre, 'Repaso de prueba: ' || m.nombre,
       '[{"pregunta":"Cuanto es 2 + 2?","respuesta":"4"}]'::jsonb,
       '[{"respuesta":"4","correcta":true}]'::jsonb,
       1, 1, 100, 45000, 20, 15, 5, true, CURRENT_TIMESTAMP - interval '1 day', CURRENT_TIMESTAMP - interval '1 day' + interval '45 seconds'
FROM "estudiantes_gamificacion" eg
JOIN "materias" m ON m.codigo = 'MAT-401';

INSERT INTO "insignias_estudiante" ("usuario_id", "insignia_id", "metadata")
SELECT eg.usuario_id, i.id, '{"contentId":"seed_flashcards"}'::jsonb
FROM "estudiantes_gamificacion" eg
CROSS JOIN "insignias" i
WHERE i.codigo = 'speedrun';

INSERT INTO "trofeos_estudiante" ("usuario_id", "trofeo_id", "fecha_obtencion", "puntos_otorgados", "metadata")
SELECT eg.usuario_id, t.id, CURRENT_TIMESTAMP - interval '1 day', t.puntos,
       jsonb_build_object('fechaDia', (CURRENT_DATE - 1)::text, 'origen', 'seed_prueba')
FROM "estudiantes_gamificacion" eg
CROSS JOIN "trofeos" t
WHERE t.codigo = 'mejor_semana';
COMMIT;
