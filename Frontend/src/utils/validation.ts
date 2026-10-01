/**
 * Las reglas de credenciales viven en src/shared/validation/credentials.ts.
 * Este módulo se conserva como punto de entrada compatible y además mantiene
 * los formateadores de uso general que usan las pantallas.
 */
export {
  USERNAME_MAX,
  PASSWORD_MIN,
  PASSWORD_MAX,
  USERNAME_REGEX,
  sanitizeUsername,
  sanitizePassword,
  validateUsername,
  validatePassword,
  validateLogin,
} from '../shared/validation/credentials';
export type { LoginValidation } from '../shared/validation/credentials';

export function isUsuarioActivo(estado: unknown): boolean {
  return estado === 1 || estado === 'activo';
}

export function isUsuarioInactivo(estado: unknown): boolean {
  return estado === 0 || estado === 2 || estado === 'inactivo' || estado === 'bloqueado';
}

export function getFullName(
  nombre: string,
  apellidoPaterno: string,
  apellidoMaterno?: string,
): string {
  return [nombre, apellidoPaterno, apellidoMaterno].filter(Boolean).join(' ');
}

export function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
