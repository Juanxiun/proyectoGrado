-- Migración de gestión académica, mallas, horarios, pagos e inscripción.
-- Ejecutar sobre bases creadas con una versión anterior de BDmain.sql.

BEGIN;

ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "activo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "descripcion" VARCHAR(255);

ALTER TABLE "maestros"
  ADD COLUMN IF NOT EXISTS "materias_configuradas" BOOLEAN NOT NULL DEFAULT false;

INSERT INTO "roles" ("rol", "descripcion")
VALUES
  ('director', 'Dirección General'),
  ('profesor', 'Personal docente'),
  ('estudiante', 'Estudiante'),
  ('control', 'Control / Administración'),
  ('apoderado', 'Apoderado / Tutor'),
  ('gerencia', 'Gerencia')
ON CONFLICT ("rol") DO UPDATE SET "descripcion" = EXCLUDED."descripcion", "activo" = true;

ALTER TABLE "usuario_cuenta"
  ADD COLUMN IF NOT EXISTS "primer_login" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "datos_personales_actualizados" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "contacto_tutor_actualizado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "password_actualizado" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "estudiantes"
  ADD COLUMN IF NOT EXISTS "tutor_nombre" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "tutor_telefono" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "tutor_parentesco" VARCHAR(50);

UPDATE "usuario_cuenta" uc
SET
  "primer_login" = CASE WHEN uc."ultimo_login" IS NULL THEN uc."primer_login" ELSE false END,
  "datos_personales_actualizados" = CASE WHEN uc."ultimo_login" IS NOT NULL THEN
    EXISTS (SELECT 1 FROM "usuario_direcciones" d WHERE d."usuario_id" = u."id")
    AND EXISTS (SELECT 1 FROM "usuario_contactos" c WHERE c."usuario_id" = u."id")
    ELSE uc."datos_personales_actualizados" END,
  "contacto_tutor_actualizado" = CASE WHEN EXISTS (
    SELECT 1 FROM "estudiantes" e WHERE e."usuario_id" = u."id"
  ) THEN
    EXISTS (
      SELECT 1 FROM "estudiantes" e
      JOIN "estudiante_apoderado" ea ON ea."estudiante_id" = e."id"
      JOIN "apoderados" a ON a."id" = ea."apoderado_id"
      JOIN "usuario_contactos" tc ON tc."usuario_id" = a."usuario_id"
      WHERE e."usuario_id" = u."id"
    )
    OR EXISTS (
      SELECT 1 FROM "estudiantes" e
      WHERE e."usuario_id" = u."id" AND e."tutor_nombre" IS NOT NULL AND e."tutor_telefono" IS NOT NULL
    )
    ELSE CASE WHEN uc."ultimo_login" IS NOT NULL THEN true ELSE uc."contacto_tutor_actualizado" END END,
  "password_actualizado" = CASE WHEN uc."ultimo_login" IS NOT NULL THEN true ELSE uc."password_actualizado" END
FROM "usuarios" u
WHERE uc."usuario_id" = u."id";

ALTER TABLE "periodos_academicos"
  ADD COLUMN IF NOT EXISTS "inicio_gestion" DATE,
  ADD COLUMN IF NOT EXISTS "fin_gestion" DATE,
  ADD COLUMN IF NOT EXISTS "estado" VARCHAR(20) NOT NULL DEFAULT 'configuracion',
  ADD COLUMN IF NOT EXISTS "origen_periodo_id" BIGINT,
  ADD COLUMN IF NOT EXISTS "estructura_generada" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "horarios_generados" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "plan_pagos_generado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "activado_at" TIMESTAMPTZ;

UPDATE "periodos_academicos"
SET
  "inicio_gestion" = COALESCE("inicio_gestion", "fecha_inicio"),
  "fin_gestion" = COALESCE("fin_gestion", "fecha_fin"),
  "estado" = CASE WHEN "activo" THEN 'activo' ELSE 'configuracion' END;

-- La gestión 2026 queda en configuración mientras no tenga una
-- configuración académica completa. Si ya fue activada con validaciones
-- completas, esta condición no la vuelve a desactivar.
UPDATE "periodos_academicos"
SET "activo" = false,
    "estado" = CASE WHEN "estado" = 'activo' THEN 'configuracion' ELSE "estado" END
