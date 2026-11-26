// tipos -> cursos, materias, grados y malla curricular
import type {
  NivelEducativo,
  TipoMateria,
  TipoSolicitudInscripcion,
} from "./common.ts";

export interface Curso {
  id: string;
  nivel: NivelEducativo;
  grado: string;
  paralelo: string;
  capacidadMaxima: number;
  activo: boolean;
  caratulaUrl?: string | null;
  // campo -> total materias aviso cero
  totalMaterias: number;
}

// tipo -> materia asignada grado
export interface MateriaDelGrado {
  materiaId: string;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  pesoSintactico: number;
  tipoMateria: TipoMateria;
  cargaHorariaSemanal: number;
  orden: number;
}

export interface AsignarMateriaGradoInput {
  materiaId: string | number;
  tipoMateria?: TipoMateria;
  cargaHorariaSemanal?: number;
}

// tipo -> grado con paralelos
export interface GradoConParalelos {
  nivel: NivelEducativo;
  grado: string;
  paralelos: string[];
  totalMaterias: number;
}

export interface GradoSinMaterias {
  nivel: NivelEducativo;
  grado: string;
  paralelos: string[];
}

// modelos -> temas malla curricular
export interface TemaMalla {
  id: string;
  nivel: NivelEducativo;
  grado: string;
  materiaId: string;
  materia?: { codigo: string; nombre: string; tipoMateria: TipoMateria };
  unidad: number;
  titulo: string;
  contenidos?: string | null;
  horasPrevistas: number;
  esEvaluacion: boolean;
  orden: number;
}

export interface CrearTemaInput {
  materiaId: string | number;
  titulo: string;
  contenidos?: string | null;
  horasPrevistas?: number;
  esEvaluacion?: boolean;
  unidad?: number;
}

export interface CreateCursoInput {
  nivel: NivelEducativo;
  grado: string;
  paralelo: string;
  capacidadMaxima?: number;
  activo?: boolean;
  caratulaUrl?: string | null;
}

export type UpdateCursoInput = Partial<CreateCursoInput>;

export interface Materia {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  tipoMateria: TipoMateria;
  cargaHorariaSemanal: number;
  pesoSintactico: number;
  materiaPesada: boolean;
  activo: boolean;
  caratulaUrl?: string | null;
  fechaCreacion?: string;
  fechaActualizacion?: string;
}

export interface CreateMateriaInput {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  tipoMateria?: TipoMateria;
  cargaHorariaSemanal?: number;
  pesoSintactico?: number;
  materiaPesada?: boolean;
  activo?: boolean;
  caratulaUrl?: string | null;
}

export type UpdateMateriaInput = Partial<CreateMateriaInput>;

export interface SolicitudInscripcion {
  id: string;
  estudianteId: string;
  periodoId: string;
  cursoPeriodoDestinoId: string;
  tipo: TipoSolicitudInscripcion;
  estado: "pendiente" | "aprobada" | "rechazada";
  motivo?: string | null;
  fechaSolicitud: string;
  fechaProceso?: string | null;
  observacion?: string | null;
}
