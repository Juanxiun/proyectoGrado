import { sTransaction } from "../../connects/Database/transaction.ts";
import type {
  EstadoGestion,
  EstructuraNivelInput,
  GenerarEstructuraInput,
  GenerarPlanPagoInput,
  MallaCurricularInput,
  NivelEducativo,
} from "../../models/academic.ts";
import { HttpError, mapDbError } from "../../utils/errors.ts";
import {
  buildInstallments,
  countManagementMonths,
  distributeInstallmentAmounts,
} from "../../utils/gestionValidation.ts";
import { gradoTieneMaterias, obtenerMateriasPorGrado } from "../gradoMateria.service.ts";
import {
  DEFAULT_GRADES,
  DEFAULT_LEVELS,
  assertEditable,
  assertEditableTx,
  assertScheduleEditable,
  assertScheduleEditableTx,
  ensureTurnos,
  getPeriodoRow,
  idValue,
  mapPeriodo,
} from "./shared.ts";
import { activarAutomaticamenteSiEstaCompleta, obtenerEstadoGestion } from "./periodos.ts";

// estructura -> cursos, mallas curriculares y planes de pago
export async function generarEstructura(
  periodoId: string,
  input: GenerarEstructuraInput = {},
): Promise<EstadoGestion> {
  await assertEditable(periodoId);
  const niveles: EstructuraNivelInput[] = input.niveles?.length
    ? input.niveles
    : input.paralelosPorNivel && Object.keys(input.paralelosPorNivel).length
    ? Object.entries(input.paralelosPorNivel).map(([nivel, value]) => ({
      nivel: nivel as NivelEducativo,
      grados: !Array.isArray(value) ? Object.keys(value) : undefined,
      paralelos: Array.isArray(value)
        ? Object.fromEntries(DEFAULT_GRADES.map((grade) => [grade, value.length]))
        : value,
    }))
    : DEFAULT_LEVELS;
  const normalizados = niveles.map((level) => {
    if (!["inicial", "primaria", "secundaria", "bachillerato"].includes(level.nivel)) {
      throw new HttpError(400, `Nivel no válido: ${level.nivel}`);
    }
    return {
      nivel: level.nivel,
      grados: level.grados?.length ? level.grados : DEFAULT_LEVELS.find((item) => item.nivel === level.nivel)?.grados ?? DEFAULT_GRADES,
      paralelos: level.paralelos ?? {},
    };
  });

  const capacidadMaxima = Number(input.capacidadMaxima ?? 30);
  if (!Number.isInteger(capacidadMaxima) || capacidadMaxima < 1 || capacidadMaxima > 1000) {
    throw new HttpError(400, "capacidadMaxima debe ser un entero entre 1 y 1000");
  }
  // logica -> excluir grados sin materias
  const gradosConMateria = new Set<string>();
  for (const level of normalizados) {
    for (const grade of level.grados) {
      if (await gradoTieneMaterias(level.nivel, grade)) {
        gradosConMateria.add(`${level.nivel}:${grade}`);
      }
    }
  }
  const cursosSinMaterias: string[] = [];

  try {
    await sTransaction(async (tx) => {
      await assertEditableTx(tx, periodoId);
      const turnos = await ensureTurnos(tx);
      for (const level of normalizados) {
        for (const grade of level.grados) {
          const count = Number(level.paralelos[grade] ?? 1);
          if (!Number.isInteger(count) || count < 1 || count > 26) {
            throw new HttpError(400, `La cantidad de paralelos de ${grade} debe estar entre 1 y 26`);
          }
          for (let index = 0; index < count; index++) {
            const parallel = String.fromCharCode(65 + index);
            const course = await tx.queryObject<{ id: bigint }>(
              `INSERT INTO cursos (nivel, grado, paralelo, capacidad_maxima)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (nivel, grado, paralelo) DO UPDATE SET capacidad_maxima = EXCLUDED.capacidad_maxima, activo = true
               RETURNING id`,
              [level.nivel, grade, parallel, capacidadMaxima],
            );
            const cursoId = String(course.rows[0].id);

            if (!gradosConMateria.has(`${level.nivel}:${grade}`)) {
              cursosSinMaterias.push(`${grade} ${parallel} ${level.nivel}`);
              continue;
            }

            const turnoCode = input.turnoPorCurso?.[`${level.nivel}:${grade}:${parallel}`] ?? input.turnoPorNivel?.[level.nivel] ?? "manana";
            if (turnoCode !== "manana" && turnoCode !== "tarde") {
              throw new HttpError(400, `Turno inválido para ${level.nivel} ${grade} ${parallel}`);
            }
            const turno = turnos.get(turnoCode) ?? turnos.get("manana");
            if (!turno) throw new HttpError(500, "No se pudo obtener el turno por defecto");
            await tx.queryObject<{ id: bigint }>(
              `INSERT INTO cursos_periodo (curso_id, periodo_id, capacidad_maxima, turno_id, estado)
               VALUES ($1, $2, $3, $4, 'activo')
               ON CONFLICT (curso_id, periodo_id) DO UPDATE SET
                 turno_id = EXCLUDED.turno_id,
                 capacidad_maxima = EXCLUDED.capacidad_maxima,
                 estado = 'activo'
               RETURNING id`,
              [cursoId, periodoId, capacidadMaxima, turno.id],
            );
            // logica -> matricula habilita al activar
          }
        }
      }

      // logica -> malla desde materias grado
      const mallas = input.mallasCurriculares?.length
        ? input.mallasCurriculares
        : (await construirMallasDesdeGrados(normalizados));

      for (const malla of mallas) {
        if (!String(malla.grado ?? "").trim()) throw new HttpError(400, "grado de malla curricular es obligatorio");
        if (!["inicial", "primaria", "secundaria", "bachillerato"].includes(malla.nivel)) {
          throw new HttpError(400, `Nivel no válido en malla curricular: ${malla.nivel}`);
        }
        const tipoMalla = malla.tipoMateria;
        if (tipoMalla !== undefined && tipoMalla !== "principal" && tipoMalla !== "extracurricular") {
          throw new HttpError(400, "tipoMateria inválido en malla curricular");
        }
        const materiaId = idValue(malla.materiaId, "materiaId");
        const materia = await tx.queryObject<{
          tipoMateria: "principal" | "extracurricular";
          cargaHorariaSemanal: number;
          pesoSintactico: number;
        }>(
          `SELECT tipo_materia AS "tipoMateria", carga_horaria_semanal AS "cargaHorariaSemanal",
             peso_sintactico AS "pesoSintactico"
           FROM materias WHERE id = $1 AND activo = true`,
          [materiaId],
        );
        if (!materia.rows.length) throw new HttpError(404, `Materia id=${materiaId} no encontrada o inactiva`);
        const tipo = malla.tipoMateria ?? materia.rows[0].tipoMateria;
        const carga = Number(malla.cargaHorariaSemanal ?? materia.rows[0].cargaHorariaSemanal);
        const peso = Number(malla.pesoSintactico ?? (tipo === "extracurricular" ? 1 : materia.rows[0].pesoSintactico));
        if (!Number.isInteger(carga) || carga < 1 || carga > 40) throw new HttpError(400, "La carga horaria debe estar entre 1 y 40");
        if (!Number.isInteger(peso) || peso < 1 || peso > 100) throw new HttpError(400, "El peso sintáctico debe estar entre 1 y 100");
        if (tipo === "extracurricular" && peso >= 3) throw new HttpError(400, "Las materias extracurriculares deben tener un peso sintáctico menor");
        await tx.queryObject(
          `INSERT INTO mallas_curriculares
             (periodo_id, nivel, grado, materia_id, tipo_materia, carga_horaria_semanal, peso_sintactico)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (periodo_id, nivel, grado, materia_id) DO UPDATE SET
             tipo_materia = EXCLUDED.tipo_materia,
             carga_horaria_semanal = EXCLUDED.carga_horaria_semanal,
             peso_sintactico = EXCLUDED.peso_sintactico`,
          [periodoId, malla.nivel, malla.grado, materiaId, tipo, carga, peso],
        );
      }

      for (const assignment of input.asignaciones ?? []) {
        const cpId = idValue(assignment.cursoPeriodoId, "cursoPeriodoId");
        const materiaId = idValue(assignment.materiaId, "materiaId");
        const cp = await tx.queryObject<{ id: bigint; nivel: NivelEducativo; grado: string }>(
          `SELECT cp.id, c.nivel, c.grado
           FROM cursos_periodo cp
           JOIN cursos c ON c.id = cp.curso_id
           WHERE cp.id = $1 AND cp.periodo_id = $2`,
          [cpId, periodoId],
        );
        if (!cp.rows.length) throw new HttpError(404, `El curso ${cpId} no pertenece a la gestión`);
        const materia = await tx.queryObject<{ id: bigint }>(`SELECT id FROM materias WHERE id = $1 AND activo = true`, [materiaId]);
        if (!materia.rows.length) throw new HttpError(404, `Materia id=${materiaId} no encontrada o inactiva`);
        const malla = await tx.queryObject<{ id: bigint }>(
          `SELECT id FROM mallas_curriculares
           WHERE periodo_id = $1 AND nivel = $2 AND grado = $3 AND materia_id = $4 AND activo = true
           LIMIT 1`,
          [periodoId, cp.rows[0].nivel, cp.rows[0].grado, materiaId],
        );
        if (!malla.rows.length) throw new HttpError(409, "La materia no pertenece a la malla curricular del curso");
        const maestroInput = idValue(assignment.maestroId, "maestroId");
        let maestro = await tx.queryObject<{ id: bigint; materiasConfiguradas: boolean; materiaPermitida: boolean }>(
          `SELECT m.id,
                  COALESCE(m.materias_configuradas, false) AS \"materiasConfiguradas\",
                  EXISTS (SELECT 1 FROM maestro_materias mm WHERE mm.maestro_id = m.id AND mm.materia_id = $2) AS \"materiaPermitida\"
           FROM maestros m WHERE m.usuario_id = $1 AND m.estado = 'activo' LIMIT 1`,
          [maestroInput, materiaId],
         );
        if (!maestro.rows.length) {
          maestro = await tx.queryObject<{ id: bigint; materiasConfiguradas: boolean; materiaPermitida: boolean }>(
            `SELECT m.id,
                    COALESCE(m.materias_configuradas, false) AS \"materiasConfiguradas\",
                    EXISTS (SELECT 1 FROM maestro_materias mm WHERE mm.maestro_id = m.id AND mm.materia_id = $2) AS \"materiaPermitida\"
             FROM maestros m WHERE m.id = $1 AND m.estado = 'activo' LIMIT 1`,
            [maestroInput, materiaId],
          );
        }
        if (!maestro.rows.length) throw new HttpError(404, "El docente no existe o está inactivo");
        if (maestro.rows[0].materiasConfiguradas && !maestro.rows[0].materiaPermitida) {
          throw new HttpError(409, "El docente no está habilitado para impartir la materia seleccionada");
        }
        await tx.queryObject(
          `INSERT INTO asignaciones_docentes (maestro_id, materia_id, curso_periodo_id, estado)
           VALUES ($1, $2, $3, 'activo')
           ON CONFLICT (maestro_id, materia_id, curso_periodo_id) DO NOTHING`,
          [maestro.rows[0].id, materiaId, cpId],
        );
      }

      await tx.queryObject(
        `UPDATE periodos_academicos
         SET estructura_generada = true,
             horarios_generados = false,
             plan_pagos_generado = false,
             estado = CASE WHEN estado = 'borrador' THEN 'configuracion' ELSE estado END
         WHERE id = $1`,
        [periodoId],
      );
    });
  } catch (err) {
    throw mapDbError(err, "Error al generar la estructura académica");
  }

  const estado = await obtenerEstadoGestion(periodoId);

  if (cursosSinMaterias.length > 0) {
    // aviso -> cursos sin materias omitidos
    console.warn(
      `[generarEstructura] ${periodoId}: ${cursosSinMaterias.length} curso(s) sin materias, omitidos: ${
        cursosSinMaterias.join(", ")
      }`,
    );
    return {
      ...estado,
      cursosSinMaterias,
    };
  }

  return estado;
}

