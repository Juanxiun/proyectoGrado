import { query } from "../../connects/Database/transaction.ts";
import type { AlertaRiesgo } from "../../models/academic.ts";
import { obtenerLibro } from "./libro.ts";
import { obtenerPanelCurso } from "./paneles.ts";

// funcion -> estudiantes en riesgo
export async function listarRiesgo(filtro: {
  periodoId: string;
  trimestre: number;
  limite?: number;
}): Promise<AlertaRiesgo[]> {
  const { periodoId, trimestre } = filtro;
  const limite = Math.min(filtro.limite ?? 100, 300);

  const cursosRes = await query<{ id: bigint }>(
    `SELECT id FROM cursos_periodo WHERE periodo_id = $1`,
    [periodoId],
  );

  const alertas: AlertaRiesgo[] = [];

  for (const curso of cursosRes.rows) {
    const panel = await obtenerPanelCurso({
      cursoPeriodoId: String(curso.id),
      trimestre,
    });

    for (const materia of panel.materias) {
      const libro = await obtenerLibro({
        cursoPeriodoId: String(curso.id),
        materiaId: materia.materiaId,
        trimestre,
      });

      for (const linea of libro.lineas) {
        if (linea.nivelRiesgo !== "riesgo" && linea.nivelRiesgo !== "riesgo_alto") continue;

        alertas.push({
          estudianteId: linea.estudianteId,
          nombre: linea.nombre,
          apellidoPaterno: linea.apellidoPaterno,
          cursoParalelo: `${libro.curso.grado} "${libro.curso.paralelo}" ${libro.curso.nivel.toUpperCase()}`,
          materia: libro.materia.nombre,
          promedio: linea.promedio,
          asistencia: linea.asistencia.tasa,
          nivelRiesgo: linea.nivelRiesgo,
          motivos: linea.observaciones,
        });
      }
    }
  }

  const prioridad = { riesgo_alto: 0, riesgo: 1, observacion: 2, sin_riesgo: 3 } as const;
  alertas.sort((a, b) => prioridad[a.nivelRiesgo] - prioridad[b.nivelRiesgo]);
  return alertas.slice(0, limite);
}
