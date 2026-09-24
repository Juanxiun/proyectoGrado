export const API_BASE_URL = __DEV__
  ? 'http://localhost:5141'
  : 'http://localhost:5141';

export const APP_VERSION = 'v1.0.0';

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
