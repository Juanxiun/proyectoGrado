/**
 * Utilidad para generar nombres de objeto en MinIO
 * siguiendo la convención:
 *   nombre_apellido_<rolAbr>_<tipo>.<ext>
 *
 * Roles: est | prof | tut | dir | con
 * Tipos: perfil | ci | rude | <tipo_doc_sanitizado>
 */

/**
 * Convierte texto a slug seguro para nombres de archivo.
 * Elimina acentos, espacios y caracteres especiales.
 */
function toSlug(text: string, maxLen = 20): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_") // reemplazar no-alfanuméricos por _
    .replace(/^_+|_+$/g, "") // trim underscores
    .slice(0, maxLen);
}

/**
 * Devuelve la abreviatura del rol para el nombre de archivo.
 *   estudiante               → est
 *   profesor / maestro / docente → prof
 *   tutor / apoderado        → tut
 *   director / gerencia      → dir
 *   control / administrativo → con
 */
export function getRolAbr(rol: string): string {
  const r = rol.toLowerCase().trim();
  if (r === "estudiante") return "est";
  if (["profesor", "maestro", "docente"].includes(r)) return "prof";
  if (["tutor", "apoderado"].includes(r)) return "tut";
  if (["director", "gerencia"].includes(r)) return "dir";
  if (["control", "administrativo"].includes(r)) return "con";
  return r.slice(0, 3);
}

/**
 * Genera el key (object name) de la foto de perfil en MinIO.
 * Formato: nombre_apellido_rolAbr_perfil.<ext>
 *
 * @example buildPhotoKey("Juan", "Pérez", "estudiante", "jpg")
 *          → "juan_perez_est_perfil.jpg"
 */
export function buildPhotoKey(
  nombre: string,
  apellido: string,
  rol: string,
  ext: string,
): string {
  return `${toSlug(nombre)}_${toSlug(apellido)}_${getRolAbr(rol)}_perfil.${ext}`;
}

/**
 * Genera el key (object name) de un documento PDF en MinIO.
 * Formato: nombre_apellido_rolAbr_tipoDoc.pdf
 *
 * @example buildDocKey("Juan", "Pérez", "estudiante", "CI")
 *          → "juan_perez_est_ci.pdf"
 */
export function buildDocKey(
  nombre: string,
  apellido: string,
  rol: string,
  tipoDoc: string,
): string {
  const tipo = toSlug(tipoDoc, 15);
  return `${toSlug(nombre)}_${toSlug(apellido)}_${getRolAbr(rol)}_${tipo}.pdf`;
}

/**
 * Detecta la extensión real de una imagen por sus magic bytes.
 * @returns "png" | "jpg" | null si el formato no es reconocido
 */
export function detectImageExt(bytes: Uint8Array): "png" | "jpg" | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
    bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a &&
    bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "png";

  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpg";
  }

  return null;
}

/**
 * Devuelve el Content-Type MIME para una extensión de imagen.
 */
export function mimeFromExt(ext: "png" | "jpg"): string {
  return ext === "png" ? "image/png" : "image/jpeg";
}
