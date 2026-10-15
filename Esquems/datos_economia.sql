
BEGIN;

CREATE TEMP TABLE tmp_econ_periodo ON COMMIT DROP AS
SELECT p."id", p."anio", p."inicio_gestion"
FROM "periodos_academicos" p
WHERE p."activo" = true
ORDER BY p."id"
LIMIT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tmp_econ_periodo) THEN
    RAISE EXCEPTION 'No hay periodo academico activo para generar datos economicos';
  END IF;
END $$;

-- planes -> crea el plan de cada nivel activo si no existe
INSERT INTO "planes_pago"
  ("periodo_id", "nivel", "nombre", "cantidad_cuotas", "monto_total", "monto_cuota", "dia_vencimiento", "estado")
SELECT tp."id", c."nivel", 'Plan ' || c."nivel" || ' ' || tp."anio", 11, 3850.00, 350.00, 10, 'generado'
FROM tmp_econ_periodo tp
JOIN "cursos_periodo" cp ON cp."periodo_id" = tp."id" AND cp."estado" = 'activo'
JOIN "cursos" c ON c."id" = cp."curso_id" AND c."activo" = true
GROUP BY tp."id", tp."anio", c."nivel"
ON CONFLICT ("periodo_id", "nivel") DO NOTHING;

-- cuotas -> genera las cuotas de los planes que no tengan ninguna
INSERT INTO "cuotas_plan_pago" ("plan_id", "numero", "anio", "mes", "fecha_vencimiento", "monto", "estado")
SELECT pp."id",
       g.numero,
       tp."anio" + ((EXTRACT(MONTH FROM tp."inicio_gestion")::int + g.numero - 2) / 12),
       ((EXTRACT(MONTH FROM tp."inicio_gestion")::int + g.numero - 2) % 12) + 1,
       make_date(
         tp."anio" + ((EXTRACT(MONTH FROM tp."inicio_gestion")::int + g.numero - 2) / 12),
         ((EXTRACT(MONTH FROM tp."inicio_gestion")::int + g.numero - 2) % 12) + 1,
         LEAST(pp."dia_vencimiento", 28)
       ),
       ROUND(pp."monto_total" / pp."cantidad_cuotas", 2),
       'pendiente'
FROM "planes_pago" pp
JOIN tmp_econ_periodo tp ON tp."id" = pp."periodo_id"
CROSS JOIN LATERAL generate_series(1, pp."cantidad_cuotas") AS g(numero)
WHERE pp."estado" = 'generado'
  AND NOT EXISTS (SELECT 1 FROM "cuotas_plan_pago" c WHERE c."plan_id" = pp."id");

-- cuotas -> pagadas las vencidas y pendientes las futuras del periodo
UPDATE "cuotas_plan_pago" c
SET "estado" = CASE WHEN c."fecha_vencimiento" < CURRENT_DATE THEN 'pagado' ELSE 'pendiente' END
FROM "planes_pago" pp
WHERE c."plan_id" = pp."id"
  AND pp."periodo_id" = (SELECT "id" FROM tmp_econ_periodo)
  AND pp."estado" = 'generado';

-- pagos -> borra pagos y vinculos del periodo antes de rehacer pensiones
DELETE FROM "pago_pensiones"
WHERE "pension_id" IN (SELECT "id" FROM "pensiones" WHERE "periodo_id" = (SELECT "id" FROM tmp_econ_periodo));

DELETE FROM "pagos"
WHERE "estudiante_id" IN (SELECT "estudiante_id" FROM "inscripciones" WHERE "periodo_id" = (SELECT "id" FROM tmp_econ_periodo));

-- pensiones -> borra las pensiones viejas del periodo
DELETE FROM "pensiones" WHERE "periodo_id" = (SELECT "id" FROM tmp_econ_periodo);

-- pensiones -> una por cuota del plan del nivel del estudiante
-- perfil (id*31+7)%100: 0-49 al dia, 50-69 una cuota vencida, 70-89 tres,
-- 90-95 cinco y 96-99 beca anulada. adelanto (id*53+11)%100 < 35 paga la cuota del mes antes de vencer.
WITH estudiantes AS (
  SELECT i."estudiante_id",
         c."nivel",
         ((i."estudiante_id" * 31 + 7) % 100) AS perfil,
         ((i."estudiante_id" * 53 + 11) % 100) AS adelanto
  FROM "inscripciones" i
  JOIN "cursos_periodo" cp ON cp."id" = i."curso_periodo_id"
  JOIN "cursos" c ON c."id" = cp."curso_id"
  WHERE i."periodo_id" = (SELECT "id" FROM tmp_econ_periodo) AND i."estado" = 'activo'
),
ultima_vencida AS (
  SELECT cu."plan_id", MAX(cu."numero") AS numero
  FROM "cuotas_plan_pago" cu
  JOIN "planes_pago" pp ON pp."id" = cu."plan_id"
  WHERE pp."periodo_id" = (SELECT "id" FROM tmp_econ_periodo)
    AND cu."fecha_vencimiento" < CURRENT_DATE
  GROUP BY cu."plan_id"
)
INSERT INTO "pensiones"
  ("estudiante_id", "periodo_id", "plan_pago_id", "numero_cuota", "concepto", "mes", "monto", "fecha_vencimiento", "estado")
