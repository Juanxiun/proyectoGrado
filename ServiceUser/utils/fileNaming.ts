/**
 * Utilidad para generar nombres de objeto en MinIO (Bucket: shalom)
 * Estructura requerida:
 *   - imagenes_estudiantes/<archivo>
 *   - imagenes_docentes/<archivo>
 *   - imagenes_administracion/<archivo>
 *   - documentos_<primaria o secundaria>/<grado>/<archivo>
 */

/**
 * Convierte texto a slug seguro para nombres de archivo y carpetas.
 * Elimina acentos, espacios y caracteres especiales.
 */
export function toSlug(text: string, maxLen = 30): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_") // reemplazar no-alfanuméricos por _
    .replace(/^_+|_+$/g, "") // trim underscores
    .slice(0, maxLen);
}

/**
 * Mapea el rol a la categoría de carpeta canónica de imágenes en MinIO:
 * imagenes_estudiantes | imagenes_docentes | imagenes_administracion
 */
export function getImageCategory(rol: string): "imagenes_estudiantes" | "imagenes_docentes" | "imagenes_administracion" {
  const r = (rol || "").toLowerCase().trim();
  if (r.includes("estudiante") || r.includes("alumno")) return "imagenes_estudiantes";
  if (r.includes("profesor") || r.includes("maestro") || r.includes("docente")) return "imagenes_docentes";
  return "imagenes_administracion";
}

/**
 * Compatibilidad con nombre anterior
 */
export function getFolderCategory(rol: string): "imagenes_estudiantes" | "imagenes_docentes" | "imagenes_administracion" {
  return getImageCategory(rol);
}

/**
 * Devuelve la abreviatura del rol para el nombre de archivo.
 */
export function getRolAbr(rol: string): string {
  const cat = getImageCategory(rol);
  switch (cat) {
    case "imagenes_estudiantes": return "est";
    case "imagenes_docentes": return "prof";
    case "imagenes_administracion": return "adm";
  }
}

/**
 * Genera el key (object name) de la foto de perfil en MinIO.
 * Formato: {imagenes_estudiantes|imagenes_docentes|imagenes_administracion}/nombre_apellido_rolAbr_perfil.<ext>
 *
 * @example buildPhotoKey("Juan", "Pérez", "estudiante", "jpg")
 *          → "imagenes_estudiantes/juan_perez_est_perfil.jpg"
 */
export function buildPhotoKey(
  nombre: string,
  apellido: string,
  rol: string,
  ext: string,
): string {
  const folder = getImageCategory(rol);
  const fileName = `${toSlug(nombre)}_${toSlug(apellido)}_${getRolAbr(rol)}_perfil.${ext}`;
  return `${folder}/${fileName}`;
}

/**
 * Genera el key (object name) de un documento PDF en MinIO.
 * Formato para estudiantes: documentos_<primaria o secundaria>/<grado>/nombre_apellido_rolAbr_tipoDoc.pdf
 * Formato para otros roles: documentos_docentes/... o documentos_administracion/...
 *
 * @example buildDocKey("Juan", "Pérez", "estudiante", "CI", "primaria", "1°")
 *          → "documentos_primaria/1/juan_perez_est_ci.pdf"
 */
export function buildDocKey(
  nombre: string,
  apellido: string,
  rol: string,
  tipoDoc: string,
  nivel?: string | null,
  grado?: string | null,
): string {
  const r = (rol || "").toLowerCase().trim();
  const tipo = toSlug(tipoDoc, 15) || "doc";
  const fileName = `${toSlug(nombre)}_${toSlug(apellido)}_${getRolAbr(rol)}_${tipo}.pdf`;

  if (r.includes("estudiante") || r.includes("alumno")) {
    const cleanNivel = (nivel || "").toLowerCase().includes("secundar") ? "secundaria" : "primaria";
    const cleanGrado = grado ? toSlug(grado) : "general";
    return `documentos_${cleanNivel}/${cleanGrado}/${fileName}`;
  }

  if (r.includes("profesor") || r.includes("maestro") || r.includes("docente")) {
    return `documentos_docentes/${fileName}`;
  }

  return `documentos_administracion/${fileName}`;
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
