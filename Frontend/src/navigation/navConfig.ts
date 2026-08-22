import type { NavItem } from '../displays/components/Sidebar';

export const BASE_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Panel', icon: 'grid-outline', route: 'Dashboard' },
  { key: 'profile', label: 'Mi Perfil', icon: 'person-outline', route: 'Profile' },
];

export const DIRECTOR_NAV: NavItem[] = [
  ...BASE_NAV,
  { key: 'usuarios', label: 'Usuarios', icon: 'people-outline', route: 'Usuarios' },
  { key: 'estructura', label: 'Estructura', icon: 'library-outline', route: 'Estructura' },
  { key: 'docentes', label: 'Docentes', icon: 'school-outline', route: 'Docentes' },
  { key: 'inscripciones', label: 'Inscripciones', icon: 'document-text-outline', route: 'Inscripciones' },
  { key: 'evaluaciones', label: 'Evaluaciones', icon: 'clipboard-outline', route: 'Evaluaciones' },
  { key: 'tesoreria', label: 'Tesorería', icon: 'wallet-outline', route: 'Tesoreria' },
];

export const CONTROL_NAV: NavItem[] = [
  ...BASE_NAV,
  { key: 'usuarios', label: 'Usuarios', icon: 'people-outline', route: 'Usuarios' },
  { key: 'inscripciones', label: 'Inscripciones', icon: 'document-text-outline', route: 'Inscripciones' },
  { key: 'tesoreria', label: 'Tesorería', icon: 'wallet-outline', route: 'Tesoreria' },
  { key: 'evaluaciones', label: 'Evaluaciones', icon: 'clipboard-outline', route: 'Evaluaciones' },
];

export const MAESTROS_NAV: NavItem[] = [
  ...BASE_NAV,
  { key: 'cursos', label: 'Mis Cursos', icon: 'book-outline', route: 'Cursos' },
  { key: 'evaluaciones', label: 'Evaluaciones', icon: 'clipboard-outline', route: 'Evaluaciones' },
  { key: 'horario', label: 'Horario', icon: 'time-outline', route: 'Horario' },
];

export const USUARIOS_NAV: NavItem[] = [
  ...BASE_NAV,
  { key: 'materias', label: 'Materias', icon: 'book-outline', route: 'Materias' },
  { key: 'calificaciones', label: 'Notas', icon: 'bar-chart-outline', route: 'Calificaciones' },
  { key: 'pagos', label: 'Pagos', icon: 'card-outline', route: 'Pagos' },
];