SELECT e."estudiante_id",
       tp."id",
       pp."id",
       cu."numero",
       pp."nombre",
       cu."mes",
       cu."monto",
       cu."fecha_vencimiento",
       CASE
         WHEN e.perfil >= 96 THEN 'anulado'
         WHEN cu."fecha_vencimiento" < CURRENT_DATE THEN
           CASE
             WHEN e.perfil < 50 THEN 'pagado'
             WHEN e.perfil < 70 AND cu."numero" = uv.numero THEN 'vencido'
             WHEN e.perfil < 90 AND cu."numero" >= uv.numero - 2 THEN 'vencido'
             WHEN e.perfil < 96 AND cu."numero" >= uv.numero - 4 THEN 'vencido'
             ELSE 'pagado'
           END
         WHEN cu."anio" = EXTRACT(YEAR FROM CURRENT_DATE)::int
          AND cu."mes" = EXTRACT(MONTH FROM CURRENT_DATE)::int
          AND e.adelanto < 35 THEN 'pagado'
         ELSE 'pendiente'
       END
FROM estudiantes e
CROSS JOIN tmp_econ_periodo tp
JOIN "planes_pago" pp ON pp."periodo_id" = tp."id" AND pp."nivel" = e."nivel" AND pp."estado" = 'generado'
JOIN "cuotas_plan_pago" cu ON cu."plan_id" = pp."id"
LEFT JOIN ultima_vencida uv ON uv."plan_id" = pp."id"
ON CONFLICT ("estudiante_id", "periodo_id", "concepto", "mes") DO NOTHING;

-- pagos -> un pago confirmado por cada pension pagada (numero de recibo = pension)
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
       LEAST(pe."fecha_vencimiento" + (((pe."estudiante_id" * 17) % 9)::int),
             CURRENT_DATE - (((pe."estudiante_id" * 7) % 3)::int))::date,
       COALESCE(
         (SELECT u."id" FROM "usuarios" u WHERE u."rol_id" IN (1, 4) AND u."estado" = 'activo' ORDER BY u."id" LIMIT 1),
         (SELECT u."id" FROM "usuarios" u WHERE u."estado" = 'activo' ORDER BY u."id" LIMIT 1)
       ),
       'confirmado',
       NULL
FROM "pensiones" pe
WHERE pe."periodo_id" = (SELECT "id" FROM tmp_econ_periodo) AND pe."estado" = 'pagado';

-- pagos -> vincula cada pago con su pension
INSERT INTO "pago_pensiones" ("pago_id", "pension_id", "monto")
SELECT pg."id", pe."id", pe."monto"
FROM "pagos" pg
JOIN "pensiones" pe ON pg."numero_transaccion" = 'TRX-' || LPAD(pe."id"::text, 8, '0')
WHERE pe."periodo_id" = (SELECT "id" FROM tmp_econ_periodo)
  AND NOT EXISTS (
    SELECT 1 FROM "pago_pensiones" x WHERE x."pago_id" = pg."id" AND x."pension_id" = pe."id"
  );

-- resumen -> verificacion rapida
SELECT 'planes' AS tabla, COUNT(*)::text AS filas FROM "planes_pago" WHERE "periodo_id" = (SELECT "id" FROM tmp_econ_periodo)
UNION ALL SELECT 'cuotas pagadas', COUNT(*)::text FROM "cuotas_plan_pago" cu
  JOIN "planes_pago" pp ON pp."id" = cu."plan_id" WHERE pp."periodo_id" = (SELECT "id" FROM tmp_econ_periodo) AND cu."estado" = 'pagado'
UNION ALL SELECT 'cuotas pendientes', COUNT(*)::text FROM "cuotas_plan_pago" cu
  JOIN "planes_pago" pp ON pp."id" = cu."plan_id" WHERE pp."periodo_id" = (SELECT "id" FROM tmp_econ_periodo) AND cu."estado" = 'pendiente'
UNION ALL SELECT 'pensiones pagadas', COUNT(*)::text FROM "pensiones" WHERE "periodo_id" = (SELECT "id" FROM tmp_econ_periodo) AND "estado" = 'pagado'
UNION ALL SELECT 'pensiones vencidas', COUNT(*)::text FROM "pensiones" WHERE "periodo_id" = (SELECT "id" FROM tmp_econ_periodo) AND "estado" = 'vencido'
UNION ALL SELECT 'pensiones pendientes', COUNT(*)::text FROM "pensiones" WHERE "periodo_id" = (SELECT "id" FROM tmp_econ_periodo) AND "estado" = 'pendiente'
UNION ALL SELECT 'pensiones anuladas', COUNT(*)::text FROM "pensiones" WHERE "periodo_id" = (SELECT "id" FROM tmp_econ_periodo) AND "estado" = 'anulado'
UNION ALL SELECT 'pagos', COUNT(*)::text FROM "pagos" WHERE "estudiante_id" IN (SELECT "estudiante_id" FROM "inscripciones" WHERE "periodo_id" = (SELECT "id" FROM tmp_econ_periodo))
UNION ALL SELECT 'pagos del mes', COUNT(*)::text FROM "pagos" WHERE "fecha_pago" >= date_trunc('month', CURRENT_DATE)
  AND "estudiante_id" IN (SELECT "estudiante_id" FROM "inscripciones" WHERE "periodo_id" = (SELECT "id" FROM tmp_econ_periodo))
ORDER BY 1;

COMMIT;
