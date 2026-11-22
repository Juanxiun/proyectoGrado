import { query, sTransaction } from "../../connects/Database/transaction.ts";
import type {
  Aula,
  MallaCurricular,
  MallaCurricularInput,
  NivelEducativo,
  PlanPago,
} from "../../models/academic.ts";
import { HttpError, mapDbError } from "../../utils/errors.ts";
import { asDateString, toId } from "../../utils/serialize.ts";
import {
  assertEditable,
  assertEditableTx,
  idValue,
  mapAula,
  mapPlan,
  type AulaRow,
  type PlanRow,
} from "./shared.ts";

// catalogos -> aulas, mallas curriculares y planes de pago
export async function listarAulas(): Promise<Aula[]> {
  const result = await query<AulaRow>(`SELECT id, codigo, nombre, capacidad, activa FROM aulas ORDER BY codigo`);
  return result.rows.map(mapAula);
}

export async function crearAula(input: { codigo: string; nombre: string; capacidad?: number }): Promise<Aula> {
  const codigo = String(input.codigo ?? "").trim().toUpperCase();
  const nombre = String(input.nombre ?? "").trim();
  const capacidad = Number(input.capacidad ?? 30);
  if (!codigo || !nombre) throw new HttpError(400, "codigo y nombre son obligatorios");
  if (!Number.isInteger(capacidad) || capacidad < 1) throw new HttpError(400, "capacidad debe ser mayor a 0");
  try {
    const result = await query<AulaRow>(
      `INSERT INTO aulas (codigo, nombre, capacidad) VALUES ($1, $2, $3)
       RETURNING id, codigo, nombre, capacidad, activa`,
      [codigo, nombre, capacidad],
    );
    return mapAula(result.rows[0]);
  } catch (err) {
    throw mapDbError(err, "Error al crear el aula");
  }
}

export async function crearMalla(
  periodoIdInput?: string,
  input?: MallaCurricularInput,
): Promise<MallaCurricular> {
  const mallaInput = input ?? ({} as MallaCurricularInput);
  let periodoId = periodoIdInput;
  if (!periodoId) {
    const pRes = await query<{ id: bigint }>(
      `SELECT id FROM periodos_academicos WHERE activo = true OR estado IN ('borrador', 'configuracion') ORDER BY activo DESC, anio DESC LIMIT 1`,
    );
    if (!pRes.rows.length) throw new HttpError(400, "No hay ningún periodo académico disponible para asociar la malla");
    periodoId = toId(pRes.rows[0].id);
  }
  await assertEditable(periodoId);
  const materiaId = idValue(mallaInput.materiaId, "materiaId");
  const grado = String(mallaInput.grado ?? "").trim();
  if (!grado) throw new HttpError(400, "grado es obligatorio");
  if (!["inicial", "primaria", "secundaria", "bachillerato"].includes(mallaInput.nivel)) {
    throw new HttpError(400, "nivel inválido en malla curricular");
  }
  const materia = await query<{ id: bigint; tipoMateria: "principal" | "extracurricular"; cargaHorariaSemanal: number; pesoSintactico: number }>(
    `SELECT id, tipo_materia AS "tipoMateria", carga_horaria_semanal AS "cargaHorariaSemanal",
       peso_sintactico AS "pesoSintactico"
     FROM materias WHERE id = $1 AND activo = true`,
    [materiaId],
  );
  if (!materia.rows.length) throw new HttpError(404, "La materia no existe o está inactiva");
  const tipo = mallaInput.tipoMateria ?? materia.rows[0].tipoMateria;
  if (tipo !== "principal" && tipo !== "extracurricular") throw new HttpError(400, "tipoMateria inválido");
  const carga = Number(mallaInput.cargaHorariaSemanal ?? materia.rows[0].cargaHorariaSemanal);
  const peso = Number(mallaInput.pesoSintactico ?? (tipo === "extracurricular" ? 1 : materia.rows[0].pesoSintactico));
  if (!Number.isInteger(carga) || carga < 1 || carga > 40) throw new HttpError(400, "La carga horaria debe estar entre 1 y 40");
  if (!Number.isInteger(peso) || peso < 1 || peso > 100) throw new HttpError(400, "El peso sintáctico debe estar entre 1 y 100");
  if (tipo === "extracurricular" && peso >= 3) throw new HttpError(400, "Las extracurriculares deben tener menor peso sintáctico");
  try {
    const row = await sTransaction(async (tx) => {
      await assertEditableTx(tx, periodoId!);
      const result = await tx.queryObject<{ id: bigint; periodoId: bigint; nivel: NivelEducativo; grado: string; materiaId: bigint; tipoMateria: "principal" | "extracurricular"; cargaHorariaSemanal: number; pesoSintactico: number; materiaCodigo: string; materiaNombre: string }>(
        `INSERT INTO mallas_curriculares
           (periodo_id, nivel, grado, materia_id, tipo_materia, carga_horaria_semanal, peso_sintactico)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (periodo_id, nivel, grado, materia_id) DO UPDATE SET
           tipo_materia = EXCLUDED.tipo_materia,
           carga_horaria_semanal = EXCLUDED.carga_horaria_semanal,
           peso_sintactico = EXCLUDED.peso_sintactico
         RETURNING id, periodo_id AS "periodoId", nivel, grado, materia_id AS "materiaId",
           tipo_materia AS "tipoMateria", carga_horaria_semanal AS "cargaHorariaSemanal",
           peso_sintactico AS "pesoSintactico",
           (SELECT codigo FROM materias WHERE id = $4) AS "materiaCodigo",
           (SELECT nombre FROM materias WHERE id = $4) AS "materiaNombre"`,
        [periodoId, mallaInput.nivel, grado, materiaId, tipo, carga, peso],
      );
      await tx.queryObject(
        `UPDATE periodos_academicos
         SET estructura_generada = true, horarios_generados = false, plan_pagos_generado = false
         WHERE id = $1`,
        [periodoId],
      );
      return result.rows[0];
    });
    return {
      id: toId(row.id), periodoId: toId(row.periodoId), nivel: row.nivel, grado: row.grado,
      materiaId: toId(row.materiaId), tipoMateria: row.tipoMateria,
      cargaHorariaSemanal: Number(row.cargaHorariaSemanal), pesoSintactico: Number(row.pesoSintactico),
      materia: { id: toId(row.materiaId), codigo: row.materiaCodigo, nombre: row.materiaNombre } as MallaCurricular["materia"],
    };
  } catch (err) {
    throw mapDbError(err, "Error al guardar la malla curricular");
  }
}

