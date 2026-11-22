// barrel -> API pública del servicio de gestión académica
export {
  activarGestion,
  crearGestionPeriodo,
  desactivarGestion,
  getPeriodoDetalle,
  listarTrimestres,
  obtenerEstadoGestion,
} from "./gestion/periodos.ts";
export { generarEstructura, generarPlanPagos } from "./gestion/estructura.ts";
export {
  generarHorarios,
  guardarHorariosManual,
  listarHorarios,
} from "./gestion/horarios.ts";
export {
  crearAula,
  crearMalla,
  eliminarMalla,
  listarAulas,
  listarMallas,
  listarPlanesPago,
} from "./gestion/catalogos.ts";
export { buildShiftSlots, generateSchedule } from "../utils/horarioAlgoritmo.ts";
