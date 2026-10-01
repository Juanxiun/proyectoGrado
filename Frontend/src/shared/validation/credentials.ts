/**
 * Reglas de credenciales. Fuente única para el frontend; el backend replica
 * la política de contraseña en `ServiceUser/Controller/auth/changePassword.ts`
 * y ambos deben cambiar juntos.
 */

export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 100;

/**
 * El usuario sólo admite letras y números. Se conservan mayúsculas y
 * minúsculas: no se fuerza un casing, se filtra lo que no es alfanumérico.
 */
export const USERNAME_REGEX = /^[A-Za-z0-9]+$/;

/**
 * Normaliza lo que el usuario teclea en el campo: descarta todo lo que no sea
 * alfanumérico y recorta al máximo. Evita tener que avisar con un error por
 * cada tecla inválida.
 */
export function sanitizeUsername(value: string): string {
  return String(value ?? '')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, USERNAME_MAX);
}

/** Recorta la contraseña al máximo permitido sin alterar su contenido. */
export function sanitizePassword(value: string): string {
  return String(value ?? '').slice(0, PASSWORD_MAX);
}

export function validateUsername(value: string): string | null {
  const username = String(value ?? '');

  if (!username.trim()) return 'El usuario es obligatorio';
  if (username.length > USERNAME_MAX) return `Máximo ${USERNAME_MAX} caracteres`;
  if (!USERNAME_REGEX.test(username)) {
    return 'Sólo letras (a-z, A-Z) y números (0-9)';
  }
  return null;
}

export function validatePassword(value: string): string | null {
  const password = String(value ?? '');

  if (!password) return 'La contraseña es obligatoria';
  if (password.length < PASSWORD_MIN) return `Mínimo ${PASSWORD_MIN} caracteres`;
  if (password.length > PASSWORD_MAX) return `Máximo ${PASSWORD_MAX} caracteres`;
  return null;
}

export interface LoginValidation {
  isValid: boolean;
  usernameError: string | null;
  passwordError: string | null;
}

export function validateLogin(username: string, password: string): LoginValidation {
  const usernameError = validateUsername(username);
  const passwordError = validatePassword(password);
  return {
    isValid: !usernameError && !passwordError,
    usernameError,
    passwordError,
  };
}
