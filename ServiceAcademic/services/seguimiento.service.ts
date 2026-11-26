// barrel -> servicio seguimiento academico
export type { FiltroLibro, FiltroPanel } from "./seguimiento/comun.ts";
export { obtenerLibro } from "./seguimiento/libro.ts";
export { obtenerPanelCurso, obtenerPanelEstudiante } from "./seguimiento/paneles.ts";
export { listarRiesgo } from "./seguimiento/riesgo.ts";
export { esTrimestreValido, calcularIndice, clasificarRiesgo } from "./seguimiento/comun.ts";
