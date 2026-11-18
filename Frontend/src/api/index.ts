export { ApiClientError, apiRequest, buildQuery } from "./client";
export { authApi } from "./auth.api";
export { usuariosApi } from "./usuarios.api";
export { academicManagementApi, academicServicesApi } from "./academicServices.api";
export { billingApi, type PlanPago, type CuotaPlanPago, type PagoRealizado, type EstudianteDeuda, type DeudaEstudiantePeriodo, type Page, formatearMonto, getEstadoBadge, getEstadoColor, MONEDA } from "./billing.api";
export { 
  economiaApi, 
  type PlanPago as PlanPagoEco, 
  type CuotaPlanPago as CuotaPlanPagoEco, 
  type PagoRealizado as PagoRealizadoEco, 
  type EstudianteDeuda as EstudianteDeudaEco, 
  type DeudaEstudiantePeriodo as DeudaEstudiantePeriodoEco, 
  type EstudianteEconomico, 
  type KpisEconomia, 
  type Page as PageEco, 
  formatearMonto as formatearMontoEco, 
  getEstadoBadge as getEstadoBadgeEco, 
  getEstadoColor as getEstadoColorEco, 
  MONEDA as MONEDA_ECO, 
  getDeudaEstado, 
  getDeudaBadgeVariant, 
  getDeudaLabel 
} from "./economia.api";
export type { EstadoGestion, GestionTrimestre, TrimestreInput } from "./academicServices.api";
export { gamificacionApi } from "./gamificacion.api";
export type {
  ResumenGamificacion,
  InfoEstudianteGamificacion,
  PreguntaActividad,
  RespuestaActividad,
  CompletarActividadPayload,
  ResultadoActividad,
  RankingEstudiante,
  RankingParalelo,
  RecompensaTienda,
  CompraEstudiante,
  Insignia,
  InsigniaEstudiante,
  Trofeo,
  TrofeoEstudiante,
} from "./gamificacion.api";