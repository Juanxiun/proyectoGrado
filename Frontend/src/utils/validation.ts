const USERNAME_REGEX = /^[a-zA-Z0-9]+$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 50;

export interface LoginValidation {
  isValid: boolean;
  usernameError: string | null;
  passwordError: string | null;
}

export function validateUsername(value: string): string | null {
  if (!value.trim()) return 'El usuario es obligatorio';
  if (!USERNAME_REGEX.test(value)) {
    return 'Solo letras (a-z, A-Z) y números (0-9)';
  }
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return 'La contraseña es obligatoria';
  if (value.length < PASSWORD_MIN) {
    return `Mínimo ${PASSWORD_MIN} caracteres`;
  }
  if (value.length > PASSWORD_MAX) {
    return `Máximo ${PASSWORD_MAX} caracteres`;
  }
  return null;
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
