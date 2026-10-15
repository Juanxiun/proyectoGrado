// db -> conexion postgresql
import { Pool } from "@db/postgres";
import { pgConfig } from "../../config/pg.config.ts";

export const pool = new Pool(pgConfig, 10);

export async function closePool(): Promise<void> {
  await pool.end();
}