import { Pool } from "@db/postgres";
import { pgConfig } from "../../config/pg.config.ts";

/**
 * Pool de SOLO LECTURA. Este servicio nunca escribe, así que se bloquea el
 * acceso a las sentencias de escritura: un `INSERT` accidental acá es un bug
 * de arquitectura, no algo que queremos permitir por descuido.
 */
export const pool = new Pool(
  {
    hostname: pgConfig.host,
    port: pgConfig.port,
    user: pgConfig.user,
    database: pgConfig.database,
    password: pgConfig.password,
    tls: pgConfig.tls,
  },
  pgConfig.poolSize,
  true,
);
