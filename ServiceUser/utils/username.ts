function cleanText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z]/g, "").toLowerCase();
}

function getFirstTwo(value: string): string {
  return cleanText(value).slice(0, 2).padEnd(2, "x");
}

function getRolAbreviation(rol: string): string {
  const r = rol.toLowerCase().trim();
  if (r === "estudiante") return "est";
  if (r === "profesor" || r === "maestro" || r === "docente") return "doc";
  if (r === "director" || r === "control" || r === "gerencia") return "adm";
  if (r === "tutor" || r === "apoderado" || r === "padre") return "tut";
  return r.slice(0, 3);
}

function calculateCIChecksum(ci: string): number {
  const digits = ci.replace(/\D/g, "").split("").map(Number);
  if (digits.length === 0) return 0;
  let sum = digits.reduce((a, b) => a + b, 0);
  while (sum >= 10) {
    sum = sum.toString().split("").map(Number).reduce((a, b) => a + b, 0);
  }
  return sum;
}

export function generateUsername(
  nombre: string,
  apellidoPaterno: string,
  apellidoMaterno: string,
  nacimiento: string,
  ci: string,
  rol: string,
): string {
  const rolAbr = getRolAbreviation(rol);
  const apMat = getFirstTwo(apellidoMaterno);
  const apPat = getFirstTwo(apellidoPaterno);
  const nom = getFirstTwo(nombre);

  const ciClean = ci.replace(/\D/g, "");
  const ciFirstTwo = ciClean.slice(0, 2).padEnd(2, "0");
  const ciLastThree = ciClean.slice(-3).padStart(3, "0");
  const ciChecksum = calculateCIChecksum(ciClean);

  return `${rolAbr}${apMat}${apPat}${nom}${ciFirstTwo}${ciLastThree}${ciChecksum}`;
}

export function generateEmail(username: string): string {
  return `${username}@shalom.edu.bo`;
}

export function generatePassword(username: string): string {
  return `Sh@lom_${username}`;
}