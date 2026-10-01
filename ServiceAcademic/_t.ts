import "./config/env.config.ts";
import { ClosedPool } from "./connects/Database/connect.ts";
import { query } from "./connects/Database/transaction.ts";
const v = await query("SHOW server_version");
console.log(Deno.inspect(v.rows));
for (const t of [
  `SELECT LEAST(100, (CASE 'a' WHEN 'a' THEN 1 ELSE 2 END))`,
  `SELECT LEAST(100, CASE 'a' WHEN 'a' THEN 1 ELSE 2 END)`,
  `SELECT GREATEST(0, LEAST(100, CASE 'a' WHEN 'a' THEN 1 ELSE 2 END))`,
]) {
  try { const r = await query(t); console.log("OK  ", t.slice(10, 60), "=>", Deno.inspect(r.rows)); }
  catch (e) { console.log("FAIL", t.slice(10, 60), "=>", e instanceof Error ? e.message : e); }
}
await ClosedPool(); Deno.exit(0);
