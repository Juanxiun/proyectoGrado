BEGIN;

ALTER TABLE insignias_estudiante DROP CONSTRAINT IF EXISTS uq_insignia_estudiante;
CREATE UNIQUE INDEX IF NOT EXISTS uq_insignia_estudiante_contexto
  ON insignias_estudiante (usuario_id, insignia_id, (COALESCE(metadata->>'contentId', 'unico')));
CREATE UNIQUE INDEX IF NOT EXISTS uq_bono_desafios_diarios
  ON puntos_individuales (usuario_id, fecha, (metadata->>'evento'))
  WHERE metadata->>'evento' = 'bono_desafios_diarios';

INSERT INTO insignias (codigo, nombre, descripcion, criterio, activa) VALUES
  ('logro_tema_completo', 'Dominio del tema', 'Completó las Cartas y el Esquema del mismo tema', '{"formatos": ["CARTAS_EXPLICATIVAS", "ESQUEMA_GEMMA"]}'::jsonb, true)
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  criterio = EXCLUDED.criterio,
  activa = true;

UPDATE tienda_recompensas
SET nombre = 'Recuperar Racha',
    descripcion = 'Recupera una racha perdida sin gastar puntos al usar esta compra.',
    activa = true
WHERE lower(nombre) = 'salvar racha';

INSERT INTO tienda_recompensas (nombre, descripcion, costo_puntos_individuales, tipo, activa)
SELECT 'Recuperar Racha', 'Recupera una racha perdida sin gastar puntos al usar esta compra.', 100, 'salvar_racha', true
WHERE NOT EXISTS (SELECT 1 FROM tienda_recompensas WHERE lower(nombre) = 'recuperar racha');

INSERT INTO tienda_recompensas (nombre, descripcion, costo_puntos_individuales, tipo, activa)
SELECT 'Puntos Dobles', 'Duplica los puntos de tu próxima actividad dentro del límite diario.', 50, 'otro', true
WHERE NOT EXISTS (SELECT 1 FROM tienda_recompensas WHERE lower(nombre) = 'puntos dobles');

WITH duplicados AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY lower(trim(nombre)) ORDER BY id) AS numero
  FROM tienda_recompensas WHERE lower(trim(nombre)) IN ('puntos dobles', 'recuperar racha')
)
UPDATE tienda_recompensas tr SET activa = (d.numero = 1)
FROM duplicados d WHERE tr.id = d.id;

UPDATE tienda_recompensas
SET activa = false
WHERE lower(nombre) NOT IN ('puntos dobles', 'recuperar racha');

COMMIT;
