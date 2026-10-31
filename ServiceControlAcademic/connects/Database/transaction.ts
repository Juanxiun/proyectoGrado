// db -> transacciones y queries
import { pool } from "./connect.ts";

export interface QueryResult<R = Record<string, unknown>> {
  rows: R[];
  rowCount: number;
}

export async function query<R = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<R>> {
  const client = await pool.connect();
  try {
    const result = await client.queryObject<R>(text, params);
    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
  } finally {
    client.release();
  }
}

export async function sTransaction<T>(
  fn: (client: { queryObject<R>(text: string, params: unknown[]): Promise<QueryResult<R>> }) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.queryObject("BEGIN");
    const result = await fn({
      queryObject: async <R>(text: string, params: unknown[]) => {
        const res = await client.queryObject<R>(text, params);
        return { rows: res.rows, rowCount: res.rowCount ?? 0 };
      },
    });
    await client.queryObject("COMMIT");
    return result;
  } catch (err) {
    await client.queryObject("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}