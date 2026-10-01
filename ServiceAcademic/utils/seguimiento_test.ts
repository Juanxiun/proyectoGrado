import { assert, assertEquals } from "@std/assert";
import {
  calcularIndice,
  clasificarRiesgo,
} from "../services/seguimiento.service.ts";
import { seguimientoConfig } from "../config/seguimiento.config.ts";

/**
 * ElPromedio ponderado y la detección de riesgo se calculan sobre datos reales
 * de calificaciones y asistencia. Estas pruebas cubren la clasificación, que
 * es donde un errorolvidaría al personal administrativo.
 */

Deno.test("sin datos no hay riesgo ni índice", () => {
  const { nivel } = clasificarRiesgo(null, null);
  assertEquals(nivel, "sin_riesgo");
  assertEquals(calcularIndice(null, null), null);
});

Deno.test("promedio alto con buena asistencia queda en regla", () => {
  const { nivel, observaciones } = clasificarRiesgo(85, 95);
  assertEquals(nivel, "sin_riesgo");
  assertEquals(observaciones.length, 0);
});

Deno.test("promedio bajo marca riesgo y explica el motivo", () => {
  const { nivel, observaciones } = clasificarRiesgo(55, 95);
  assertEquals(nivel, "riesgo");
  assert(observaciones.some((o) => o.includes(String(seguimientoConfig.umbralNotaRiesgo))));
});

Deno.test("asistencia baja marca riesgo aunque el promedio sea bueno", () => {
  const { nivel, observaciones } = clasificarRiesgo(90, 60);
  assertEquals(nivel, "riesgo");
  assert(observaciones.some((o) => o.includes("Asistencia")));
});

Deno.test("nota y asistencia bajas a la vez escalan a riesgo alto", () => {
  const { nivel } = clasificarRiesgo(45, 55);
  assertEquals(nivel, "riesgo_alto");
});

Deno.test("asistencia por encima del riesgo pero baja queda en observación", () => {
  // 80% supera el umbral de riesgo (75) pero no llega a la banda "en regla" (85).
  const { nivel, observaciones } = clasificarRiesgo(80, 80);
  assertEquals(nivel, "observacion");
  assert(observaciones.some((o) => o.includes("observación")));
});

Deno.test("la banda de observación es alcanzable", () => {
  // Guarda contra una regresión: si el umbral de observación queda por debajo
  // del de riesgo, esta franja nunca se alcanza y el estado queda muerto.
  assert(
    seguimientoConfig.umbralAsistenciaObservacion > seguimientoConfig.umbralAsistenciaRiesgo,
    "umbralAsistenciaObservacion debe ser mayor que umbralAsistenciaRiesgo",
  );
  assert(
    seguimientoConfig.umbralAsistenciaRiesgo > seguimientoConfig.umbralAsistenciaRiesgoAlto,
    "el umbral de riesgo debe ser mayor que el de riesgo alto",
  );
});

Deno.test("los límites exactos no disparan riesgo", () => {
  // Justo sobre el umbral: en regla. Justo en el umbral: fuera.
  assertEquals(clasificarRiesgo(seguimientoConfig.umbralNotaRiesgo, 100).nivel, "sin_riesgo");
  assertEquals(
    clasificarRiesgo(seguimientoConfig.umbralNotaRiesgo - 0.01, 100).nivel,
    "riesgo",
  );
});

Deno.test("el índice mezcla promedio y asistencia con los pesos configurados", () => {
  const indice = calcularIndice(80, 90);
  const esperado = 80 * seguimientoConfig.pesoPromedio + 90 * seguimientoConfig.pesoAsistencia;
  assertEquals(indice, Math.round(esperado * 100) / 100);
});

Deno.test("el índice cae a la asistencia cuando no hay notas", () => {
  assertEquals(calcularIndice(null, 88), 88);
});

Deno.test("el índice usa sólo el promedio cuando no hay asistencia", () => {
  assertEquals(calcularIndice(73.5, null), 73.5);
});

Deno.test("en el umbral exacto de riesgo ya no hay riesgo", () => {
  // Justo en el límite: no es riesgo (el corte es exclusivo), queda en observación.
  // Justo por debajo: sí es riesgo.
  const enElLimite = seguimientoConfig.umbralAsistenciaRiesgo;
  const nivelEnLimite = clasificarRiesgo(80, enElLimite).nivel;
  assert(nivelEnLimite !== "riesgo", "en el umbral exacto no debe marcarse riesgo");
  assert(nivelEnLimite !== "riesgo_alto", "en el umbral exacto no debe ser riesgo alto");

  assertEquals(
    clasificarRiesgo(80, enElLimite - 0.1).nivel,
    "riesgo",
  );
});

Deno.test("asistencia alta con nota alta queda en regla", () => {
  assertEquals(clasificarRiesgo(88, 96).nivel, "sin_riesgo");
});
