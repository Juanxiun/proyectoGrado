export const API_BASE_URL = __DEV__
  ? 'http://localhost:5141'
  : 'http://localhost:5141';

export const USER_SERVICE_WS_URL = __DEV__
  ? 'ws://localhost:8000'
  : 'wss://localhost:8000';

export const APP_VERSION = 'v1.0.0';

export const ROLES = {
  DIRECTOR: 'director',
  GERENCIA: 'gerencia',
  PROFESOR: 'profesor',
  MAESTRO: 'maestro',
  MAESTROS: 'maestros',
  CONTROL: 'control',
  ESTUDIANTE: 'estudiante',
  PADRES: 'padres',
} as const;

export type RolNombre = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_DASHBOARD_MAP: Record<string, string> = {
  [ROLES.DIRECTOR]: 'Direccion',
  [ROLES.GERENCIA]: 'Control',
  [ROLES.PROFESOR]: 'Maestros',
  [ROLES.MAESTRO]: 'Maestros',
  [ROLES.MAESTROS]: 'Maestros',
  [ROLES.CONTROL]: 'Control',
  [ROLES.ESTUDIANTE]: 'Usuarios',
  [ROLES.PADRES]: 'Usuarios',
};

export const STORAGE_KEYS = {
  TOKEN: 'sga_token',
  USER: 'sga_user',
} as const;

export const BREAKPOINTS = {
  MOBILE: 768,
} as const;
