import type { NavItem } from '../displays/components/Sidebar';

export const BASE_NAV: NavItem[] = [
  { key: 'home', label: 'Home', icon: 'home-outline', route: 'Dashboard' },
  { key: 'profile', label: 'Mi Cuenta', icon: 'person-outline', route: 'Profile' },
];

export const DIRECTOR_NAV: NavItem[] = [
  { key: 'home', label: 'Home', icon: 'home-outline', route: 'Dashboard' },
  { key: 'administracion', label: 'Administración', icon: 'shield-outline', route: 'Administrativo' },
  { key: 'docentes', label: 'Docentes', icon: 'school-outline', route: 'Docentes' },
  { key: 'estudiantes', label: 'Estudiantes', icon: 'people-outline', route: 'Estudiantes' },
  { key: 'materias', label: 'Materias', icon: 'book-outline', route: 'Estructura' },
  { key: 'evaluaciones', label: 'Evaluaciones', icon: 'clipboard-outline', route: 'Evaluaciones' },
  { key: 'economico', label: 'Económico', icon: 'wallet-outline', route: 'Tesoreria' },
  { key: 'mi_cuenta', label: 'Mi Cuenta', icon: 'person-outline', route: 'Profile' },
];

export const CONTROL_NAV: NavItem[] = [
  { key: 'home', label: 'Home', icon: 'home-outline', route: 'Dashboard' },
  { key: 'docentes', label: 'Docentes', icon: 'school-outline', route: 'Docentes' },
  { key: 'estudiantes', label: 'Estudiantes', icon: 'people-outline', route: 'Estudiantes' },
  { key: 'materias', label: 'Materias', icon: 'book-outline', route: 'Inscripciones' },
  { key: 'evaluaciones', label: 'Evaluaciones', icon: 'clipboard-outline', route: 'Evaluaciones' },
  { key: 'economico', label: 'Económico', icon: 'wallet-outline', route: 'Tesoreria' },
  { key: 'mi_cuenta', label: 'Mi Cuenta', icon: 'person-outline', route: 'Profile' },
];

export const MAESTROS_NAV: NavItem[] = [
  { key: 'home', label: 'Home', icon: 'home-outline', route: 'Dashboard' },
  { key: 'estudiantes', label: 'Estudiantes', icon: 'people-outline', route: 'Estudiantes' },
  { key: 'materias', label: 'Materias', icon: 'book-outline', route: 'Cursos' },
  { key: 'evaluaciones', label: 'Evaluaciones', icon: 'clipboard-outline', route: 'Evaluaciones' },
  { key: 'horario', label: 'Horario', icon: 'time-outline', route: 'Horario' },
  { key: 'mi_cuenta', label: 'Mi Cuenta', icon: 'person-outline', route: 'Profile' },
];

export const USUARIOS_NAV: NavItem[] = [
  { key: 'home', label: 'Home', icon: 'home-outline', route: 'Dashboard' },
  { key: 'materias', label: 'Materias', icon: 'book-outline', route: 'Materias' },
  { key: 'evaluaciones', label: 'Evaluaciones', icon: 'clipboard-outline', route: 'Calificaciones' },
  { key: 'economico', label: 'Económico', icon: 'card-outline', route: 'Pagos' },
  { key: 'mi_cuenta', label: 'Mi Cuenta', icon: 'person-outline', route: 'Profile' },
];