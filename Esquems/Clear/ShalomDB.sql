-- Vacía todas las tablas del esquema public y reinicia las secuencias identity.
-- Ejecutar conectado a ShalomDB. No elimina tablas, índices ni restricciones.
BEGIN;

DO $$
DECLARE
  tablas TEXT;
BEGIN
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ' ORDER BY tablename)
    INTO tablas
  FROM pg_tables
  WHERE schemaname = 'public';

  IF tablas IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE ' || tablas || ' RESTART IDENTITY CASCADE';
  END IF;
END
$$;

COMMIT;
