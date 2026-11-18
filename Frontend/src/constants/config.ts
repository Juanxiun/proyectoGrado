import { Platform } from 'react-native';

const DEFAULT_API_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  `http://${DEFAULT_API_HOST}:5141`;

export const APP_VERSION = 'v1.0.0';

// MEDIA_BASE_URL -> host de MinIO para la foto por defecto
export const MEDIA_BASE_URL =
  process.env.EXPO_PUBLIC_MEDIA_URL || `http://${DEFAULT_API_HOST}:9000`;
export const MEDIA_BUCKET = 'usuarios';

// resolveMediaUrl -> cambia hosts locales por el del gateway
export function resolveMediaUrl(rawUrl: string): string {
  try {
    const media = new URL(rawUrl);
    if (['localhost', '127.0.0.1', 'host.docker.internal'].includes(media.hostname)) {
      media.hostname = new URL(API_BASE_URL).hostname;
    }
    return media.toString();
  } catch {
    return rawUrl;
  }
}

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
