import { pool } from "./connect.ts";
import { QueryObjectResult, Transaction } from "@db/postgres";
import { conReintento } from "./reintento.ts";

export async function sTransaction<T>(
  callback: (tx: Transaction) => Promise<T>,
): Promise<T> {
  const connection = await pool.connect();
  const transaction = connection.createTransaction(`tx_${crypto.randomUUID()}`);

  let started = false;
  try {
    // tx -> reintento socket caido
    return await conReintento(async () => {
      await transaction.begin();
      started = true;
      const result = await callback(transaction);
      await transaction.commit();
      return result;
    }, "sTransaction");
  } catch (err) {
    if (started) {
      try {
        await transaction.rollback();
      } catch (_rollbackErr) {
        console.error("[transaction] rollback fallido:", _rollbackErr);
      }
    }
    throw err;
  } finally {
    connection.release();
  }
}

export async function query<T>(
  sql: string,
  params: unknown[] = [],
): Promise<QueryObjectResult<T>> {
  // query -> reintento conexion caida
  return conReintento(async () => {
    const connection = await pool.connect();
    try {
      return await connection.queryObject<T>(sql, params);
    } finally {
      connection.release();
    }
  }, "query");
}
