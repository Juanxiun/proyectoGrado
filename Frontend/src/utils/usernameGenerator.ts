/**
 * Genera un nombre de usuario autogenerado siguiendo la fórmula institucional:
 *   - Primeras 2 letras del Apellido Paterno
 *   - Primeras 2 letras del Apellido Materno
 *   - Primeras 2 letras del Nombre
 *   - Día y mes de nacimiento
 *   - Suma del (Día de Nacimiento + Mes de Nacimiento)
 *   - Fecha completa de inscripción
 *   - Número aleatorio de 3 dígitos (para unicidad)
 */
export function generateUsername(
  nombre: string,
  apellidoPaterno: string,
  apellidoMaterno: string,
  fechaNacimiento: string, // YYYY-MM-DD
): string {
  const clean = (str: string) =>
    (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z]/g, '')
      .toLowerCase();

  const p1 = clean(apellidoPaterno).slice(0, 2).padEnd(2, 'x');
  const p2 = clean(apellidoMaterno).slice(0, 2).padEnd(2, 'x');
  const p3 = clean(nombre).slice(0, 2).padEnd(2, 'x');
  const [year, monthText, dayText] = fechaNacimiento.split('-');
  const day = Number(dayText);
  const month = Number(monthText);
  if (!year || !Number.isInteger(day) || !Number.isInteger(month) ||
      day < 1 || day > 31 || month < 1 || month > 12) {
    return '';
  }
  const registered = new Date();
  const registrationDate = [
    registered.getFullYear(),
    String(registered.getMonth() + 1).padStart(2, '0'),
    String(registered.getDate()).padStart(2, '0'),
  ].join('');

  const randNum = Math.floor(100 + Math.random() * 900); // 3 dígitos (100 - 999)

  return `${p1}${p2}${p3}${String(day).padStart(2, '0')}${String(month).padStart(2, '0')}${day + month}${registrationDate}${randNum}`;
}

/**
 * Genera el correo electrónico institucional del estudiante.
 */
export function generateStudentEmail(username: string): string {
  if (!username) return 'estudiante@shalom.edu.bo';
  const cleanUsername = username.toLowerCase().trim().replace(/[^a-z0-9_.-]/g, '');
  return `${cleanUsername}@shalom.edu.bo`;
}
