-- Migración para añadir soporte de carátula/imagen en Cursos y Materias
ALTER TABLE "cursos" ADD COLUMN IF NOT EXISTS "caratula_url" VARCHAR(500);
ALTER TABLE "materias" ADD COLUMN IF NOT EXISTS "caratula_url" VARCHAR(500);
