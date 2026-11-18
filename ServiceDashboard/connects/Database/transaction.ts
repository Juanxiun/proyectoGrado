import { pool } from "./connect.ts";
import { QueryObjectResult } from "@db/postgres";
import { conReintento } from "./reintento.ts";

// query -> lectura con reintentos
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

// query -> lote lecturas una conexion
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