export async function eliminarMalla(id: string): Promise<void> {
  const mallaId = idValue(id, "id");
  await sTransaction(async (tx) => {
    const existing = await tx.queryObject<{ periodoId: bigint }>(
      `SELECT periodo_id AS "periodoId" FROM mallas_curriculares WHERE id = $1`,
      [mallaId],
    );
    if (!existing.rows.length) throw new HttpError(404, "Malla curricular no encontrada");
    await assertEditableTx(tx, toId(existing.rows[0].periodoId));
    await tx.queryObject(`DELETE FROM mallas_curriculares WHERE id = $1`, [mallaId]);
  });
}

export async function listarMallas(periodoId?: string): Promise<MallaCurricular[]> {
  let targetPeriodoId = periodoId;
  if (!targetPeriodoId) {
    const pRes = await query<{ id: bigint }>(
      `SELECT id FROM periodos_academicos ORDER BY activo DESC, anio DESC LIMIT 1`,
    );
    if (pRes.rows.length) {
      targetPeriodoId = toId(pRes.rows[0].id);
    }
  }
  if (!targetPeriodoId) return [];

  const result = await query<{ id: bigint; periodoId: bigint; nivel: NivelEducativo; grado: string; materiaId: bigint; tipoMateria: "principal" | "extracurricular"; cargaHorariaSemanal: number; pesoSintactico: number; materiaCodigo: string; materiaNombre: string }>(
    `SELECT mc.id, mc.periodo_id AS "periodoId", mc.nivel, mc.grado,
       mc.materia_id AS "materiaId", mc.tipo_materia AS "tipoMateria",
       mc.carga_horaria_semanal AS "cargaHorariaSemanal", mc.peso_sintactico AS "pesoSintactico",
       m.codigo AS "materiaCodigo", m.nombre AS "materiaNombre"
     FROM mallas_curriculares mc JOIN materias m ON m.id = mc.materia_id AND m.activo = true
     WHERE mc.periodo_id = $1 AND mc.activo = true ORDER BY mc.nivel, mc.grado, m.nombre`,
    [targetPeriodoId],
  );
  return result.rows.map((row) => ({
    id: toId(row.id), periodoId: toId(row.periodoId), nivel: row.nivel, grado: row.grado,
    materiaId: toId(row.materiaId), tipoMateria: row.tipoMateria,
    cargaHorariaSemanal: Number(row.cargaHorariaSemanal), pesoSintactico: Number(row.pesoSintactico),
    materia: { id: toId(row.materiaId), codigo: row.materiaCodigo, nombre: row.materiaNombre } as MallaCurricular["materia"],
  }));
}

export async function listarPlanesPago(periodoId: string): Promise<PlanPago[]> {
  const result = await query<PlanRow>(
    `SELECT id, periodo_id AS "periodoId", nivel, nombre, cantidad_cuotas AS "cantidadCuotas",
       monto_total AS "montoTotal", monto_cuota AS "montoCuota", dia_vencimiento AS "diaVencimiento", estado
     FROM planes_pago WHERE periodo_id = $1 ORDER BY nivel`,
    [periodoId],
  );
  const plans = result.rows.map(mapPlan);
  for (const plan of plans) {
    const cuotas = await query<{ id: bigint; planId: bigint; numero: number; anio: number; mes: number; fechaVencimiento: Date | string; monto: number; estado: string }>(
      `SELECT id, plan_id AS "planId", numero, anio, mes, fecha_vencimiento AS "fechaVencimiento", monto, estado
       FROM cuotas_plan_pago WHERE plan_id = $1 ORDER BY numero`,
      [plan.id],
    );
    plan.cuotas = cuotas.rows.map((row) => ({
      id: toId(row.id), planId: toId(row.planId), numero: Number(row.numero), anio: Number(row.anio), mes: Number(row.mes),
      fechaVencimiento: asDateString(row.fechaVencimiento), monto: Number(row.monto), estado: row.estado as "pendiente" | "pagado" | "anulado",
    }));
  }
  return plans;
}
