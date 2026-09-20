import { query } from "../connects/Database/transaction.ts";

export type NivelMaterial = "primaria" | "secundaria";

export function sanitizeLevel(nivel?: string | null): NivelMaterial {
  const n = (nivel || "").toLowerCase().trim();
  if (n.includes("secundar") || n.includes("bachill") || n.includes("sec")) {
    return "secundaria";
  }
  return "primaria";
}

export async function resolveNivelFromAsignacion(asignacionId: string | number): Promise<NivelMaterial> {
  try {
    const res = await query<{ nivel: string }>(
      `SELECT c.nivel 
       FROM asignaciones_docentes ad
       JOIN cursos_periodo cp ON cp.id = ad.curso_periodo_id
       JOIN cursos c ON c.id = cp.curso_id
       WHERE ad.id = $1`,
      [asignacionId],
    );
    if (res.rows.length > 0) {
      return sanitizeLevel(res.rows[0].nivel);
    }
  } catch (err) {
    console.warn("[fileNaming] Error buscando nivel para asignacion:", err);
  }
  return "primaria";
}

export async function resolveNivelFromEncargo(encargoId: string | number): Promise<NivelMaterial> {
  try {
    const res = await query<{ nivel: string }>(
      `SELECT c.nivel 
       FROM encargos e
       JOIN asignaciones_docentes ad ON ad.id = e.asignacion_id
       JOIN cursos_periodo cp ON cp.id = ad.curso_periodo_id
       JOIN cursos c ON c.id = cp.curso_id
       WHERE e.id = $1`,
      [encargoId],
    );
    if (res.rows.length > 0) {
      return sanitizeLevel(res.rows[0].nivel);
    }
  } catch (err) {
    console.warn("[fileNaming] Error buscando nivel para encargo:", err);
  }
  return "primaria";
}

export function buildMaterialObjectKey(
  nivel: NivelMaterial,
  asignacionId: string | number,
  fileName: string,
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `material/${nivel}/${asignacionId}_${Date.now()}_${safeName}`;
}

export function buildEntregaObjectKey(
  nivel: NivelMaterial,
  encargoId: string | number,
  subId: string | number,
  fileName: string,
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `material/${nivel}/entregas_${encargoId}_${subId}_${Date.now()}_${safeName}`;
}
