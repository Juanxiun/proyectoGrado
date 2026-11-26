import { NotificationService } from "../notification.service.ts";
import {
  numero,
  resolverEstudianteOUsuario,
  resolverUsuarioOSub,
  ROLES_DOCENTES,
  ROLES_GESTION,
  texto,
  type ReglaNotificacion,
} from "./types.ts";

// reglas -> catalogo declarativo de eventos de dominio
export const REGLAS: ReglaNotificacion[] = [
  {
    evento: "materiales.create",
    tipo: "material",
    canal: "academico",
    prioridad: "media",
    titulo: () => "Nuevo material de clase",
    mensaje: (p) => `Se subió material de clase: ${texto(p.titulo, "Material académico")}`,
    audiencia: "curso",
    asignacion: (p) => numero(p.asignacionId),
    cursoPeriodo: (p) => numero(p.cursoPeriodoId),
  },
  {
    evento: "encargos.create",
    tipo: "actividad",
    canal: "academico",
    prioridad: "alta",
    titulo: (p) => texto(p.titulo, "Nueva actividad"),
    mensaje: (p) => {
      const limite = texto(p.fechaLimite);
      return `Se asignó una actividad: ${texto(p.titulo, "Nueva actividad")}` +
        (limite ? ` (entrega: ${limite.replace("T", " ").slice(0, 16)})` : "");
    },
    audiencia: "curso",
    asignacion: (p) => numero(p.asignacionId),
    cursoPeriodo: (p) => numero(p.cursoPeriodoId),
  },
  {
    evento: "encargos.update",
    tipo: "actividad",
    canal: "academico",
    prioridad: "media",
    titulo: (p) => texto(p.titulo, "Actividad actualizada"),
    mensaje: (p) => `Se actualizó la actividad: ${texto(p.titulo, "Actividad")}`,
    audiencia: "curso",
    asignacion: (p) => numero(p.asignacionId),
    cursoPeriodo: (p) => numero(p.cursoPeriodoId),
  },
  {
    evento: "entregas.create",
    tipo: "entrega",
    canal: "academico",
    prioridad: "media",
    titulo: () => "Nueva entrega registrada",
    mensaje: (p) => `Se registró una entrega de ${texto(p.estudianteNombre, "un estudiante")}`,
    audiencia: "usuario",
    usuarios: async (p) => {
      const asignacionId = numero(p.asignacionId);
      if (asignacionId) return NotificationService.resolveAsignacionDocentes(asignacionId);
      const encargoId = numero(p.encargoId);
      return encargoId ? NotificationService.resolveEncargoDocente(encargoId) : [];
    },
  },
  {
    evento: "calificaciones.create",
    tipo: "calificacion",
    canal: "academico",
    prioridad: "alta",
    titulo: (p) => `Nueva calificación${p.titulo ? `: ${texto(p.titulo)}` : ""}`,
    mensaje: (p) => `Se registró una calificación${p.nota !== undefined ? ` de ${texto(p.nota)}` : ""}`,
    audiencia: "usuario",
    usuarios: resolverEstudianteOUsuario,
  },
  {
    evento: "calificaciones.update",
    tipo: "calificacion",
    canal: "academico",
    prioridad: "alta",
    titulo: (p) => `Calificación actualizada${p.titulo ? `: ${texto(p.titulo)}` : ""}`,
    mensaje: (p) => `Se actualizó una calificación${p.nota !== undefined ? ` a ${texto(p.nota)}` : ""}`,
    audiencia: "usuario",
    usuarios: resolverEstudianteOUsuario,
  },
  {
    evento: "asistencia.bulk",
    tipo: "asistencia",
    canal: "academico",
    prioridad: "baja",
    titulo: () => "Asistencia registrada",
    mensaje: () => "Se registró la asistencia de hoy",
    audiencia: "curso",
    asignacion: (p) => numero(p.asignacionId),
    cursoPeriodo: (p) => numero(p.cursoPeriodoId),
  },
  {
    evento: "materias.create",
    tipo: "materia",
    canal: "academico",
    prioridad: "media",
    titulo: () => "Nueva materia registrada",
    mensaje: (p) => `Se creó la materia ${texto(p.nombre, "sin nombre")}`,
    audiencia: "rol",
    roles: [...ROLES_GESTION],
  },
  {
    evento: "materias.update",
    tipo: "materia",
    canal: "academico",
    prioridad: "baja",
    titulo: () => "Materia actualizada",
    mensaje: (p) => `Se actualizó la materia ${texto(p.nombre, "sin nombre")}`,
    audiencia: "rol",
    roles: [...ROLES_GESTION],
  },
  {
    evento: "materias.delete",
    tipo: "materia",
    canal: "academico",
    prioridad: "alta",
    titulo: () => "Materia eliminada",
    mensaje: (p) => `Se eliminó la materia ${texto(p.nombre, "sin nombre")}`,
    audiencia: "rol",
    roles: [...ROLES_GESTION],
  },
  {
    evento: "cursos.create",
    tipo: "curso",
    canal: "academico",
    prioridad: "media",
    titulo: () => "Nuevo curso creado",
    mensaje: (p) => `Se creó el curso ${texto(p.grado, "")} "${texto(p.paralelo, "")}"`.trim(),
    audiencia: "rol",
    roles: [...ROLES_GESTION],
  },
  {
    evento: "grados.materias",
    tipo: "materia",
    canal: "academico",
    prioridad: "media",
    titulo: (p) => `Materias de ${texto(p.grado, "un grado")} actualizadas`,
    mensaje: (p) => {
      const total = texto(p.totalMaterias, "");
      return `Se actualizaron las materias de ${texto(p.grado, "un grado")}${total ? ` (${total} en total)` : ""}`;
    },
    audiencia: "rol",
    roles: [...ROLES_GESTION],
  },
  {
    evento: "malla.tema.guardar",
    tipo: "maya",
    canal: "academico",
    prioridad: "media",
    titulo: (p) => `Maya curricular actualizada: ${texto(p.materiaNombre, "materia")}`,
    mensaje: (p) => {
      const total = texto(p.totalTemas, "");
      const grado = texto(p.grado, "un grado");
      return `Se actualizó el temario de ${texto(p.materiaNombre, "una materia")} en ${grado}${total ? ` (${total} temas)` : ""}`;
    },
    audiencia: "rol",
    roles: [...ROLES_GESTION, ...ROLES_DOCENTES, "estudiante", "alumno", "padre", "apoderado"],
  },
  {
    evento: "horarios.create",
    tipo: "horario",
    canal: "horarios",
    prioridad: "alta",
    titulo: () => "Nuevo horario asignado",
    mensaje: (p) => {
      const total = texto(p.totalHorarios, "");
      return total
        ? `Se publicaron ${total} bloque(s) de horario para tu curso`
        : "Se publicó un nuevo horario para tu curso";
    },
    audiencia: "curso",
    cursoPeriodo: (p) => numero(p.cursoPeriodoId),
    cursosDelPeriodo: (p) => numero(p.periodoId),
  },
  {
    evento: "horarios.update",
    tipo: "horario",
    canal: "horarios",
    prioridad: "critica",
    titulo: (p) => `Horario modificado: ${texto(p.materiaNombre, "materia")}`,
    mensaje: () => "Se modificó un horario del curso",
    audiencia: "curso",
    cursoPeriodo: (p) => numero(p.cursoPeriodoId),
  },
  {
    evento: "horarios.delete",
    tipo: "horario",
    canal: "horarios",
    prioridad: "critica",
    titulo: (p) => `Horario eliminado: ${texto(p.materiaNombre, "materia")}`,
    mensaje: () => "Se eliminó un horario del curso",
    audiencia: "curso",
    cursoPeriodo: (p) => numero(p.cursoPeriodoId),
  },
  {
    evento: "periodos.activar",
    tipo: "periodo",
    canal: "sistema",
    prioridad: "critica",
    titulo: () => "Período académico activado",
    mensaje: (p) => `Comenzó el período ${texto(p.nombre, "académico")}`,
    audiencia: "todos",
  },
  {
    evento: "aulas.create",
    tipo: "aula",
    canal: "academico",
    prioridad: "baja",
    titulo: () => "Nueva aula registrada",
    mensaje: (p) => `Se creó el aula ${texto(p.codigo, texto(p.nombre, "sin código"))}`,
    audiencia: "rol",
    roles: [...ROLES_GESTION],
  },
  {
    evento: "inscripciones.create",
    tipo: "inscripcion",
    canal: "academico",
    prioridad: "alta",
    titulo: () => "Inscripción registrada",
    mensaje: (p) => `Se registró tu inscripción en ${texto(p.cursoParalelo, "un curso")}`,
    audiencia: "usuario",
    usuarios: resolverEstudianteOUsuario,
  },
  {
    evento: "inscripciones.retirar",
    tipo: "inscripcion",
    canal: "academico",
    prioridad: "alta",
    titulo: () => "Inscripción retirada",
    mensaje: (p) => `Se retiró tu inscripción de ${texto(p.cursoParalelo, "un curso")}`,
    audiencia: "usuario",
    usuarios: resolverEstudianteOUsuario,
  },
  {
    evento: "solicitudes.create",
    tipo: "solicitud",
    canal: "academico",
    prioridad: "media",
    titulo: () => "Nueva solicitud de inscripción",
    mensaje: (p) => `Se registró una solicitud de ${texto(p.tipo, "inscripción")}`,
    audiencia: "rol",
    roles: [...ROLES_GESTION],
  },
  {
    evento: "asignaciones.create",
    tipo: "asignacion",
    canal: "academico",
    prioridad: "media",
    titulo: () => "Asignación docente registrada",
    mensaje: (p) => `Se te asignó la materia ${texto(p.materiaNombre, "sin nombre")}`,
    audiencia: "usuario",
    usuarios: async (p) => {
      const maestroUsuarioId = numero(p.maestroUsuarioId);
      if (maestroUsuarioId) return [maestroUsuarioId];
      const asignacionId = numero(p.asignacionId);
      return asignacionId ? NotificationService.resolveAsignacionDocentes(asignacionId) : [];
    },
  },
  {
    evento: "seguimiento.riesgo",
    tipo: "desempeno",
    canal: "academico",
    prioridad: "alta",
    titulo: (p) => `${p.nivelRiesgo === "observacion" ? "Seguimiento académico" : "Alerta de desempeño"}: ${texto(p.nombre, "estudiante")}`,
    mensaje: (p) => {
      const partes: string[] = [];
      if (p.promedio != null) partes.push(`promedio ${texto(p.promedio)}`);
      if (p.asistencia != null) partes.push(`asistencia ${texto(p.asistencia)}%`);
      const detalle = partes.length > 0 ? ` (${partes.join(", ")})` : "";
      const materia = texto(p.materia, "");
      const estado = p.nivelRiesgo === "observacion"
        ? "requiere observación"
        : p.nivelRiesgo === "riesgo_alto"
        ? "presenta riesgo alto de pérdida de año"
        : "presenta riesgo académico";
      const cierre = p.promedio == null
        ? ". Aún no cuenta con promedio registrado; revisar sus evaluaciones"
        : ". Revisar su avance y brindarle apoyo oportuno";
      return `${texto(p.nombre, "El estudiante")} ${estado}${materia ? ` en ${materia}` : ""}${detalle}${cierre}.`;
    },
    audiencia: "usuario",
    usuarios: async (p) => {
      const estudianteId = numero(p.estudianteId);
      const periodoId = numero(p.periodoId);
      const [docentes, gestion] = await Promise.all([
        estudianteId && periodoId
          ? NotificationService.resolveEstudianteDocentes(estudianteId, periodoId)
          : Promise.resolve([]),
        NotificationService.resolveUsuariosPorRol([...ROLES_GESTION]),
      ]);
      return [...new Set([...docentes, ...gestion])];
    },
  },
  {
    evento: "seguimiento.riesgo-estudiante",
    tipo: "desempeno",
    canal: "academico",
    prioridad: "critica",
    titulo: () => "Tu desempeño académico requiere atención",
    mensaje: (p) => {
      const partes: string[] = [];
      if (p.promedio != null) partes.push(`tu promedio es ${texto(p.promedio)}`);
      if (p.asistencia != null) partes.push(`tu asistencia es ${texto(p.asistencia)}%`);
      const detalle = partes.length > 0 ? `; ${partes.join(", ")}` : "";
      if (p.nivelRiesgo === "observacion") {
        return p.promedio == null
          ? "Aún no tienes un promedio registrado en este período. Consulta con tu maestro para revisar tus evaluaciones y recibir apoyo."
          : `Tu rendimiento necesita seguimiento${detalle}. Conversa con tu maestro para acordar cómo mejorar.`;
      }
      const estado = p.nivelRiesgo === "riesgo_alto"
        ? "Estás en riesgo alto de perder el año"
        : "Estás en riesgo académico";
      return `${estado}${detalle}. Habla con tu maestro para recibir apoyo y mejorar tu rendimiento.`;
    },
    audiencia: "usuario",
    usuarios: resolverEstudianteOUsuario,
  },
  {
    evento: "usuarios.create",
    tipo: "usuario",
    canal: "usuarios",
    prioridad: "media",
    titulo: () => "Nuevo usuario creado",
    mensaje: (p) => `Se creó el usuario ${texto(p.nombre, "")} ${texto(p.apellido, "")}`.trim(),
    audiencia: "rol",
    roles: [...ROLES_GESTION],
  },
  {
    evento: "usuarios.baja",
    tipo: "usuario",
    canal: "usuarios",
    prioridad: "alta",
    titulo: () => "Usuario dado de baja",
    mensaje: (p) => `Se dio de baja a ${texto(p.nombre, "")} ${texto(p.apellido, "")}`.trim(),
    audiencia: "rol",
    roles: [...ROLES_GESTION],
  },
  {
    evento: "usuarios.password",
    tipo: "seguridad",
    canal: "usuarios",
    prioridad: "critica",
    titulo: () => "Tu contraseña fue actualizada",
    mensaje: () => "Se cambió la contraseña de tu cuenta. Si no fuiste tú, avisa a control.",
    audiencia: "usuario",
    usuarios: resolverUsuarioOSub,
  },
  {
    evento: "usuarios.2fa",
    tipo: "seguridad",
    canal: "usuarios",
    prioridad: "critica",
    titulo: () => "Verificación en dos pasos activada",
    mensaje: () => "Se activó la verificación en dos pasos de tu cuenta.",
    audiencia: "usuario",
    usuarios: resolverUsuarioOSub,
  },
  {
    evento: "content.processed",
    tipo: "material",
    canal: "academico",
    prioridad: "media",
    titulo: (p) => `Material listo: ${texto(p.title, "Material académico")}`,
    mensaje: (p) => `El contenido "${texto(p.title, "tu material")}" ya está listo. Revisa el resumen y las actividades generadas.`,
    audiencia: "usuario",
    usuarios: async (p) => {
      const teacherId = numero(p.teacher_id);
      return teacherId ? [teacherId] : [];
    },
  },
  {
    evento: "content.processing",
    tipo: "material",
    canal: "academico",
    prioridad: "media",
    titulo: (p) => `Preparando material: ${texto(p.title, "Material académico")}`,
    mensaje: (p) => `El documento "${texto(p.title, "tu material")}" se está preparando. Tiempo estimado: ${texto(p.estimated_minutes, "3")} minutos.`,
    audiencia: "usuario",
    usuarios: async (p) => {
      const teacherId = numero(p.teacher_id);
      return teacherId ? [teacherId] : [];
    },
  },
  {
    evento: "content.processed.students",
    tipo: "material",
    canal: "academico",
    prioridad: "media",
    titulo: (p) => `Contenido listo: ${texto(p.title, "Material de estudio")}`,
    mensaje: (p) => `El contenido "${texto(p.title, "tu tema")}" ya está disponible. Revisa el resumen y resuelve las actividades.`,
    audiencia: "curso",
    asignacion: (p) => numero(p.assignment_id),
    cursoPeriodo: (p) => numero(p.cursoPeriodoId),
  },
  {
    evento: "evaluacion.trimestral.lista",
    tipo: "evaluacion",
    canal: "academico",
    prioridad: "alta",
    titulo: (p) => `Evaluación trimestral lista: ${texto(p.titulo, "Prueba Trimestral")}`,
    mensaje: (p) => `Tu prueba trimestral "${texto(p.titulo, "Evaluación Trimestral")}" ya fue generada y está lista para revisión y aprobación.`,
    audiencia: "usuario",
    usuarios: async (p) => {
      const usuarioId = numero(p.usuarioId ?? p.teacher_id);
      return usuarioId ? [usuarioId] : [];
    },
  },
];
