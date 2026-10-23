import { query } from "../connects/Database/transaction.ts";
import { filtroCursos, type Contexto } from "./alcance.service.ts";
import type { ResumenAsistenciaDashboard } from "../models/dashboard.ts";

// servicio -> asistencia efectiva agregados
export async function resumenAsistencia(
  contexto: Contexto,
  desde: string,
  hasta: string,
): Promise<ResumenAsistenciaDashboard> {
  const periodoId = contexto.periodo?.id ?? "";
  const filtro = filtroCursos(contexto, []);
  const args = [periodoId, desde, hasta, ...filtro.params];

  // sql -> from y where separados
  const from = `
    FROM asistencia a
    JOIN asignaciones_docentes ad ON ad.id = a.asignacion_id
    JOIN cursos_periodo cp ON cp.id = ad.curso_periodo_id
    JOIN cursos c ON c.id = cp.curso_id
    JOIN materias m ON m.id = ad.materia_id`;

  const where = `
    WHERE cp.periodo_id = $1 AND ad.estado = 'activo'
      AND a.fecha BETWEEN $2 AND $3 ${filtro.where}`;

  const [global, porDia, porMateria, topFaltas] = await Promise.all([
    query<{
      registros: string;
      presentes: string;
      ausentes: string;
      atrasos: string;
      justificadas: string;
      dias: string;
    }>(
      `SELECT
         COUNT(*) AS registros,
         COUNT(*) FILTER (WHERE a.estado = 'presente') AS presentes,
         COUNT(*) FILTER (WHERE a.estado = 'ausente') AS ausentes,
         COUNT(*) FILTER (WHERE a.estado = 'atraso') AS atrasos,
         COUNT(*) FILTER (WHERE a.estado = 'justificado') AS justificadas,
         COUNT(DISTINCT a.fecha) AS dias
       ${from} ${where}`,
      args,
    ),
    query<{ fecha: Date; presentes: string; ausentes: string; total: string }>(
      `SELECT a.fecha,
              COUNT(*) FILTER (WHERE a.estado <> 'ausente') AS presentes,
              COUNT(*) FILTER (WHERE a.estado = 'ausente') AS ausentes,
              COUNT(*) AS total
       ${from} ${where}
       GROUP BY a.fecha
       ORDER BY a.fecha DESC
       LIMIT 14`,
      args,
    ),
    // campo -> maximo faltas materia
    query<{
      materia_id: bigint;
      materia: string;
      grado: string;
      paralelo: string;
      nivel: string;
      total: string;
      ausentes: string;
      max_ausencias: string | null;
    }>(
      `SELECT
         ad.materia_id,
         m.nombre AS materia,
         c.grado, c.paralelo, c.nivel,
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE a.estado = 'ausente') AS ausentes,
         MAX(faltas.ausencias) AS max_ausencias
       ${from}
       LEFT JOIN LATERAL (
         SELECT MAX(n) AS ausencias FROM (
           SELECT COUNT(*) AS n
           FROM asistencia a2
           WHERE a2.asignacion_id = ad.id
             AND a2.estado = 'ausente'
             AND a2.fecha BETWEEN $2 AND $3
           GROUP BY a2.estudiante_id
         ) sub
       ) faltas ON true
       ${where}
       GROUP BY ad.materia_id, m.nombre, c.grado, c.paralelo, c.nivel
       ORDER BY COUNT(*) FILTER (WHERE a.estado = 'ausente') DESC
       LIMIT 12`,
      args,
    ),
    query<{
      estudiante_id: bigint;
      nombre: string;
      apellido_paterno: string;
      grado: string;
      paralelo: string;
      nivel: string;
      ausentes: string;
      justificadas: string;
      total: string;
    }>(
      `SELECT
         a.estudiante_id,
         u.nombre, u.apellido_paterno,
         c.grado, c.paralelo, c.nivel,
         COUNT(*) FILTER (WHERE a.estado = 'ausente') AS ausentes,
         COUNT(*) FILTER (WHERE a.estado = 'justificado') AS justificadas,
         COUNT(*) AS total
       ${from}
       JOIN estudiantes e ON e.id = a.estudiante_id
       JOIN usuarios u ON u.id = e.usuario_id
       ${where}
       GROUP BY a.estudiante_id, u.nombre, u.apellido_paterno, c.grado, c.paralelo, c.nivel
       HAVING COUNT(*) FILTER (WHERE a.estado = 'ausente') > 0
       ORDER BY COUNT(*) FILTER (WHERE a.estado = 'ausente') DESC
       LIMIT 12`,
      args,
    ),
  ]);

  const g = global.rows[0];
  const registros = Number(g?.registros ?? 0);
  const presentes = Number(g?.presentes ?? 0);
  const ausentes = Number(g?.ausentes ?? 0);
  const atrasos = Number(g?.atrasos ?? 0);
  const justificadas = Number(g?.justificadas ?? 0);
  const efectivas = presentes + atrasos + justificadas;

  return {
    global: {
      registros,
      presentes,
      ausentes,
      atrasos,
      justificadas,
      diasRegistrados: Number(g?.dias ?? 0),
      tasa: registros > 0 ? Math.round((efectivas / registros) * 1000) / 10 : null,
    },
    ultimosDias: porDia.rows.map((fila) => {
      const total = Number(fila.total);
      return {
        fecha: formatearFecha(fila.fecha),
        presentes: Number(fila.presentes),
        ausentes: Number(fila.ausentes),
        tasa: total > 0
          ? Math.round((Number(fila.presentes) / total) * 1000) / 10
          : null,
      };
    }),
    porMateria: porMateria.rows.map((fila) => {
      const total = Number(fila.total);
      const faltas = Number(fila.ausentes);
      return {
        materiaId: String(fila.materia_id),
        materia: fila.materia,
        cursoParalelo: `${fila.grado} "${fila.paralelo}" ${fila.nivel.toUpperCase()}`,
        total,
        ausentes: faltas,
        tasa: total > 0 ? Math.round(((total - faltas) / total) * 1000) / 10 : null,
        mayorFaltas: Number(fila.max_ausencias ?? 0),
      };
    }),
    estudiantesConMasFaltas: topFaltas.rows.map((fila) => ({
      estudianteId: String(fila.estudiante_id),
      nombre: fila.nombre,
      apellidoPaterno: fila.apellido_paterno,
      cursoParalelo: `${fila.grado} "${fila.paralelo}" ${fila.nivel.toUpperCase()}`,
      ausentes: Number(fila.ausentes),
      justificadas: Number(fila.justificadas),
      total: Number(fila.total),
    })),
  };
}

function formatearFecha(valor: Date): string {
  return valor instanceof Date ? valor.toISOString().slice(0, 10) : String(valor);
}
