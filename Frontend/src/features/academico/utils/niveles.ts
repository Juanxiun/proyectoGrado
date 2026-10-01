/**
 * Orden y etiquetas de los niveles educativos.
 *
 * El backend genera los grados como `1°` … `6°` (ver DEFAULT_GRADES en
 * ServiceAcademic/services/gestion.service.ts), pero un curso creado a mano
 * puede traer "1ro", "1°", "1" o "primero". Todo se normaliza a un número
 * para poder ordenar y agrupar sin depender del texto guardado.
 */

export type Nivel = 'inicial' | 'primaria' | 'secundaria' | 'bachillerato';

export const NIVELES: Nivel[] = ['inicial', 'primaria', 'secundaria', 'bachillerato'];

export const NIVEL_LABEL: Record<Nivel, string> = {
  inicial: 'Inicial',
  primaria: 'Primaria',
  secundaria: 'Secundaria',
  bachillerato: 'Bachillerato',
};

const ORDINALES: Record<number, string> = {
  1: 'primero',
  2: 'segundo',
  3: 'tercero',
  4: 'cuarto',
  5: 'quinto',
  6: 'sexto',
  7: 'séptimo',
  8: 'octavo',
  9: 'noveno',
  10: 'décimo',
  11: 'undécimo',
};

const PALABRAS: Record<string, number> = {
  inicial: 0,
  primero: 1,
  primer: 1,
  segundo: 2,
  tercero: 3,
  cuarto: 4,
  quinto: 5,
  sexto: 6,
  septimo: 7,
  octavo: 8,
  noveno: 9,
  decimo: 10,
};

/** Extrae el número de grado sea cual sea su notación. `null` si no se entiende. */
export function numeroGrado(grado: string | null | undefined): number | null {
  const texto = String(grado ?? '').trim().toLowerCase();
  if (!texto) return null;

  const palabra = PALABRAS[texto];
  if (palabra !== undefined) return palabra;

  const numeros = texto.match(/\d+/);
  return numeros ? Number(numeros[0]) : null;
}

export function nivelDe(valor: string | null | undefined): Nivel | null {
  const texto = String(valor ?? '').trim().toLowerCase();
  return (NIVELES.find((n) => n === texto) as Nivel) ?? null;
}

/** "1°" + primaria => "1° de Primaria". */
export function etiquetaCurso(grado: string, nivel: string): string {
  const n = nivelDe(nivel);
  const base = `${String(grado ?? '').trim()} de ${n ? NIVEL_LABEL[n] : capitalize(nivel)}`;
  return base.trim();
}

function capitalize(texto: string): string {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : '';
}

export interface GrupoNivel {
  nivel: Nivel;
  etiqueta: string;
  grados: Array<{ grado: string; numero: number; etiqueta: string }>;
}

export interface CursoAgrupable {
  id: string;
  grado: string;
  paralelo: string;
  nivel: string;
  [clave: string]: unknown;
}

/**
 * Agrupa cursos por nivel y grado, ordenado de inicial a bachillerato y de
 * primero a sexto. Los grados que no se pueden interpretar se van al final de
 * su nivel en orden alfabético, para que nunca desaparezcan de la lista.
 */
export function agruparPorNivel<T extends CursoAgrupable>(cursos: T[]): GrupoNivel[] {
  const porNivel = new Map<Nivel, Map<string, { numero: number | null; cursos: T[] }>>();

  for (const curso of cursos) {
    const nivel = nivelDe(curso.nivel);
    if (!nivel) continue;

    if (!porNivel.has(nivel)) porNivel.set(nivel, new Map());
    const grados = porNivel.get(nivel)!;

    const grado = String(curso.grado ?? '').trim();
    if (!grados.has(grado)) {
      grados.set(grado, { numero: numeroGrado(curso.grado), cursos: [] });
    }
    grados.get(grado)!.cursos.push(curso);
  }

  return NIVELES.filter((nivel) => porNivel.has(nivel)).map((nivel) => {
    const grados = porNivel.get(nivel)!;
    const entradas = [...grados.entries()].map(([grado, valor]) => ({ grado, ...valor }));
    entradas.sort((a, b) => {
      if (a.numero === null && b.numero === null) return a.grado.localeCompare(b.grado);
      if (a.numero === null) return 1;
      if (b.numero === null) return -1;
      return a.numero - b.numero;
    });

    return {
      nivel,
      etiqueta: NIVEL_LABEL[nivel],
      grados: entradas.map((entrada) => ({
        grado: entrada.grado,
        numero: entrada.numero ?? Number.MAX_SAFE_INTEGER,
        etiqueta: `${entrada.grado} de ${NIVEL_LABEL[nivel]}`,
      })),
    };
  });
}

export { ORDINALES };
