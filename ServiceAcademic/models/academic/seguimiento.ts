// tipos -> seguimiento academico (libro de notas, paneles y riesgo)
export type NivelRiesgo = "sin_riesgo" | "observacion" | "riesgo" | "riesgo_alto";

// tipo -> linea libro notas
export interface LineaLibro {
  estudianteId: string;
  usuarioId: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string | null;

  // campo -> promedio ponderado trimestre
  promedio: number | null;
  // campo -> peso acumulado encargos
  pesoAcumulado: number;
  // campo -> peso total publicados
  pesoTotal: number;
  // campo -> tareas calificadas sobre publicadas
  tareasCalificadas: number;
  tareasPublicadas: number;

  desercion: number | null;

  asistencia: ResumenAsistencia;
  indice: number | null;
  nivelRiesgo: NivelRiesgo;
  observaciones: string[];
}

export interface ResumenAsistencia {
  presentes: number;
  ausentes: number;
  atrasos: number;
  justificadas: number;
  total: number;
  // campo -> tasa asistencia efectiva
  tasa: number | null;
}

export interface EncargoLibro {
  id: string;
  titulo: string;
  tipo: string;
  ponderacion: number;
  fechaPublicacion?: string | null;
  fechaLimite?: string | null;
  estado: string;
  // campo -> promedio curso encargo
  promedioCurso?: number | null;
}

// tipo -> libro notas materia
export interface LibroNotas {
  cursoPeriodoId: string;
  materia: { id: string; nombre: string; codigo: string; tipo: string };
  trimestre: { numero: number; inicio: string; fin: string } | null;
  periodo: { id: string; nombre: string; anio: number };
  curso: { id: string; grado: string; paralelo: string; nivel: string };
  docente?: { maestroId: string; usuarioId: string; nombre: string } | null;
  encargos: EncargoLibro[];
  lineas: LineaLibro[];
  resumen: {
    estudiantes: number;
    promedioCurso: number | null;
    promedioMasAlto: number | null;
    promedioMasBajo: number | null;
    enRiesgo: number;
    enRiesgoAlto: number;
  };
}

// tipo -> desempeno materia estudiante
export interface DesempenoMateria {
  materiaId: string;
  materia: string;
  tipoMateria: string;
  cursoParalelo: string;
  promedio: number | null;
  indice: number | null;
  asistencia: ResumenAsistencia;
  tareasCalificadas: number;
  tareasPublicadas: number;
  indiceDesempeno: number;
  nivelRiesgo: NivelRiesgo;
}

// tipo -> panel curso periodo
export interface PanelCurso {
  cursoPeriodoId: string;
  curso: { id: string; grado: string; paralelo: string; nivel: string };
  periodo: { id: string; nombre: string; anio: number };
  estudiantes: number;
  // campo -> total materias evaluadas
  totalMaterias: number;
  promedioGeneral: number | null;
  promedioAsistencia: number | null;
  distribucionPromedios: RangoPromedio[];
  materias: DesempenoMateriaResumen[];
  riesgo: { total: number; observacion: number; alto: number };
}

export interface RangoPromedio {
  rango: string;
  minimo: number;
  maximo: number;
  estudiantes: number;
}

export interface DesempenoMateriaResumen {
  materiaId: string;
  materia: string;
  tipoMateria: string;
  promedio: number | null;
  promedioAsistencia: number | null;
  estudiantesEvaluados: number;
  enRiesgo: number;
}

export interface PanelEstudiante {
  estudianteId: string;
  usuarioId: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string | null;
  cursoParalelo: string;
  indiceGeneral: number | null;
  indiceDesempeno: number | null;
  nivelRiesgo: NivelRiesgo;
  periodos: PanelEstudiantePeriodo[];
}

export interface PanelEstudiantePeriodo {
  periodoId: string;
  nombre: string;
  anio: number;
  promedio: number | null;
  indice: number | null;
  asistencia: ResumenAsistencia;
  indiceDesempeno: number;
  nivelRiesgo: NivelRiesgo;
  materias: DesempenoMateria[];
}

export interface AlertaRiesgo {
  estudianteId: string;
  nombre: string;
  apellidoPaterno: string;
  cursoParalelo: string;
  materia: string;
  promedio: number | null;
  asistencia: number | null;
  nivelRiesgo: NivelRiesgo;
  motivos: string[];
}
