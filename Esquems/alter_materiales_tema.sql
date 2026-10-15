-- migracion -> vincular materiales a temas malla
ALTER TABLE "materia_materiales"
  ADD COLUMN IF NOT EXISTS "tema_id" BIGINT REFERENCES "malla_temas"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "tipo_material" VARCHAR(20) CHECK ("tipo_material" IN ('estudio', 'actividad'));

CREATE INDEX IF NOT EXISTS "idx_material_tema" ON "materia_materiales"("tema_id");
