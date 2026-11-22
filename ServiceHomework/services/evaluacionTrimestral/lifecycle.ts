// deno-lint-ignore-file no-explicit-any
import { pool } from "../../connects/Database/connect.ts";
import {
  deleteMaterialFile,
  readStoredFile,
} from "../../connects/Storage/minio.ts";
import { HttpError } from "../../utils/errors.ts";
import {
  ensureEvaluacionesTrimestralesTable,
  getEvaluacionTrimestralById,
} from "./repository.ts";

export async function aprobarEvaluacionTrimestral(examId: number) {
  const exam = await getEvaluacionTrimestralById(examId);
  if (!exam.preguntas.length) {
    throw new HttpError(400, "La evaluación no contiene preguntas.");
  }

  const pendientes = exam.preguntas.filter((q: any) => q.estado !== "aprobada");
  if (pendientes.length > 0) {
    throw new HttpError(
      400,
      `Debe aprobar todas las preguntas antes de generar el PDF (faltan ${pendientes.length}).`,
    );
  }

  const client = await pool.connect();
  let oldKey: string | null = null;
  const nextVersion = (exam.versionPdf || 0) + 1;
  try {
    const prevRes = await client.queryObject<any>(
      `SELECT archivo_key FROM evaluaciones_trimestrales WHERE id = $1`,
      [examId],
    );
    oldKey = prevRes.rows[0]?.archivo_key ?? null;

    await client.queryArray(
      `
      UPDATE evaluaciones_trimestrales
      SET estado = 'aprobada',
          archivo_url = NULL,
          archivo_key = NULL,
          version_pdf = $2,
          fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [examId, nextVersion],
    );
  } finally {
    client.release();
  }

  if (oldKey) {
    try {
      await deleteMaterialFile(oldKey);
    } catch (error) {
      console.warn("[EvaluacionTrimestral] No se pudo eliminar el PDF anterior:", error);
    }
  }

  return getEvaluacionTrimestralById(examId);
}

export async function obtenerPdfEvaluacionTrimestral(examId: number): Promise<{ bytes: Uint8Array; fileName: string }> {
  await ensureEvaluacionesTrimestralesTable();
  const client = await pool.connect();
  try {
    const res = await client.queryObject<any>(
      `SELECT archivo_key, archivo_url, titulo, version_pdf FROM evaluaciones_trimestrales WHERE id = $1 LIMIT 1`,
      [examId],
    );
    const row = res.rows[0];
    if (!row || (!row.archivo_key && !row.archivo_url)) {
      throw new HttpError(404, "El PDF de esta evaluación trimestral aún no ha sido generado.");
    }
    const bytes = await readStoredFile(row.archivo_key || row.archivo_url);
    const safeTitle = String(row.titulo ?? `evaluacion_trimestral_${examId}`)
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .slice(0, 60);
    return {
      bytes,
      fileName: `${safeTitle}_v${row.version_pdf || 1}.pdf`,
    };
  } finally {
    client.release();
  }
}

export async function eliminarEvaluacionTrimestral(examId: number): Promise<void> {
  await ensureEvaluacionesTrimestralesTable();
  const client = await pool.connect();
  try {
    const res = await client.queryObject<any>(
      `DELETE FROM evaluaciones_trimestrales WHERE id = $1 RETURNING archivo_key`,
      [examId],
    );
    if (!res.rows[0]) {
      throw new HttpError(404, "Evaluación trimestral no encontrada.");
    }
    if (res.rows[0].archivo_key) {
      await deleteMaterialFile(res.rows[0].archivo_key);
    }
  } finally {
    client.release();
  }
}