WHERE "anio" = 2026
  AND "activo" = true
  AND (NOT COALESCE("estructura_generada", false)
       OR NOT COALESCE("horarios_generados", false)
       OR NOT COALESCE("plan_pagos_generado", false));

ALTER TABLE "periodos_academicos"
  ALTER COLUMN "inicio_gestion" SET NOT NULL,
  ALTER COLUMN "fin_gestion" SET NOT NULL;

ALTER TABLE "cursos_periodo"
  ADD COLUMN IF NOT EXISTS "turno_id" BIGINT;

ALTER TABLE "materias"
  ADD COLUMN IF NOT EXISTS "tipo_materia" VARCHAR(20) NOT NULL DEFAULT 'principal',
  ADD COLUMN IF NOT EXISTS "carga_horaria_semanal" SMALLINT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "peso_sintactico" SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "materia_pesada" BOOLEAN NOT NULL DEFAULT false;

UPDATE "materias"
SET "materia_pesada" = true
WHERE lower("nombre") ~ 'matem|matemática|física|química|physics|chemistry';

UPDATE "materias"
SET "peso_sintactico" = CASE WHEN "tipo_materia" = 'extracurricular' THEN 1 ELSE 3 END
WHERE "peso_sintactico" = 1;

ALTER TABLE "inscripciones"
  ADD COLUMN IF NOT EXISTS "periodo_id" BIGINT,
  ADD COLUMN IF NOT EXISTS "solicitud_id" BIGINT,
  ADD COLUMN IF NOT EXISTS "origen" VARCHAR(20) NOT NULL DEFAULT 'nueva';

UPDATE "inscripciones" i
SET "periodo_id" = cp."periodo_id"
FROM "cursos_periodo" cp
WHERE i."curso_periodo_id" = cp."id" AND i."periodo_id" IS NULL;

ALTER TABLE "inscripciones" ALTER COLUMN "periodo_id" SET NOT NULL;

ALTER TABLE "pensiones"
  ADD COLUMN IF NOT EXISTS "plan_pago_id" BIGINT,
  ADD COLUMN IF NOT EXISTS "numero_cuota" SMALLINT;

