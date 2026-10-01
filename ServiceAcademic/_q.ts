import "./config/env.config.ts";
import { ClosedPool } from "./connects/Database/connect.ts";
import { query } from "./connects/Database/transaction.ts";
for (const [k, sql] of [
  ["maestro_materias", `SELECT COUNT(*)::int AS n FROM maestro_materias`],
  ["especialidades", `SELECT especialidad, COUNT(*)::int FROM maestros GROUP BY especialidad ORDER BY 1 LIMIT 6`],
  ["pares", `SELECT mm.materia_id, COUNT(*)::int AS maestros FROM maestro_materias mm JOIN maestros ms ON ms.id=mm.maestro_id WHERE ms.estado='activo' GROUP BY 1 ORDER BY 1 LIMIT 6`],
  ["cursos_periodo por grado", `SELECT c.nivel, c.grado, COUNT(*)::int FROM cursos_periodo cp JOIN cursos c ON c.id=cp.curso_id GROUP BY 1,2 ORDER BY 1,2`],
  ["estudiantes extra", `SELECT uc.username FROM estudiantes e JOIN usuario_cuenta uc ON uc.usuario_id=e.usuario_id WHERE uc.username !~ '^est[0-9]{4}$'`],
] as [string, string][]) {
  const r = await query(sql);
  console.log("##", k, Deno.inspect(r.rows).replace(/\s+/g, " "));
}
await ClosedPool(); Deno.exit(0);
