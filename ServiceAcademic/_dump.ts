const sql = await Deno.readTextFile(Deno.args[0]);
// identificadores mal citados: "algo  (sin comilla de cierre antes de espacio)
const mala = /"[\w\.]+ [\w\.]+"/g;
let m;
const limpio = sql.replace(/--.*$/gm, "");
while ((m = mala.exec(limpio))) console.log("SOSPECHOSO:", JSON.stringify(m[0]));
console.log("revision de identificadores terminada");