CREATE TABLE IF NOT EXISTS "turnos" (
  "id" BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  "codigo" VARCHAR(20) UNIQUE NOT NULL,
  "nombre" VARCHAR(50) NOT NULL,
  "hora_inicio" TIME NOT NULL,
  "hora_fin" TIME NOT NULL,
  "receso_inicio" TIME NOT NULL,
  "receso_fin" TIME NOT NULL,
  "duracion_periodo_minutos" SMALLINT NOT NULL DEFAULT 45,
  "activo" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS "trimestres" (
  "id" BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  "periodo_id" BIGINT NOT NULL,
  "numero" SMALLINT NOT NULL,
  "inicio" DATE NOT NULL,
  "fin" DATE NOT NULL,
  "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "uq_trimestre_periodo_numero" UNIQUE ("periodo_id", "numero")
);

CREATE TABLE IF NOT EXISTS "aulas" (
  "id" BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  "codigo" VARCHAR(30) UNIQUE NOT NULL,
  "nombre" VARCHAR(80) NOT NULL,
  "capacidad" INT NOT NULL DEFAULT 30,
  "activa" BOOLEAN NOT NULL DEFAULT true,
  "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "maestro_materias" (
  "maestro_id" BIGINT NOT NULL,
  "materia_id" BIGINT NOT NULL,
  "fecha_asignacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("maestro_id", "materia_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_maestro_materias_pair"
  ON "maestro_materias" ("maestro_id", "materia_id");
CREATE INDEX IF NOT EXISTS "idx_maestro_materias_materia"
  ON "maestro_materias" ("materia_id");

CREATE TABLE IF NOT EXISTS "mallas_curriculares" (
  "id" BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  "periodo_id" BIGINT NOT NULL,
  "nivel" VARCHAR(30) NOT NULL,
  "grado" VARCHAR(20) NOT NULL,
  "materia_id" BIGINT NOT NULL,
  "tipo_materia" VARCHAR(20) NOT NULL,
  "carga_horaria_semanal" SMALLINT NOT NULL,
  "peso_sintactico" SMALLINT NOT NULL DEFAULT 1,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "uq_malla_periodo_grado_materia" UNIQUE ("periodo_id", "nivel", "grado", "materia_id")
);

CREATE TABLE IF NOT EXISTS "horarios" (
  "id" BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  "curso_periodo_id" BIGINT NOT NULL,
  "materia_id" BIGINT NOT NULL,
  "asignacion_id" BIGINT,
  "maestro_id" BIGINT,
  "aula_id" BIGINT NOT NULL,
  "turno_id" BIGINT NOT NULL,
  "dia_semana" SMALLINT NOT NULL,
  "hora_inicio" TIME NOT NULL,
  "hora_fin" TIME NOT NULL,
  "estado" VARCHAR(20) NOT NULL DEFAULT 'activo',
  "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "planes_pago" (
  "id" BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  "periodo_id" BIGINT NOT NULL,
  "nivel" VARCHAR(30) NOT NULL DEFAULT 'general',
  "nombre" VARCHAR(80) NOT NULL,
  "cantidad_cuotas" SMALLINT NOT NULL,
  "monto_total" DECIMAL(12,2) NOT NULL,
  "monto_cuota" DECIMAL(12,2) NOT NULL,
  "dia_vencimiento" SMALLINT NOT NULL DEFAULT 10,
  "estado" VARCHAR(20) NOT NULL DEFAULT 'generado',
  "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "uq_plan_periodo_nivel" UNIQUE ("periodo_id", "nivel")
);

CREATE TABLE IF NOT EXISTS "cuotas_plan_pago" (
  "id" BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  "plan_id" BIGINT NOT NULL,
  "numero" SMALLINT NOT NULL,
  "anio" SMALLINT NOT NULL,
  "mes" SMALLINT NOT NULL,
  "fecha_vencimiento" DATE NOT NULL,
  "monto" DECIMAL(12,2) NOT NULL,
  "estado" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  CONSTRAINT "uq_cuota_plan_numero" UNIQUE ("plan_id", "numero")
);

CREATE TABLE IF NOT EXISTS "solicitudes_inscripcion" (
  "id" BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  "estudiante_id" BIGINT NOT NULL,
  "periodo_id" BIGINT NOT NULL,
  "curso_periodo_destino_id" BIGINT NOT NULL,
  "tipo" VARCHAR(20) NOT NULL,
  "estado" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  "motivo" TEXT,
  "solicitante_id" BIGINT,
  "procesado_por" BIGINT,
  "fecha_solicitud" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fecha_proceso" TIMESTAMPTZ,
  "observacion" TEXT
);

-- Turnos de referencia para que la generación pueda ejecutarse sin una carga manual.
-- Las filas son idempotentes.
INSERT INTO "turnos" ("codigo", "nombre", "hora_inicio", "hora_fin", "receso_inicio", "receso_fin")
VALUES
  ('manana', 'Turno Mañana', '07:00', '12:30', '09:30', '10:00'),
  ('tarde', 'Turno Tarde', '14:00', '18:30', '16:00', '16:30')
ON CONFLICT ("codigo") DO UPDATE SET
  "nombre" = EXCLUDED."nombre",
  "hora_inicio" = EXCLUDED."hora_inicio",
  "hora_fin" = EXCLUDED."hora_fin",
  "receso_inicio" = EXCLUDED."receso_inicio",
  "receso_fin" = EXCLUDED."receso_fin";

UPDATE "cursos_periodo"
SET "turno_id" = (SELECT "id" FROM "turnos" WHERE "codigo" = 'manana')
WHERE "turno_id" IS NULL;

ALTER TABLE "cursos_periodo" ALTER COLUMN "turno_id" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_curso_periodo_id_periodo"
  ON "cursos_periodo" ("id", "periodo_id");

-- Restricciones y datos de referencia para instalaciones ya inicializadas.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_periodo_gestion_fechas') THEN
    ALTER TABLE "periodos_academicos" ADD CONSTRAINT "chk_periodo_gestion_fechas" CHECK ("fin_gestion" > "inicio_gestion");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_periodo_fechas') THEN
    ALTER TABLE "periodos_academicos" ADD CONSTRAINT "chk_periodo_fechas" CHECK ("fecha_fin" > "fecha_inicio");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_periodo_estado') THEN
    ALTER TABLE "periodos_academicos" ADD CONSTRAINT "chk_periodo_estado" CHECK ("estado" IN ('borrador', 'configuracion', 'activo', 'cerrado', 'cancelado'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_periodo_origen') THEN
    ALTER TABLE "periodos_academicos" ADD CONSTRAINT "fk_periodo_origen" FOREIGN KEY ("origen_periodo_id") REFERENCES "periodos_academicos" ("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_trimestre_periodo') THEN
    ALTER TABLE "trimestres" ADD CONSTRAINT "fk_trimestre_periodo" FOREIGN KEY ("periodo_id") REFERENCES "periodos_academicos" ("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_curso_periodo_turno') THEN
    ALTER TABLE "cursos_periodo" ADD CONSTRAINT "fk_curso_periodo_turno" FOREIGN KEY ("turno_id") REFERENCES "turnos" ("id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_malla_periodo') THEN
    ALTER TABLE "mallas_curriculares" ADD CONSTRAINT "fk_malla_periodo" FOREIGN KEY ("periodo_id") REFERENCES "periodos_academicos" ("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_malla_materia') THEN
    ALTER TABLE "mallas_curriculares" ADD CONSTRAINT "fk_malla_materia" FOREIGN KEY ("materia_id") REFERENCES "materias" ("id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_horario_curso_periodo') THEN
    ALTER TABLE "horarios" ADD CONSTRAINT "fk_horario_curso_periodo" FOREIGN KEY ("curso_periodo_id") REFERENCES "cursos_periodo" ("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_horario_materia') THEN
    ALTER TABLE "horarios" ADD CONSTRAINT "fk_horario_materia" FOREIGN KEY ("materia_id") REFERENCES "materias" ("id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_horario_asignacion') THEN
    ALTER TABLE "horarios" ADD CONSTRAINT "fk_horario_asignacion" FOREIGN KEY ("asignacion_id") REFERENCES "asignaciones_docentes" ("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_horario_maestro') THEN
    ALTER TABLE "horarios" ADD CONSTRAINT "fk_horario_maestro" FOREIGN KEY ("maestro_id") REFERENCES "maestros" ("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_horario_aula') THEN
    ALTER TABLE "horarios" ADD CONSTRAINT "fk_horario_aula" FOREIGN KEY ("aula_id") REFERENCES "aulas" ("id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_horario_turno') THEN
    ALTER TABLE "horarios" ADD CONSTRAINT "fk_horario_turno" FOREIGN KEY ("turno_id") REFERENCES "turnos" ("id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_plan_periodo') THEN
    ALTER TABLE "planes_pago" ADD CONSTRAINT "fk_plan_periodo" FOREIGN KEY ("periodo_id") REFERENCES "periodos_academicos" ("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pension_plan') THEN
    ALTER TABLE "pensiones" ADD CONSTRAINT "fk_pension_plan" FOREIGN KEY ("plan_pago_id") REFERENCES "planes_pago" ("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cuota_plan') THEN
    ALTER TABLE "cuotas_plan_pago" ADD CONSTRAINT "fk_cuota_plan" FOREIGN KEY ("plan_id") REFERENCES "planes_pago" ("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_solicitud_estudiante') THEN
    ALTER TABLE "solicitudes_inscripcion" ADD CONSTRAINT "fk_solicitud_estudiante" FOREIGN KEY ("estudiante_id") REFERENCES "estudiantes" ("id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_solicitud_periodo') THEN
    ALTER TABLE "solicitudes_inscripcion" ADD CONSTRAINT "fk_solicitud_periodo" FOREIGN KEY ("periodo_id") REFERENCES "periodos_academicos" ("id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_solicitud_curso_destino') THEN
    ALTER TABLE "solicitudes_inscripcion" ADD CONSTRAINT "fk_solicitud_curso_destino" FOREIGN KEY ("curso_periodo_destino_id") REFERENCES "cursos_periodo" ("id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_solicitud_curso_periodo') THEN
    ALTER TABLE "solicitudes_inscripcion" ADD CONSTRAINT "fk_solicitud_curso_periodo" FOREIGN KEY ("curso_periodo_destino_id", "periodo_id") REFERENCES "cursos_periodo" ("id", "periodo_id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_solicitud_solicitante') THEN
    ALTER TABLE "solicitudes_inscripcion" ADD CONSTRAINT "fk_solicitud_solicitante" FOREIGN KEY ("solicitante_id") REFERENCES "usuarios" ("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_solicitud_procesado') THEN
    ALTER TABLE "solicitudes_inscripcion" ADD CONSTRAINT "fk_solicitud_procesado" FOREIGN KEY ("procesado_por") REFERENCES "usuarios" ("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_inscripcion_periodo') THEN
    ALTER TABLE "inscripciones" ADD CONSTRAINT "fk_inscripcion_periodo" FOREIGN KEY ("periodo_id") REFERENCES "periodos_academicos" ("id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_inscripcion_curso_periodo') THEN
    ALTER TABLE "inscripciones" ADD CONSTRAINT "fk_inscripcion_curso_periodo" FOREIGN KEY ("curso_periodo_id", "periodo_id") REFERENCES "cursos_periodo" ("id", "periodo_id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_inscripcion_solicitud') THEN
    ALTER TABLE "inscripciones" ADD CONSTRAINT "fk_inscripcion_solicitud" FOREIGN KEY ("solicitud_id") REFERENCES "solicitudes_inscripcion" ("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_materia_tipo') THEN
    ALTER TABLE "materias" ADD CONSTRAINT "chk_materia_tipo" CHECK ("tipo_materia" IN ('principal', 'extracurricular'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_materia_carga') THEN
    ALTER TABLE "materias" ADD CONSTRAINT "chk_materia_carga" CHECK ("carga_horaria_semanal" > 0 AND "peso_sintactico" > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_inscripcion_origen') THEN
    ALTER TABLE "inscripciones" ADD CONSTRAINT "chk_inscripcion_origen" CHECK ("origen" IN ('nueva', 'reserva', 'promocion'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_turnos_codigo') THEN
    ALTER TABLE "turnos" ADD CONSTRAINT "chk_turnos_codigo" CHECK ("codigo" IN ('manana', 'tarde'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_turnos_horario') THEN
    ALTER TABLE "turnos" ADD CONSTRAINT "chk_turnos_horario" CHECK ("hora_fin" > "hora_inicio" AND "receso_fin" > "receso_inicio");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_trimestre_numero') THEN
    ALTER TABLE "trimestres" ADD CONSTRAINT "chk_trimestre_numero" CHECK ("numero" BETWEEN 1 AND 3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_trimestre_fechas_migration') THEN
    ALTER TABLE "trimestres" ADD CONSTRAINT "chk_trimestre_fechas_migration" CHECK ("fin" >= "inicio");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_aula_capacidad') THEN
    ALTER TABLE "aulas" ADD CONSTRAINT "chk_aula_capacidad" CHECK ("capacidad" > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_malla_valores') THEN
    ALTER TABLE "mallas_curriculares" ADD CONSTRAINT "chk_malla_valores" CHECK ("nivel" IN ('inicial', 'primaria', 'secundaria', 'bachillerato') AND "tipo_materia" IN ('principal', 'extracurricular') AND "carga_horaria_semanal" > 0 AND "peso_sintactico" > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_horario_bloque') THEN
    ALTER TABLE "horarios" ADD CONSTRAINT "chk_horario_bloque" CHECK ("dia_semana" BETWEEN 1 AND 5 AND "hora_fin" > "hora_inicio");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_maestro_materias_maestro') THEN
    ALTER TABLE "maestro_materias" ADD CONSTRAINT "fk_maestro_materias_maestro" FOREIGN KEY ("maestro_id") REFERENCES "maestros" ("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_maestro_materias_materia') THEN
    ALTER TABLE "maestro_materias" ADD CONSTRAINT "fk_maestro_materias_materia" FOREIGN KEY ("materia_id") REFERENCES "materias" ("id") ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_plan_valores') THEN
    ALTER TABLE "planes_pago" ADD CONSTRAINT "chk_plan_valores" CHECK ("cantidad_cuotas" > 0 AND "monto_total" > 0 AND "monto_cuota" > 0 AND "dia_vencimiento" BETWEEN 1 AND 28);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cuota_valores') THEN
    ALTER TABLE "cuotas_plan_pago" ADD CONSTRAINT "chk_cuota_valores" CHECK ("numero" > 0 AND "mes" BETWEEN 1 AND 12 AND "monto" > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_solicitud_estado') THEN
    ALTER TABLE "solicitudes_inscripcion" ADD CONSTRAINT "chk_solicitud_estado" CHECK ("tipo" IN ('reserva', 'promocion') AND "estado" IN ('pendiente', 'aprobada', 'rechazada'));
  END IF;
END $$;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY anio DESC, fecha_inicio DESC, id DESC) AS rn
  FROM periodos_academicos WHERE activo = true
)
UPDATE periodos_academicos p
SET activo = false, estado = 'cerrado'
FROM ranked
WHERE p.id = ranked.id AND ranked.rn > 1;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY estudiante_id, periodo_id ORDER BY fecha_inscripcion DESC, id DESC) AS rn
  FROM inscripciones WHERE estado = 'activo'
)
UPDATE inscripciones i
SET estado = 'retirado', fecha_retiro = COALESCE(fecha_retiro, CURRENT_DATE)
FROM ranked
WHERE i.id = ranked.id AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_curso"
  ON "cursos" ("nivel", "grado", "paralelo");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_curso_periodo"
  ON "cursos_periodo" ("curso_id", "periodo_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_asignacion_docente"
  ON "asignaciones_docentes" ("maestro_id", "materia_id", "curso_periodo_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_curso_asesor"
  ON "curso_asesor" ("curso_periodo_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_trimestre_periodo_numero"
  ON "trimestres" ("periodo_id", "numero");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_malla_periodo_grado_materia"
  ON "mallas_curriculares" ("periodo_id", "nivel", "grado", "materia_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_periodo_activo"
  ON "periodos_academicos" ("activo") WHERE "activo" = true;
CREATE UNIQUE INDEX IF NOT EXISTS "uq_inscripcion_activa_periodo"
  ON "inscripciones" ("estudiante_id", "periodo_id") WHERE "estado" = 'activo';
CREATE UNIQUE INDEX IF NOT EXISTS "uq_inscripcion_solicitud"
  ON "inscripciones" ("solicitud_id") WHERE "solicitud_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_trimestre_periodo" ON "trimestres" ("periodo_id", "numero");
CREATE INDEX IF NOT EXISTS "idx_horario_curso_bloque" ON "horarios" ("curso_periodo_id", "dia_semana", "hora_inicio");
CREATE INDEX IF NOT EXISTS "idx_horario_docente_bloque" ON "horarios" ("maestro_id", "dia_semana", "hora_inicio");
CREATE INDEX IF NOT EXISTS "idx_horario_aula_bloque" ON "horarios" ("aula_id", "dia_semana", "hora_inicio");
CREATE INDEX IF NOT EXISTS "idx_plan_periodo" ON "planes_pago" ("periodo_id");
CREATE INDEX IF NOT EXISTS "idx_pension_plan" ON "pensiones" ("plan_pago_id", "numero_cuota");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_pension_plan_cuota" ON "pensiones" ("plan_pago_id", "estudiante_id", "numero_cuota") WHERE "plan_pago_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_cuota_plan" ON "cuotas_plan_pago" ("plan_id", "numero");
CREATE INDEX IF NOT EXISTS "idx_solicitud_estudiante" ON "solicitudes_inscripcion" ("estudiante_id", "estado");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_solicitud_pendiente" ON "solicitudes_inscripcion" ("estudiante_id", "curso_periodo_destino_id") WHERE "estado" = 'pendiente';

COMMIT;
