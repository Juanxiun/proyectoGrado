import type { NavItem } from '../displays/components/Sidebar';

export const BASE_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Panel', icon: 'grid-outline', route: 'Dashboard' },
  { key: 'profile', label: 'Mi Perfil', icon: 'person-outline', route: 'Profile' },
];

export const DIRECTOR_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Panel', icon: 'grid-outline', route: 'Dashboard' },
  { key: 'docentes', label: 'Personal Docente', icon: 'school-outline', route: 'Docentes' },
  { key: 'estudiantes', label: 'Personal Estudiantil', icon: 'people-outline', route: 'Estudiantes' },
  { key: 'administrativo', label: 'Personal Administrativo', icon: 'shield-outline', route: 'Administrativo' },
  { key: 'estructura', label: 'Estructura', icon: 'library-outline', route: 'Estructura' },
  { key: 'inscripciones', label: 'Inscripciones', icon: 'document-text-outline', route: 'Inscripciones' },
  { key: 'evaluaciones', label: 'Evaluaciones', icon: 'clipboard-outline', route: 'Evaluaciones' },
  { key: 'tesoreria', label: 'Tesorería', icon: 'wallet-outline', route: 'Tesoreria' },
  { key: 'profile', label: 'Mi Perfil', icon: 'person-outline', route: 'Profile' },
];

export const CONTROL_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Panel', icon: 'grid-outline', route: 'Dashboard' },
  { key: 'docentes', label: 'Personal Docente', icon: 'school-outline', route: 'Docentes' },
  { key: 'estudiantes', label: 'Personal Estudiantil', icon: 'people-outline', route: 'Estudiantes' },
  { key: 'inscripciones', label: 'Inscripciones', icon: 'document-text-outline', route: 'Inscripciones' },
  { key: 'tesoreria', label: 'Tesorería', icon: 'wallet-outline', route: 'Tesoreria' },
  { key: 'evaluaciones', label: 'Evaluaciones', icon: 'clipboard-outline', route: 'Evaluaciones' },
  { key: 'profile', label: 'Mi Perfil', icon: 'person-outline', route: 'Profile' },
];

export const MAESTROS_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Panel', icon: 'grid-outline', route: 'Dashboard' },
  { key: 'estudiantes', label: 'Estudiantes', icon: 'people-outline', route: 'Estudiantes' },
  { key: 'cursos', label: 'Mis Cursos', icon: 'book-outline', route: 'Cursos' },
  { key: 'evaluaciones', label: 'Evaluaciones', icon: 'clipboard-outline', route: 'Evaluaciones' },
  { key: 'horario', label: 'Horario', icon: 'time-outline', route: 'Horario' },
  { key: 'profile', label: 'Mi Perfil', icon: 'person-outline', route: 'Profile' },
];

export const USUARIOS_NAV: NavItem[] = [
  { key: 'dashboard', label: 'Panel', icon: 'grid-outline', route: 'Dashboard' },
  { key: 'materias', label: 'Materias', icon: 'book-outline', route: 'Materias' },
  { key: 'calificaciones', label: 'Notas', icon: 'bar-chart-outline', route: 'Calificaciones' },
  { key: 'pagos', label: 'Pagos', icon: 'card-outline', route: 'Pagos' },
  { key: 'profile', label: 'Mi Perfil', icon: 'person-outline', route: 'Profile' },
];
