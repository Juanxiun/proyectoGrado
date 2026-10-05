import { pool } from "./connect.ts";
import { QueryObjectResult } from "@db/postgres";
import { conReintento } from "./reintento.ts";

/**
 * Única forma admitida de leer datos en este servicio. Deliberadamente no se
 * exporta nada que permita escribir.
 */
export async function query<T>(
  sql: string,
  params: unknown[] = [],
): Promise<QueryObjectResult<T>> {
  return conReintento(async () => {
    const connection = await pool.connect();
    try {
      return await connection.queryObject<T>(sql, params);
    } finally {
      connection.release();
    }
  }, "query");
}

/**
 * Ejecuta un grupo de lecturas con una sola conexión del pool, en vez de
 * tomar y devolver una conexión por consulta. El driver las encola de a una,
 * así que NO es paralelismo: el ahorro es el viaje al pool, no el tiempo de
 * red. El dashboard siempre agrupa consultas del mismo tipo, que es justo
 * donde esto rinde.
 */
export async function queryBatch<T extends Record<string, unknown>>(
  consultas: Array<[string, unknown[]]>,
): Promise<Array<QueryObjectResult<T>>> {
  return conReintento(async () => {
    const connection = await pool.connect();
    try {
      return await Promise.all(
        consultas.map(([sql, params]) => connection.queryObject<T>(sql, params)),
      );
    } finally {
      connection.release();
    }
  }, "queryBatch");
}