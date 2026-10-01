import { Pool } from "@db/postgres";
import { pgConfig } from "../../config/pg.config.ts";

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
