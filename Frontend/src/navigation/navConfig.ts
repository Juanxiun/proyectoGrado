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
  { key: 'estructura', label: 'Académico', icon: 'book-outline', route: 'Estructura' },
  { key: 'inscripciones', label: 'Inscripciones', icon: 'school-outline', route: 'Inscripciones' },
  { key: 'evaluaciones', label: 'Aula y evaluación', icon: 'clipboard-outline', route: 'Evaluaciones' },
  { key: 'horarios', label: 'Horarios', icon: 'time-outline', route: 'Horarios' },
  { key: 'economico', label: 'Económico', icon: 'wallet-outline', route: 'Tesoreria' },
  { key: 'mi_cuenta', label: 'Mi Cuenta', icon: 'person-outline', route: 'Profile' },
];

export const CONTROL_NAV: NavItem[] = [
  { key: 'home', label: 'Home', icon: 'home-outline', route: 'Dashboard' },
  { key: 'administracion', label: 'Administración', icon: 'shield-outline', route: 'Administrativo' },
  { key: 'docentes', label: 'Docentes', icon: 'school-outline', route: 'Docentes' },
  { key: 'estudiantes', label: 'Estudiantes', icon: 'people-outline', route: 'Estudiantes' },
  { key: 'inscripciones', label: 'Inscripciones', icon: 'book-outline', route: 'Inscripciones' },
  { key: 'evaluaciones', label: 'Aula y evaluación', icon: 'clipboard-outline', route: 'Evaluaciones' },
  { key: 'horarios', label: 'Horarios', icon: 'time-outline', route: 'Horarios' },
  { key: 'economico', label: 'Económico', icon: 'wallet-outline', route: 'Tesoreria' },
  { key: 'mi_cuenta', label: 'Mi Cuenta', icon: 'person-outline', route: 'Profile' },
];

export const MAESTROS_NAV: NavItem[] = [
  { key: 'home', label: 'Inicio', icon: 'home-outline', route: 'Dashboard' },
  { key: 'cursos', label: 'Cursos', icon: 'school-outline', route: 'Cursos' },
  { key: 'materias', label: 'Materias', icon: 'book-outline', route: 'Materias' },
  { key: 'evaluaciones', label: 'Evaluaciones', icon: 'clipboard-outline', route: 'Evaluaciones' },
  { key: 'horarios', label: 'Horarios', icon: 'time-outline', route: 'Horarios' },
  { key: 'mi_cuenta', label: 'Mi Cuenta', icon: 'person-outline', route: 'Profile' },
];

export const USUARIOS_NAV: NavItem[] = [
  { key: 'home', label: 'Inicio', icon: 'home-outline', route: 'Dashboard' },
  { key: 'cursos', label: 'Cursos', icon: 'school-outline', route: 'Cursos' },
  { key: 'materias', label: 'Materias', icon: 'book-outline', route: 'Materias' },
  { key: 'evaluaciones', label: 'Evaluaciones', icon: 'clipboard-outline', route: 'Evaluaciones' },
  { key: 'horarios', label: 'Horarios', icon: 'time-outline', route: 'Horarios' },
  { key: 'mi_cuenta', label: 'Mi Cuenta', icon: 'person-outline', route: 'Profile' },
];
