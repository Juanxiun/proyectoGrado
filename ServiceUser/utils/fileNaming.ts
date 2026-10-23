// util -> nombres objeto minio

// funcion -> convertir texto slug
export function toSlug(text: string, maxLen = 30): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, maxLen);
}

// util -> carpeta imagenes por rol
export function getImageCategory(rol: string): "imagenes_estudiantes" | "imagenes_docentes" | "imagenes_administracion" {
  const r = (rol || "").toLowerCase().trim();
  if (r.includes("estudiante") || r.includes("alumno")) return "imagenes_estudiantes";
  if (r.includes("profesor") || r.includes("maestro") || r.includes("docente")) return "imagenes_docentes";
  return "imagenes_administracion";
}

// util -> alias categoria anterior
export function getFolderCategory(rol: string): "imagenes_estudiantes" | "imagenes_docentes" | "imagenes_administracion" {
  return getImageCategory(rol);
}

// util -> abreviatura del rol
export function getRolAbr(rol: string): string {
  const cat = getImageCategory(rol);
  switch (cat) {
    case "imagenes_estudiantes": return "est";
    case "imagenes_docentes": return "prof";
    case "imagenes_administracion": return "adm";
  }
}

// funcion -> clave foto perfil
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

// funcion -> clave documento minio
export function buildDocKey(
  nombre: string,
  apellido: string,
  rol: string,
  tipoDoc: string,
  nivel?: string | null,
  grado?: string | null,
  extension = "pdf",
): string {
  const r = (rol || "").toLowerCase().trim();
  const tipo = toSlug(tipoDoc, 15) || "doc";
  const ext = ["pdf", "docx", "xlsx", "xls"].includes(extension.toLowerCase()) ? extension.toLowerCase() : "pdf";
  const fileName = `${toSlug(nombre)}_${toSlug(apellido)}_${getRolAbr(rol)}_${tipo}.${ext}`;

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

// funcion -> detectar extension imagen
export function detectImageExt(bytes: Uint8Array): "png" | "jpg" | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
    bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a &&
    bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "png";

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpg";
  }

  return null;
}

// util -> mime desde extension
export function mimeFromExt(ext: "png" | "jpg"): string {
  return ext === "png" ? "image/png" : "image/jpeg";
}