// funcion -> armar malla desde grados
async function construirMallasDesdeGrados(
  normalizados: Array<{ nivel: NivelEducativo; grados: string[] }>,
): Promise<MallaCurricularInput[]> {
  const mallas: MallaCurricularInput[] = [];

  for (const level of normalizados) {
    for (const grade of level.grados) {
      const delGrado = await obtenerMateriasPorGrado(level.nivel, grade);

      for (const materia of delGrado) {
        mallas.push({
          nivel: level.nivel,
          grado: grade,
          materiaId: materia.materiaId,
          tipoMateria: materia.tipoMateria,
          cargaHorariaSemanal: materia.cargaHorariaSemanal,
        });
      }
    }
  }

  return mallas;
}

export async function generarPlanPagos(
  periodoId: string,
  input: GenerarPlanPagoInput = {},
): Promise<EstadoGestion> {
  await assertScheduleEditable(periodoId);
  const periodo = mapPeriodo(await getPeriodoRow(periodoId));
  const months = countManagementMonths(periodo.inicioGestion, periodo.finGestion);
  const dia = Number(input.diaVencimiento ?? 10);
  if (!Number.isInteger(dia) || dia < 1 || dia > 28) throw new HttpError(400, "diaVencimiento debe estar entre 1 y 28");
  const supplied = input.montosPorNivel ?? {};
  if (input.montoCuota !== undefined && (!Number.isFinite(Number(input.montoCuota)) || Number(input.montoCuota) <= 0)) {
    throw new HttpError(400, "montoCuota debe ser mayor a 0");
  }
  if (input.montoTotal !== undefined && (!Number.isFinite(Number(input.montoTotal)) || Number(input.montoTotal) <= 0)) {
    throw new HttpError(400, "montoTotal debe ser mayor a 0");
  }
  if (input.montoTotal !== undefined && Object.keys(supplied).length > 0) {
    throw new HttpError(400, "Use montosPorNivel o montoTotal, no ambos a la vez");
  }
  const defaultMonthly = input.montoCuota !== undefined
    ? Number(input.montoCuota)
    : input.montoTotal !== undefined
    ? Number(input.montoTotal) / months
    : 0;
  if (!Object.keys(supplied).length && defaultMonthly <= 0) {
    throw new HttpError(400, "Indique montoCuota, montoTotal o montosPorNivel");
  }
  if (input.montoCuota !== undefined && input.montoTotal !== undefined) {
    const expected = Number(input.montoCuota) * months;
    if (Math.abs(expected - Number(input.montoTotal)) > 0.01) {
      throw new HttpError(400, "montoCuota y montoTotal no son consistentes");
    }
  }
  try {
    await sTransaction(async (tx) => {
      await assertScheduleEditableTx(tx, periodoId);
      const courseLevels = await tx.queryObject<{ nivel: string }>(
        `SELECT DISTINCT c.nivel
         FROM cursos_periodo cp
         JOIN cursos c ON c.id = cp.curso_id
         WHERE cp.periodo_id = $1 AND cp.estado = 'activo' AND c.activo = true`,
        [periodoId],
      );
      const levels = Object.keys(supplied).length
        ? Object.keys(supplied)
        : [...new Set(courseLevels.rows.map((row) => row.nivel))];
      if (!levels.length) throw new HttpError(409, "La gestión no tiene cursos activos para generar planes de pago");
      const existingPlans = await tx.queryObject<{ nivel: string }>(
        `SELECT nivel FROM planes_pago WHERE periodo_id = $1`,
        [periodoId],
      );
      for (const existing of existingPlans.rows) {
        if (!levels.includes(existing.nivel)) {
          await tx.queryObject(`DELETE FROM planes_pago WHERE periodo_id = $1 AND nivel = $2`, [periodoId, existing.nivel]);
        }
      }
      for (const nivel of levels) {
        if (!["general", "primaria", "secundaria", "bachillerato"].includes(nivel)) {
          throw new HttpError(400, `Nivel de plan de pago inválido: ${nivel}`);
        }
        const monthly = Number(supplied[nivel as keyof typeof supplied] ?? defaultMonthly);
        if (!Number.isFinite(monthly) || monthly <= 0) throw new HttpError(400, `El monto de ${nivel} debe ser mayor a 0`);
        const targetTotal = Object.keys(supplied).length
          ? Math.round(monthly * months * 100) / 100
          : Math.round(Number(input.montoTotal ?? monthly * months) * 100) / 100;
        const installments = buildInstallments(periodo.inicioGestion, periodo.finGestion, monthly, dia);
        distributeInstallmentAmounts(installments, targetTotal);
        const monthlyDisplay = Math.round((targetTotal / months) * 100) / 100;
        const plan = await tx.queryObject<{ id: bigint }>(
          `INSERT INTO planes_pago
             (periodo_id, nivel, nombre, cantidad_cuotas, monto_total, monto_cuota, dia_vencimiento, estado)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'generado')
           ON CONFLICT (periodo_id, nivel) DO UPDATE SET
             nombre = EXCLUDED.nombre,
             cantidad_cuotas = EXCLUDED.cantidad_cuotas,
             monto_total = EXCLUDED.monto_total,
             monto_cuota = EXCLUDED.monto_cuota,
             dia_vencimiento = EXCLUDED.dia_vencimiento,
             estado = 'generado'
           RETURNING id`,
          [periodoId, nivel, `Plan ${nivel} ${periodo.anio}`, months, targetTotal, monthlyDisplay, dia],
        );
        const planId = plan.rows[0].id;
        await tx.queryObject(`DELETE FROM cuotas_plan_pago WHERE plan_id = $1`, [planId]);
        for (const installment of installments) {
          await tx.queryObject(
            `INSERT INTO cuotas_plan_pago (plan_id, numero, anio, mes, fecha_vencimiento, monto)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [planId, installment.numero, installment.anio, installment.mes, installment.fechaVencimiento, installment.monto],
          );
        }
      }
      await tx.queryObject(`UPDATE periodos_academicos SET plan_pagos_generado = true WHERE id = $1`, [periodoId]);
    });
  } catch (err) {
    throw mapDbError(err, "Error al generar el plan de pagos");
  }
  await activarAutomaticamenteSiEstaCompleta(periodoId);
  return obtenerEstadoGestion(periodoId);
}
