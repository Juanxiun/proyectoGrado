import { apiRequest, buildQuery } from './client';

export type NivelRiesgo = 'sin_riesgo' | 'observacion' | 'riesgo' | 'riesgo_alto';

export interface TarjetaKpi {
  clave: string;
  etiqueta: string;
  valor: number | string | null;
  sufijo?: string;
  detalle?: string;
  icono: string;
  alerta?: boolean;
}

export interface PeriodoRef {
  id: string;
  nombre: string;
  anio: number;
  estado: string;
  activo: boolean;
  trimestre: number;
}

export interface ContextoDashboard {
  periodo: PeriodoRef | null;
  alcance: 'institucion' | 'docente' | 'propio';
  descripcionAlcance: string;
  generadoEn: string;
  cacheado: boolean;
  duracionMs: number;
}

export interface ResumenAsistencia {
  registros: number;
  presentes: number;
  ausentes: number;
  atrasos: number;
  justificadas: number;
  diasRegistrados: number;
  tasa: number | null;
}

export interface AvanceMateria {
  materiaId: string;
  materia: string;
  tipoMateria: string;
  cursoParalelo: string;
  maestro?: string | null;
  encargosPublicados: number;
  encargosCalificados: number;
  avanceCalificacion: number;
  promedio: number | null;
  estudiantesSinNota: number;
  estudiantes: number;
}

export interface ResumenAcademico {
  periodos: PeriodoRef[];
  matricula: { total: number; porNivel: Array<{ nivel: string; estudiantes: number; cursos: number }> };
  cursos: { total: number; conDocente: number; sinDocente: number };
  materias: { total: number; conEncargos: number; sinEncargos: number; avanceGlobal: number };
  estadoGestion: {
    estructuraGenerada: boolean;
    horariosGenerados: boolean;
    planPagosGenerado: boolean;
    listoParaActivar: boolean;
  };
  _avance: AvanceMateria[];
}

export interface ResumenRiesgo {
  total: number;
  observacion: number;
  riesgo: number;
  riesgoAlto: number;
  sinRiesgo: number;
  umbrales: {
    notaRiesgo: number;
    asistenciaRiesgo: number;
    notaRiesgoAlto: number;
    asistenciaRiesgoAlto: number;
  };
  top: Array<{
    estudianteId: string;
    nombre: string;
    apellidoPaterno: string;
    cursoParalelo: string;
    promedio: number | null;
    asistencia: number | null;
    nivelRiesgo: NivelRiesgo;
    motivos: string[];
  }>;
}

export interface ResumenEconomico {
  moneda: string;
  facturado: number;
  cobrado: number;
  pendiente: number;
  vencido: number;
  anulado: number;
  porcentajeCobranza: number | null;
  proyectado: { proximos30Dias: number; restoDelPeriodo: number; diasProyeccion: number };
  morosidad: {
    carteraVencida: number;
    estudiantesConDeuda: number;
    deudaPromedio: number;
    antiguedadPromedioDias: number | null;
  };
  porMes: Array<{ mes: number; anio: number; facturado: number; cobrado: number; pendiente: number }>;
  topDeudores: Array<{
    estudianteId: string;
    nombre: string;
    apellidoPaterno: string;
    deuda: number;
    cuotasPendientes: number;
    diasAtraso: number | null;
  }>;
  ingresoMesActual: number;
}

export interface DashboardData {
  contexto: ContextoDashboard;
  kpis: TarjetaKpi[];
  academico: ResumenAcademico;
  asistencia: {
    global: ResumenAsistencia;
    ultimosDias: Array<{ fecha: string; presentes: number; ausentes: number; tasa: number | null }>;
    porMateria: Array<{
      materiaId: string;
      materia: string;
      cursoParalelo: string;
      total: number;
      ausentes: number;
      tasa: number | null;
      mayorFaltas: number;
    }>;
    estudiantesConMasFaltas: Array<{
      estudianteId: string;
      nombre: string;
      apellidoPaterno: string;
      cursoParalelo: string;
      ausentes: number;
      justificadas: number;
      total: number;
    }>;
  };
  riesgo: ResumenRiesgo;
  economico: ResumenEconomico | null;
  economicoOculto?: boolean;
}

/**
 * Tablero de inicio. Es un servicio de sólo lectura en el backend: el recorte
 * por rol ya viene aplicado, así que acá no hay filtros que enviar.
 */
export const dashboardApi = {
  async get(params: { periodoId?: string; trimestre?: number } = {}): Promise<DashboardData | null> {
    try {
      return await apiRequest<DashboardData>(`/api/dashboard${buildQuery(params)}`);
    } catch (err) {
      console.warn('[dashboardApi.get]', err);
      return null;
    }
  },

  async riesgo(params: { periodoId?: string; trimestre?: number } = {}): Promise<ResumenRiesgo | null> {
    try {
      return await apiRequest<ResumenRiesgo>(`/api/dashboard/riesgo${buildQuery(params)}`);
    } catch (err) {
      console.warn('[dashboardApi.riesgo]', err);
      return null;
    }
  },

  async economico(params: { periodoId?: string } = {}): Promise<ResumenEconomico | null> {
    try {
      return await apiRequest<ResumenEconomico>(`/api/dashboard/economico${buildQuery(params)}`);
    } catch (err) {
      console.warn('[dashboardApi.economico]', err);
      return null;
    }
  },

  async invalidarCache(): Promise<boolean> {
    try {
      const res = await apiRequest<{ success: boolean }>('/api/dashboard/cache/invalidar', {
        method: 'POST',
      });
      return Boolean(res?.success);
    } catch (err) {
      console.warn('[dashboardApi.invalidarCache]', err);
      return false;
    }
  },
};

export const MESES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];
