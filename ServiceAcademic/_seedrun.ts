import "./config/env.config.ts";
import { pool, ClosedPool } from "./connects/Database/connect.ts";
const conn = await pool.connect();
try {
  for (const ruta of Deno.args) {
    const sql = await Deno.readTextFile(ruta);
    await conn.queryObject("BEGIN");
    const sts = sql.replace(/^\s*BEGIN\s*;?/im, "").replace(/COMMIT\s*;?\s*$/im, "")
      .split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n")
      .split(";").map((s) => s.trim()).filter(Boolean);
    let ok = 0, fallo = "";
    for (let i = 0; i < sts.length; i++) {
      try { await conn.queryObject(sts[i]); ok++; }
      catch (e) { fallo = "#" + i + " " + (e instanceof Error ? e.message : e); break; }
    }
    if (fallo) { await conn.queryObject("ROLLBACK"); console.log(ruta.split("\\").pop(), "FALLA", fallo); }
    else { await conn.queryObject("COMMIT"); console.log(ruta.split("\\").pop(), "APLICADO", ok + "/" + sts.length); }
  }
} finally { conn.release(); await ClosedPool(); }
Deno.exit(0);
