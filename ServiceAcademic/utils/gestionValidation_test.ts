import { assert, assertEquals, assertThrows } from "@std/assert";
import { buildInstallments, countManagementMonths, distributeInstallmentAmounts, validateGestionRange, validateTrimestres } from "./gestionValidation.ts";

Deno.test("acepta tres trimestres consecutivos sin días lectivos faltantes", () => {
  validateTrimestres("2026-02-02", "2026-05-29", [
    { numero: 1, inicio: "2026-02-02", fin: "2026-04-10" },
    { numero: 2, inicio: "2026-04-11", fin: "2026-05-15" },
    { numero: 3, inicio: "2026-05-16", fin: "2026-05-29" },
  ]);
});

Deno.test("rechaza solapamiento y brechas entre trimestres", () => {
  assertThrows(() => validateTrimestres("2026-01-01", "2026-12-31", [
    { numero: 1, inicio: "2026-01-01", fin: "2026-04-10" },
    { numero: 2, inicio: "2026-04-10", fin: "2026-08-10" },
    { numero: 3, inicio: "2026-08-11", fin: "2026-12-31" },
  ]));
  assertThrows(() => validateTrimestres("2026-01-01", "2026-12-31", [
    { numero: 1, inicio: "2026-01-01", fin: "2026-04-10" },
    { numero: 2, inicio: "2026-04-14", fin: "2026-08-10" },
    { numero: 3, inicio: "2026-08-11", fin: "2026-12-31" },
  ]));
});

Deno.test("exige fin de gestión posterior y calcula cuotas mensuales", () => {
  assertThrows(() => validateGestionRange("2026-02-02", "2026-02-02"));
  assertEquals(countManagementMonths("2026-02-02", "2026-12-18"), 11);
  const installments = buildInstallments("2026-02-02", "2026-04-18", 100, 10);
  assertEquals(installments.length, 3);
  assertEquals(installments.map((item) => item.mes), [2, 3, 4]);
  assert(installments.every((item) => item.fechaVencimiento.endsWith("-10") || item.numero === 1));
  distributeInstallmentAmounts(installments, 100.01);
  assertEquals(installments.reduce((sum, item) => sum + item.monto, 0), 100.01);
});
