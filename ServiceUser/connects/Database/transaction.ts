import { pool } from "./connect.ts";
import { QueryObjectResult, Transaction } from "@db/postgres";

export async function sTransaction<T>(
  callback: (tx: Transaction) => Promise<T>,
): Promise<T> {
  const connection = await pool.connect();
  const transaction = connection.createTransaction(`tx_${crypto.randomUUID()}`);

  let started = false;
  try {
    await transaction.begin();
    started = true;
    const result = await callback(transaction);
    await transaction.commit();
    return result;
  } catch (err) {
    if (started) {
      try {
        await transaction.rollback();
      } catch (_rollbackErr) {
        console.log("Problema al realizar la transaccion:\n" + _rollbackErr);
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
  const connection = await pool.connect();
  try {
    return await connection.queryObject<T>(sql, params);
  } finally {
    connection.release();
  }
}
