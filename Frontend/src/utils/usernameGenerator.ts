function cleanText(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase();
}

function getTwoOrFallback(value: string, fallback: string = ''): string {
  const clean = cleanText(value);
  if (clean.length >= 2) return clean.slice(0, 2);
  if (clean.length === 1) return clean + (cleanText(fallback).slice(0, 1) || 'a');
  const fb = cleanText(fallback);
  if (fb.length >= 2) return fb.slice(0, 2);
  return 'sh';
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
 * Genera un nombre de usuario autogenerado siguiendo la fórmula institucional limpia:
 *   - 2 letras de Apellido Paterno
 *   - 2 letras de Apellido Materno (o fallback elegante)
 *   - 2 letras de Nombre
 *   - 2 primeros y 2 últimos dígitos de CI con suma de verificación
 */
export function generateUsername(
  nombre: string,
  apellidoPaterno: string,
  apellidoMaterno?: string | null,
  ci?: string | null,
): string {
  if (!nombre && !apellidoPaterno) return '';

  const cleanNom = cleanText(nombre);
  const cleanPat = cleanText(apellidoPaterno);
  const cleanMat = cleanText(apellidoMaterno ?? '');

  const apPat = getTwoOrFallback(cleanPat, cleanNom);
  const apMat = cleanMat.length >= 2 ? cleanMat.slice(0, 2) : (cleanPat.length > 2 ? cleanPat.slice(2, 4) : 'sh');
  const nom = getTwoOrFallback(cleanNom, cleanPat);

  const ciDigits = (ci || '').replace(/\D/g, '');
  let ciFirstTwo = '10';
  let ciLastTwo = '25';
  let checksum = 7;

  if (ciDigits.length >= 4) {
    ciFirstTwo = ciDigits.slice(0, 2);
    ciLastTwo = ciDigits.slice(-2);
    const d1 = Number(ciFirstTwo[0]) || 0;
    const d2 = Number(ciFirstTwo[1]) || 0;
    const d3 = Number(ciLastTwo[0]) || 0;
    const d4 = Number(ciLastTwo[1]) || 0;
    checksum = reduceToSingleDigit(d1 + d2 + d3 + d4);
  } else if (ciDigits.length > 0) {
    ciFirstTwo = ciDigits.padEnd(2, '1');
    ciLastTwo = ciDigits.padStart(2, '2');
    checksum = reduceToSingleDigit(Number(ciFirstTwo[0]) + Number(ciLastTwo[0]));
  } else {
    const hashNum = (cleanNom.length * 13 + cleanPat.length * 7 + (cleanMat.length || 3)) % 90 + 10;
    ciFirstTwo = String(hashNum);
    ciLastTwo = String(99 - hashNum);
    checksum = reduceToSingleDigit(hashNum);
  }

  return `${apPat}${apMat}${nom}${ciFirstTwo}${ciLastTwo}${checksum}`;
}

/**
 * Genera el correo electrónico institucional.
 */
export function generateStudentEmail(username: string): string {
  if (!username) return 'usuario@shalom.edu.bo';
  const cleanUsername = username.toLowerCase().trim().replace(/[^a-z0-9_.-]/g, '');
  return `${cleanUsername}@shalom.edu.bo`;
}
