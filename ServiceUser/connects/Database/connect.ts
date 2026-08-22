import { Pool } from "@db/postgres";
import { pg } from "../../config/pg.config.ts";

console.log(pg);

const pool = new Pool(
  {
    hostname: pg.DB_HOST,
    port: pg.DB_PORT,
    database: pg.DB_NAME,
    user: pg.DB_USER,
    password: pg.DB_PASS,
    tls: {
      enabled: pg.DB_SSL,
      enforce: pg.DB_SSL,
    },
  },
  pg.DB_SIZE,
  true,
);

async function ClosedPool(): Promise<void> {
  await pool.end();
  console.log("Cierre de la conexion xd")
}

export {pool, ClosedPool}