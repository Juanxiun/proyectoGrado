/**
 * Utilidad para generar nombres de objeto en MinIO (Bucket: Shalom_storage)
 * Estructura requerida:
 *   image/{estudiantes, maestros, directivos, control}/<archivo>
 *   documentos/{estudiantes, maestros, directivos, control}/<archivo>
 */

/**
 * Convierte texto a slug seguro para nombres de archivo.
 * Elimina acentos, espacios y caracteres especiales.
 */
function toSlug(text: string, maxLen = 25): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_") // reemplazar no-alfanuméricos por _
    .replace(/^_+|_+$/g, "") // trim underscores
    .slice(0, maxLen);
}

/**
 * Mapea el rol a la categoría de carpeta canónica en MinIO:
 * estudiantes | maestros | directivos | control
 */
export function getFolderCategory(rol: string): "estudiantes" | "maestros" | "directivos" | "control" {
  const r = (rol || "").toLowerCase().trim();
  if (r.includes("estudiante") || r.includes("alumno")) return "estudiantes";
  if (r.includes("profesor") || r.includes("maestro") || r.includes("docente")) return "maestros";
  if (r.includes("director") || r.includes("gerencia") || r.includes("directivo")) return "directivos";
  return "control";
}

/**
 * Devuelve la abreviatura del rol para el nombre de archivo.
 */
export function getRolAbr(rol: string): string {
  const cat = getFolderCategory(rol);
  switch (cat) {
    case "estudiantes": return "est";
    case "maestros": return "prof";
    case "directivos": return "dir";
    case "control": return "con";
  }
}

/**
 * Genera el key (object name) de la foto de perfil en MinIO.
 * Formato: image/{categoria}/nombre_apellido_rolAbr_perfil.<ext>
 *
 * @example buildPhotoKey("Juan", "Pérez", "estudiante", "jpg")
 *          → "image/estudiantes/juan_perez_est_perfil.jpg"
 */
export function buildPhotoKey(
  nombre: string,
  apellido: string,
  rol: string,
  ext: string,
): string {
  const category = getFolderCategory(rol);
  const fileName = `${toSlug(nombre)}_${toSlug(apellido)}_${getRolAbr(rol)}_perfil.${ext}`;
  return `image/${category}/${fileName}`;
}

/**
 * Genera el key (object name) de un documento PDF en MinIO.
 * Formato: documentos/{categoria}/nombre_apellido_rolAbr_tipoDoc.pdf
 *
 * @example buildDocKey("Juan", "Pérez", "estudiante", "CI")
 *          → "documentos/estudiantes/juan_perez_est_ci.pdf"
 */
export function buildDocKey(
  nombre: string,
  apellido: string,
  rol: string,
  tipoDoc: string,
): string {
  const category = getFolderCategory(rol);
  const tipo = toSlug(tipoDoc, 15);
  const fileName = `${toSlug(nombre)}_${toSlug(apellido)}_${getRolAbr(rol)}_${tipo}.pdf`;
  return `documentos/${category}/${fileName}`;
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
