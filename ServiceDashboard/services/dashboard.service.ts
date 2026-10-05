import { query } from "../connects/Database/transaction.ts";
import { conCache } from "./cache.service.ts";
import { resolverContexto, type Contexto } from "./alcance.service.ts";
import { resumenAcademico } from "./academico.service.ts";
import { resumenAsistencia } from "./asistencia.service.ts";
import { resumenEconomico } from "./economico.service.ts";
import { resumenRiesgo } from "./riesgo.service.ts";
import { ROLES_INSTITUCION, type AppRole } from "../security/auth.ts";
import type {
  DashboardCompleto,
  ResumenAsistenciaDashboard,
  ResumenEconomico,
  ResumenRiesgo,
  TarjetaKpi,
} from "../models/dashboard.ts";

// servicio -> orquesta tablero solo lectura

async function rangoTrimestre(
  periodoId: string,
  trimestre: number,
): Promise<{ desde: string; hasta: string }> {
  const res = await query<{ inicio: Date; fin: Date }>(
    `SELECT inicio, fin FROM trimestres WHERE periodo_id = $1 AND numero = $2`,
    [periodoId, trimestre],
  );

  if (res.rows.length === 0) {
    // caso -> fallback gestion completa
    const periodo = await query<{ inicio_gestion: Date; fin_gestion: Date }>(
      `SELECT inicio_gestion, fin_gestion FROM periodos_academicos WHERE id = $1`,
      [periodoId],
    );
    if (periodo.rows.length === 0) {
      return { desde: "1900-01-01", hasta: "2999-12-31" };
    }
    return {
      desde: periodo.rows[0].inicio_gestion.toISOString().slice(0, 10),
      hasta: periodo.rows[0].fin_gestion.toISOString().slice(0, 10),
    };
  }

  return {
    desde: res.rows[0].inicio.toISOString().slice(0, 10),
    hasta: res.rows[0].fin.toISOString().slice(0, 10),
  };
}

export async function dashboardCompleto(
  usuarioId: string,
  rol: AppRole,
  periodoPedido: string | null,
  trimestre: number,
): Promise<DashboardCompleto> {
  const inicio = Date.now();
  const contexto = await resolverContexto(usuarioId, rol, periodoPedido, trimestre);
  const periodoId = contexto.periodo?.id ?? "";

  const { desde, hasta } = periodoId
    ? await rangoTrimestre(periodoId, trimestre)
    : { desde: "1900-01-01", hasta: "2999-12-31" };

  // regla -> economico solo institucion
  const verEconomico = ROLES_INSTITUCION.includes(rol);

  const claveExtra = `t${trimestre}`;

  const [academico, asistencia, riesgo, economico] = await Promise.all([
    conCache("academico", contexto.alcance, periodoId, () => resumenAcademico(contexto, trimestre), claveExtra),
    conCache("asistencia", contexto.alcance, periodoId, () => resumenAsistencia(contexto, desde, hasta), claveExtra),
    conCache("riesgo", contexto.alcance, periodoId, () => resumenRiesgo(contexto, desde, hasta), claveExtra),
    verEconomico
      ? conCache("economico", contexto.alcance, periodoId, () => resumenEconomico(periodoId), claveExtra)
      : Promise.resolve<{ datos: ResumenEconomico | null; info: { cacheado: boolean; duracionMs: number } }>({
        datos: null,
        info: { cacheado: false, duracionMs: 0 },
      }),
  ]);

  return {
    contexto: {
      periodo: contexto.periodo,
      alcance: contexto.alcance,
      descripcionAlcance: contexto.descripcion,
      generadoEn: new Date().toISOString(),
      cacheado:
        academico.info.cacheado ||
        asistencia.info.cacheado ||
        riesgo.info.cacheado,
      duracionMs: Date.now() - inicio,
    },
    kpis: tarjetas(contexto, academico.datos, asistencia.datos, riesgo.datos, economico.datos, verEconomico),
    academico: academico.datos,
    asistencia: asistencia.datos,
    riesgo: riesgo.datos,
    economico: economico.datos,
    economicoOculto: !verEconomico,
  };
}

function tarjetas(
  contexto: Contexto,
  academico: Awaited<ReturnType<typeof resumenAcademico>>,
  asistencia: ResumenAsistenciaDashboard,
  riesgo: ResumenRiesgo,
  economico: ResumenEconomico | null,
  verEconomico: boolean,
): TarjetaKpi[] {
  const lista: TarjetaKpi[] = [
    {
      clave: "matricula",
      etiqueta: "Estudiantes matriculados",
      valor: academico.matricula.total,
      icono: "people-outline",
      detalle: `${academico.cursos.total} cursos · ${academico.materias.total} materias`,
    },
    {
      clave: "avance",
      etiqueta: "Avance de calificación",
      valor: academico.materias.avanceGlobal,
      sufijo: "%",
      icono: "trending-up-outline",
      detalle: "Del trimestre, tareas ya calificadas",
    },
    {
      clave: "asistencia",
      etiqueta: "Asistencia efectiva",
      valor: asistencia.global.tasa,
      sufijo: "%",
      icono: "checkmark-done-outline",
      detalle: `${asistencia.global.ausentes} faltas de ${asistencia.global.registros} registros`,
      alerta: (asistencia.global.tasa ?? 100) < 85,
    },
    {
      clave: "riesgo",
      etiqueta: "Estudiantes en riesgo",
      valor: riesgo.total,
      icono: "warning-outline",
      detalle: `${riesgo.riesgoAlto} en riesgo alto · ${riesgo.observacion} en observación`,
      alerta: riesgo.riesgoAlto > 0,
    },
  ];

  if (verEconomico && economico) {
    lista.push({
      clave: "cobranza",
      etiqueta: "Cobranza del período",
      valor: economico.porcentajeCobranza,
      sufijo: "%",
      icono: "cash-outline",
      detalle: `Bs ${formatearMoneda(economico.cobrado)} cobrados de Bs ${formatearMoneda(economico.facturado)}`,
      alerta: (economico.porcentajeCobranza ?? 100) < 70,
    });
    lista.push({
      clave: "cartera",
      etiqueta: "Cartera vencida",
      valor: economico.morosidad.carteraVencida,
      icono: "alert-circle-outline",
      detalle: `${economico.morosidad.estudiantesConDeuda} estudiantes con deuda`,
      alerta: economico.morosidad.carteraVencida > 0,
    });
  }

  // caso -> docente sin carga
  if (contexto.alcance === "docente" && !contexto.maestroId) {
    lista.unshift({
      clave: "sin_carga",
      etiqueta: "Aviso",
      valor: "Sin carga horaria",
      icono: "information-circle-outline",
      detalle: "No tenés cursos asignados en esta gestión.",
    });
  }

  return lista;
}

function formatearMoneda(valor: number): string {
  return new Intl.NumberFormat("es-BO", { maximumFractionDigits: 0 }).format(valor);
}
