function cleanText(value: string): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toLowerCase();
}

function getTwoOrFallback(value: string, fallback: string = ""): string {
  const clean = cleanText(value);
  if (clean.length >= 2) return clean.slice(0, 2);
  if (clean.length === 1) return clean + (cleanText(fallback).slice(0, 1) || "a");
  const fb = cleanText(fallback);
  if (fb.length >= 2) return fb.slice(0, 2);
  return "sh";
}

function reduceToSingleDigit(sum: number): number {
  let s = Math.abs(sum);
  while (s >= 10) {
    s = s.toString().split("").map(Number).reduce((a, b) => a + b, 0);
  }
  return s;
}

export function generateUsername(
  nombre: string,
  apellidoPaterno: string,
  apellidoMaterno?: string | null,
  ci?: string | null,
): string {
  if (!nombre && !apellidoPaterno) return "";

  const cleanNom = cleanText(nombre);
  const cleanPat = cleanText(apellidoPaterno);
  const cleanMat = cleanText(apellidoMaterno ?? "");

  const apPat = getTwoOrFallback(cleanPat, cleanNom);
  const apMat = cleanMat.length >= 2 ? cleanMat.slice(0, 2) : (cleanPat.length > 2 ? cleanPat.slice(2, 4) : "sh");
  const nom = getTwoOrFallback(cleanNom, cleanPat);

  const ciDigits = (ci || "").replace(/\D/g, "");
  let ciFirstTwo = "10";
  let ciLastTwo = "25";
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
    ciFirstTwo = ciDigits.padEnd(2, "1");
    ciLastTwo = ciDigits.padStart(2, "2");
    checksum = reduceToSingleDigit(Number(ciFirstTwo[0]) + Number(ciLastTwo[0]));
  } else {
    const hashNum = (cleanNom.length * 13 + cleanPat.length * 7 + (cleanMat.length || 3)) % 90 + 10;
    ciFirstTwo = String(hashNum);
    ciLastTwo = String(99 - hashNum);
    checksum = reduceToSingleDigit(hashNum);
  }

  return `${apPat}${apMat}${nom}${ciFirstTwo}${ciLastTwo}${checksum}`;
}

export function generateEmail(username: string): string {
  return `${username}@shalom.edu.bo`;
}

/**
 * Genera una contraseña aleatoria y segura para el primer acceso.
 * Cumple con: Mínimo 8 caracteres, al menos una mayúscula, un número y un carácter especial (@, #, $, &).
 */
export function generateSecureRandomPassword(): string {
  const specials = ["@", "#", "$", "&"];
  const s1 = specials[Math.floor(Math.random() * specials.length)];
  const s2 = specials[Math.floor(Math.random() * specials.length)];
  const randomUpper = String.fromCharCode(65 + Math.floor(Math.random() * 26)); // A-Z
  const randomLower = String.fromCharCode(97 + Math.floor(Math.random() * 26)); // a-z
  const randomDigits = Math.floor(1000 + Math.random() * 9000).toString(); // 4 dígitos
  
  return `Sh${s1}${randomDigits}${randomUpper}${randomLower}${s2}`;
}

export function generatePassword(_username?: string): string {
  return generateSecureRandomPassword();
}