-- Migration: fix_usuario_documentos
-- Agrega UNIQUE(usuario_id, tipo_doc) a usuario_documentos para el UPSERT en update.ts.
-- El UNIQUE en numero_doc se mantiene para la unicidad global del documento.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'usuario_documentos_usuario_id_tipo_doc_key'
       AND conrelid = 'usuario_documentos'::regclass
  ) THEN
    ALTER TABLE usuario_documentos
      ADD CONSTRAINT usuario_documentos_usuario_id_tipo_doc_key
      UNIQUE (usuario_id, tipo_doc);
  END IF;
END;
$$;