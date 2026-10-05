export const API_BASE_URL = __DEV__
  ? 'http://localhost:5141'
  : 'http://localhost:5141';

export const APP_VERSION = 'v1.0.0';

// ── MinIO (archivos) ──────────────────────────────────────────────────────────
// La API devuelve `fotoUrl`, `archivoUrl` y `caratulaUrl` ya como URL absoluta
// (ver `buildPublicUrl` en ServiceUser/connects/Storage/minio.ts), así que acá
// sólo hace falta la URL de la foto por defecto, que el usuario no carga nunca.
//
// Misma advertencia que API_BASE_URL: en un dispositivo físico o emulador hay que
// poner la IP de la LAN, no `localhost`.
export const MEDIA_BASE_URL = 'http://localhost:9000';
export const MEDIA_BUCKET = 'usuarios';

/**
 * Foto de perfil por defecto de cualquier usuario sin `fotoUrl`.
 * Vive en MinIO como `usuarios/default/profil.jpg`.
 */
export const DEFAULT_USER_PHOTO = `${MEDIA_BASE_URL}/${MEDIA_BUCKET}/default/profil.jpg`;

export const ROLES = {
  DIRECTOR: 'director',
  ADMIN: 'admin',
  ADMINISTRADOR: 'administrador',
  GERENCIA: 'gerencia',
  PROFESOR: 'profesor',
  MAESTRO: 'maestro',
  MAESTROS: 'maestros',
  CONTROL: 'control',
  ESTUDIANTE: 'estudiante',
  ALUMNO: 'alumno',
  PADRES: 'padres',
  SECRETARIA: 'secretaria',
  SECRETARIO: 'secretario',
  ADMINISTRATIVO: 'administrativo',
  EDITOR: 'editor',
} as const;

export type RolNombre = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_DASHBOARD_MAP: Record<string, string> = {
  [ROLES.DIRECTOR]: 'Direccion',
  [ROLES.ADMIN]: 'Direccion',
  [ROLES.ADMINISTRADOR]: 'Direccion',
  'administradores': 'Direccion',
  'directores': 'Direccion',
  [ROLES.GERENCIA]: 'Control',
  [ROLES.PROFESOR]: 'Maestros',
  'profesores': 'Maestros',
  [ROLES.MAESTRO]: 'Maestros',
  [ROLES.MAESTROS]: 'Maestros',
  [ROLES.CONTROL]: 'Control',
  [ROLES.ESTUDIANTE]: 'Usuarios',
  'estudiantes': 'Usuarios',
  [ROLES.ALUMNO]: 'Usuarios',
  [ROLES.PADRES]: 'Usuarios',
  [ROLES.SECRETARIA]: 'Control',
  [ROLES.SECRETARIO]: 'Control',
  [ROLES.ADMINISTRATIVO]: 'Control',
  [ROLES.EDITOR]: 'Control',
};

export const STORAGE_KEYS = {
  TOKEN: 'sga_token',
  USER: 'sga_user',
} as const;

export const BREAKPOINTS = {
  MOBILE: 768,
} as const;
