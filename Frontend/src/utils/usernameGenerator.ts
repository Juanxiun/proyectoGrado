function cleanText(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase();
}

function getFirstTwo(value: string): string {
  return cleanText(value).slice(0, 2).padEnd(2, 'x');
}

function reduceToSingleDigit(sum: number): number {
  let s = Math.abs(sum);
  while (s >= 10) {
    s = s
      .toString()
      .split('')
      .reduce((acc, d) => acc + Number(d), 0);
  }
  return s;
}

/**
 * Genera un nombre de usuario autogenerado siguiendo la fórmula institucional:
 *   - Primeras 2 letras del Apellido Paterno
 *   - Primeras 2 letras del Apellido Materno
 *   - Primeras 2 letras del Nombre
 *   - Primeros 2 dígitos del CI
 *   - Últimos 2 dígitos del CI
 *   - Suma de estos dígitos reducida a 1 único dígito (ej. 12 -> 1 + 2 = 3)
 */
export function generateUsername(
  nombre: string,
  apellidoPaterno: string,
  apellidoMaterno: string,
  ci: string,
): string {
  if (!nombre && !apellidoPaterno) return '';
  const apPat = getFirstTwo(apellidoPaterno);
  const apMat = getFirstTwo(apellidoMaterno);
  const nom = getFirstTwo(nombre);

  const ciDigits = (ci || '').replace(/\D/g, '');
  const ciFirstTwo = ciDigits.slice(0, 2).padEnd(2, '0');
  const ciLastTwo = (ciDigits.length >= 2 ? ciDigits.slice(-2) : ciDigits).padStart(2, '0');

  const d1 = Number(ciFirstTwo[0]) || 0;
  const d2 = Number(ciFirstTwo[1]) || 0;
  const d3 = Number(ciLastTwo[0]) || 0;
  const d4 = Number(ciLastTwo[1]) || 0;
  const checksum = reduceToSingleDigit(d1 + d2 + d3 + d4);

  return `${apPat}${apMat}${nom}${ciFirstTwo}${ciLastTwo}${checksum}`;
}

/**
 * Genera el correo electrónico institucional del estudiante.
 */
export function generateStudentEmail(username: string): string {
  if (!username) return 'estudiante@shalom.edu.bo';
  const cleanUsername = username.toLowerCase().trim().replace(/[^a-z0-9_.-]/g, '');
  return `${cleanUsername}@shalom.edu.bo`;
}
