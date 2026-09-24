import { query } from "../connects/Database/transaction.ts";

export type NivelMaterial = "primaria" | "secundaria";

export interface CursoMateriaInfo {
  materia: string;
  grado: string;
  paralelo: string;
  nivel: NivelMaterial;
}

export function toSlug(text: string, maxLen = 35): string {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_") // reemplazar no-alfanuméricos por _
    .replace(/^_+|_+$/g, "") // trim underscores
    .slice(0, maxLen) || "general";
}

export function sanitizeLevel(nivel?: string | null): NivelMaterial {
  const n = (nivel || "").toLowerCase().trim();
  if (n.includes("secundar") || n.includes("bachill") || n.includes("sec")) {
    return "secundaria";
  }
  return "primaria";
}

/**
 * Resuelve la materia, grado, paralelo y nivel a partir de una asignación docente.
 */
export async function resolveCursoInfoFromAsignacion(asignacionId: string | number): Promise<CursoMateriaInfo> {
  try {
    const res = await query<{ materia: string; grado: string; paralelo: string; nivel: string }>(
      `SELECT
         COALESCE(m.nombre, 'materia') AS materia,
         COALESCE(c.grado, '1') AS grado,
         COALESCE(c.paralelo, 'A') AS paralelo,
         COALESCE(c.nivel, 'primaria') AS nivel
       FROM asignaciones_docentes ad
       JOIN materias m ON m.id = ad.materia_id
       JOIN cursos_periodo cp ON cp.id = ad.curso_periodo_id
       JOIN cursos c ON c.id = cp.curso_id
       WHERE ad.id = $1`,
      [asignacionId],
    );
    if (res.rows.length > 0) {
      const row = res.rows[0];
      return {
        materia: row.materia,
        grado: row.grado,
        paralelo: row.paralelo,
        nivel: sanitizeLevel(row.nivel),
      };
    }
  } catch (err) {
    console.warn("[fileNaming] Error buscando curso info para asignacion:", err);
  }
  return { materia: "general", grado: "general", paralelo: "A", nivel: "primaria" };
}

/**
 * Resuelve la materia, grado, paralelo y nivel a partir de un encargo.
 */
export async function resolveCursoInfoFromEncargo(encargoId: string | number): Promise<CursoMateriaInfo> {
  try {
    const res = await query<{ materia: string; grado: string; paralelo: string; nivel: string }>(
      `SELECT
         COALESCE(m.nombre, 'materia') AS materia,
         COALESCE(c.grado, '1') AS grado,
         COALESCE(c.paralelo, 'A') AS paralelo,
         COALESCE(c.nivel, 'primaria') AS nivel
       FROM encargos e
       JOIN asignaciones_docentes ad ON ad.id = e.asignacion_id
       JOIN materias m ON m.id = ad.materia_id
       JOIN cursos_periodo cp ON cp.id = ad.curso_periodo_id
       JOIN cursos c ON c.id = cp.curso_id
       WHERE e.id = $1`,
      [encargoId],
    );
    if (res.rows.length > 0) {
      const row = res.rows[0];
      return {
        materia: row.materia,
        grado: row.grado,
        paralelo: row.paralelo,
        nivel: sanitizeLevel(row.nivel),
      };
    }
  } catch (err) {
    console.warn("[fileNaming] Error buscando curso info para encargo:", err);
  }
  return { materia: "general", grado: "general", paralelo: "A", nivel: "primaria" };
}

export async function resolveNivelFromAsignacion(asignacionId: string | number): Promise<NivelMaterial> {
  const info = await resolveCursoInfoFromAsignacion(asignacionId);
  return info.nivel;
}

export async function resolveNivelFromEncargo(encargoId: string | number): Promise<NivelMaterial> {
  const info = await resolveCursoInfoFromEncargo(encargoId);
  return info.nivel;
}

/**
 * Genera la ruta jerárquica canónica para materiales en MinIO:
 * material -> materia -> grado -> paralelo -> archivo
 */
export function buildMaterialObjectKey(
  info: CursoMateriaInfo,
  asignacionId: string | number,
  fileName: string,
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const mat = toSlug(info.materia);
  const grad = toSlug(info.grado);
  const par = toSlug(info.paralelo);
  return `material/${mat}/${grad}/${par}/${Date.now()}_asig${asignacionId}_${safeName}`;
}

/**
 * Genera la ruta jerárquica canónica para entregas de tareas en MinIO:
 * material -> materia -> grado -> paralelo -> entregas_encargoId_estudianteId_archivo
 */
export function buildEntregaObjectKey(
  info: CursoMateriaInfo,
  encargoId: string | number,
  subId: string | number,
  fileName: string,
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const mat = toSlug(info.materia);
  const grad = toSlug(info.grado);
  const par = toSlug(info.paralelo);
  return `material/${mat}/${grad}/${par}/entregas_${encargoId}_${subId}_${Date.now()}_${safeName}`;
}
