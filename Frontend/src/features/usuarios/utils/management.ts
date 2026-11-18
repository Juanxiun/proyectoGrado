import { generateStudentEmail, generateUsername } from '../../../utils/usernameGenerator';
import type { UsuarioDoc } from '../../../types';

// ROLES_EDITOR -> roles con permiso de edición
export const ROLES_EDITOR: string[] = [
  'director',
  'control',
  'gerencia',
  'admin',
  'administrador',
  'administrativo',
  'editor',
  'secretaria',
  'secretario',
];

// aplicarErroresServidor -> mapear error del backend a campos del formulario
export function aplicarErroresServidor(err: unknown, msg: string): Record<string, string> {
  const errors: Record<string, string> = {};
  const field = (err as { field?: string } | null | undefined)?.field;
  if (field) {
    errors[field] = msg;
  }
  if (/username|usuario/i.test(msg)) errors.username = 'El nombre de usuario ya está en uso.';
  if (/email|correo/i.test(msg)) errors.email = 'El correo institucional ya está en uso.';
  if (/documento|numero_doc|ci/i.test(msg)) errors['documento:CI'] = 'La cédula de identidad ya está registrada.';
  return errors;
}

// extraerCI -> obtener el número de CI de los documentos
export function extraerCI(docs: UsuarioDoc[]): string {
  return docs.find((d) => d.tipoDoc === 'CI' || (d as any).tipo_doc === 'CI')?.numeroDoc ??
    (docs.find((d) => (d as any).tipo_doc === 'CI') as any)?.numero_doc ?? 'Sin CI';
}

// autocompletarCredenciales -> sugerir username y correo institucional
export function autocompletarCredenciales(
  nombre: string,
  apellidoPaterno: string,
  apellidoMaterno: string,
  ci: string,
  actuales: { username: string; email: string },
): { username: string; email: string } | null {
  const generado = generateUsername(nombre, apellidoPaterno, apellidoMaterno, ci);
  if (!generado) return null;
  return {
    username: actuales.username && actuales.username !== generado ? actuales.username : generado,
    email: actuales.email && !actuales.email.includes('@shalom.edu.bo') ? actuales.email : generateStudentEmail(generado),
  };
}
