import { NotificationService } from "./notification.service.ts";
import { broadcastNotification } from "./gateway.service.ts";
import type {
  DomainEvent,
  NotificationAudience,
  NotificationChannel,
  NotificationDraft,
  NotificationPriority,
} from "../models/notification.ts";

/**
 * Catálogo central de reglas: es el ÚNICO lugar donde se decide qué evento del
 * sistema genera una notificación, a quién le llega y con qué texto.
 *
 * Para agregar una notificación nueva basta con añadir una entrada aquí; el
 * servicio que origina el evento sólo publica en el canal de Redis.
 */
interface ReglaNotificacion {
  evento: string;
  tipo: string;
  canal: NotificationChannel;
  prioridad: NotificationPriority;
  titulo: (payload: Record<string, unknown>) => string;
  mensaje: (payload: Record<string, unknown>) => string;
  audiencia: NotificationAudience;
  /** Ids de usuarios destino cuando la audiencia es "usuario". */
  usuarios?: (payload: Record<string, unknown>) => Promise<string[]>;
  /** Curso-periodo a notificar cuando la audiencia es "curso". */
  cursoPeriodo?: (payload: Record<string, unknown>) => string | undefined;
  /**
   * Período académico: si el evento no identifica un curso concreto, se
   * notifican todos los cursos del período que tengan horario activo.
   */
  cursosDelPeriodo?: (payload: Record<string, unknown>) => string | undefined;
  /** Asignación docente usada para resolver materia/docente/curso. */
  asignacion?: (payload: Record<string, unknown>) => string | undefined;
  /** Roles de la tabla `roles` cuando la audiencia es "rol". */
  roles?: string[];
}

/** Roles de administración: avisos de gestión académica y de usuarios. */
const ROLES_GESTION = [
  "director",
  "control",
  "gerencia",
  "administrador",
  "administrativo",
  "secretaria",
  "secretario",
  "editor",
];

const ROLES_DOCENTES = ["profesor", "maestro", "maestros", "docente"];

function texto(value: unknown, porDefecto = ""): string {
  const s = String(value ?? "").trim();
  return s || porDefecto;
}

function numero(value: unknown): string | undefined {
  const s = String(value ?? "").trim();
  return s ? s : undefined;
}

async function construirCurso(
  payload: Record<string, unknown>,
  fallbackAsignacion?: string,
): Promise<string | undefined> {
  const explicito = numero(payload.cursoPeriodoId);
  if (explicito) return explicito;
  if (fallbackAsignacion) {
    const info = await NotificationService.resolveAsignacion(fallbackAsignacion);
    return info?.cursoPeriodoId;
  }
  return undefined;
}

const REGLAS: ReglaNotificacion[] = [
  // ── ServiceHomework: materiales y encargos ────────────────────────────────
  {
    evento: "materiales.create",
    tipo: "material",
    canal: "academico",
    prioridad: "media",
    titulo: (p) => texto(p.titulo, "Nuevo material académico"),
    mensaje: (p) => `Se publicó un material: ${texto(p.titulo, "Material académico")}`,
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
      if (encargoId) return NotificationService.resolveEncargoDocente(encargoId);
      return [];
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
    usuarios: async (p) => {
      const estudianteId = numero(p.estudianteId);
      if (estudianteId) {
        const uid = await NotificationService.resolveEstudianteUsuario(estudianteId);
        return uid ? [uid] : [];
      }
      const usuarioId = numero(p.usuarioId);
      return usuarioId ? [usuarioId] : [];
    },
  },
  {
    evento: "calificaciones.update",
    tipo: "calificacion",
    canal: "academico",
    prioridad: "alta",
    titulo: (p) => `Calificación actualizada${p.titulo ? `: ${texto(p.titulo)}` : ""}`,
    mensaje: (p) => `Se actualizó una calificación${p.nota !== undefined ? ` a ${texto(p.nota)}` : ""}`,
    audiencia: "usuario",
    usuarios: async (p) => {
      const estudianteId = numero(p.estudianteId);
      if (estudianteId) {
        const uid = await NotificationService.resolveEstudianteUsuario(estudianteId);
        return uid ? [uid] : [];
      }
      const usuarioId = numero(p.usuarioId);
      return usuarioId ? [usuarioId] : [];
    },
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

  // ── ServiceAcademic: materias, cursos, horarios y periodos ────────────────
  {
    evento: "materias.create",
    tipo: "materia",
    canal: "academico",
    prioridad: "media",
    titulo: () => "Nueva materia registrada",
    mensaje: (p) => `Se creó la materia ${texto(p.nombre, "sin nombre")}`,
    audiencia: "rol",
    roles: ROLES_GESTION,
  },
  {
    evento: "materias.update",
    tipo: "materia",
    canal: "academico",
    prioridad: "baja",
    titulo: () => "Materia actualizada",
    mensaje: (p) => `Se actualizó la materia ${texto(p.nombre, "sin nombre")}`,
    audiencia: "rol",
    roles: ROLES_GESTION,
  },
  {
    evento: "materias.delete",
    tipo: "materia",
    canal: "academico",
    prioridad: "alta",
    titulo: () => "Materia eliminada",
    mensaje: (p) => `Se eliminó la materia ${texto(p.nombre, "sin nombre")}`,
    audiencia: "rol",
    roles: ROLES_GESTION,
  },
  {
    evento: "cursos.create",
    tipo: "curso",
    canal: "academico",
    prioridad: "media",
    titulo: () => "Nuevo curso creado",
    mensaje: (p) => `Se creó el curso ${texto(p.grado, "")} "${texto(p.paralelo, "")}"`.trim(),
    audiencia: "rol",
    roles: ROLES_GESTION,
  },
  {
    evento: "grados.materias",
    tipo: "materia",
    canal: "academico",
    prioridad: "media",
    titulo: (p) => `Materias de ${texto(p.grado, "un grado")} actualizadas`,
    mensaje: (p) => {
      const total = texto(p.totalMaterias, "");
      return `Se actualizaron las materias de ${texto(p.grado, "un grado")}` +
        (total ? ` (${total} en total)` : "");
    },
    audiencia: "rol",
    roles: ROLES_GESTION,
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
      const base = `Se actualizó el temario de ${texto(p.materiaNombre, "una materia")}`;
      return `${base} en ${grado}${total ? ` (${total} temas)` : ""}`;
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
    /** Si el evento no trae curso, se notifican todos los del período. */
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
    roles: ROLES_GESTION,
  },

  // ── ServiceEnrollment: inscripciones, solicitudes y asignaciones ──────────
  {
    evento: "inscripciones.create",
    tipo: "inscripcion",
    canal: "academico",
    prioridad: "alta",
    titulo: () => "Inscripción registrada",
    mensaje: (p) => `Se registró tu inscripción en ${texto(p.cursoParalelo, "un curso")}`,
    audiencia: "usuario",
    usuarios: async (p) => {
      const estudianteId = numero(p.estudianteId);
      if (estudianteId) {
        const uid = await NotificationService.resolveEstudianteUsuario(estudianteId);
        return uid ? [uid] : [];
      }
      const usuarioId = numero(p.usuarioId);
      return usuarioId ? [usuarioId] : [];
    },
  },
  {
    evento: "inscripciones.retirar",
    tipo: "inscripcion",
    canal: "academico",
    prioridad: "alta",
    titulo: () => "Inscripción retirada",
    mensaje: (p) => `Se retiró tu inscripción de ${texto(p.cursoParalelo, "un curso")}`,
    audiencia: "usuario",
    usuarios: async (p) => {
      const estudianteId = numero(p.estudianteId);
      if (estudianteId) {
        const uid = await NotificationService.resolveEstudianteUsuario(estudianteId);
        return uid ? [uid] : [];
      }
      const usuarioId = numero(p.usuarioId);
      return usuarioId ? [usuarioId] : [];
    },
  },
  {
    evento: "solicitudes.create",
    tipo: "solicitud",
    canal: "academico",
    prioridad: "media",
    titulo: () => "Nueva solicitud de inscripción",
    mensaje: (p) => `Se registró una solicitud de ${texto(p.tipo, "inscripción")}`,
    audiencia: "rol",
    roles: ROLES_GESTION,
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
      if (asignacionId) return NotificationService.resolveAsignacionDocentes(asignacionId);
      return [];
    },
  },

  // ── ServiceAcademic: seguimiento de desempeño ─────────────────────────────
  // La reevaluación de riesgo se dispara desde el seguimiento académico
  // (ServiceAcademic) y desde cualquier carga de notas o asistencia.
  {
    evento: "seguimiento.riesgo",
    tipo: "desempeno",
    canal: "academico",
    prioridad: "alta",
    titulo: (p) => `Alerta de desempeño: ${texto(p.nombre, "estudiante")}`,
    mensaje: (p) => {
      const partes: string[] = [];
      if (p.promedio !== undefined && p.promedio !== null) {
        partes.push(`promedio ${texto(p.promedio)}`);
      }
      if (p.asistencia !== undefined && p.asistencia !== null) {
        partes.push(`asistencia ${texto(p.asistencia)}%`);
      }
      const detalle = partes.length > 0 ? ` (${partes.join(", ")})` : "";
      const materia = texto(p.materia, "");
      return `Riesgo ${texto(p.nivelRiesgo, "detectado")}${materia ? ` en ${materia}` : ""}${detalle}`;
    },
    audiencia: "rol",
    roles: ROLES_GESTION,
  },
  {
    evento: "seguimiento.riesgo-estudiante",
    tipo: "desempeno",
    canal: "academico",
    prioridad: "critica",
    titulo: (p) => "Tu desempeño académico requiere atención",
    mensaje: (p) => {
      const partes: string[] = [];
      if (p.promedio !== undefined && p.promedio !== null) {
        partes.push(`tu promedio es ${texto(p.promedio)}`);
      }
      if (p.asistencia !== undefined && p.asistencia !== null) {
        partes.push(`tu asistencia es ${texto(p.asistencia)}%`);
      }
      const detalle = partes.length > 0 ? ` y ${partes.join(", ")}` : "";
      return `Varios indicadores están por debajo del mínimo esperado${detalle}. Habla con tu tutor o con control académico.`;
    },
    audiencia: "usuario",
    usuarios: async (p) => {
      const estudianteId = numero(p.estudianteId);
      if (estudianteId) {
        const uid = await NotificationService.resolveEstudianteUsuario(estudianteId);
        return uid ? [uid] : [];
      }
      const usuarioId = numero(p.usuarioId);
      return usuarioId ? [usuarioId] : [];
    },
  },

  // ── ServiceUser: altas, bajas y seguridad ────────────────────────────────
  {
    evento: "usuarios.create",
    tipo: "usuario",
    canal: "usuarios",
    prioridad: "media",
    titulo: () => "Nuevo usuario creado",
    mensaje: (p) => `Se creó el usuario ${texto(p.nombre, "")} ${texto(p.apellido, "")}`.trim(),
    audiencia: "rol",
    roles: ROLES_GESTION,
  },
  {
    evento: "usuarios.baja",
    tipo: "usuario",
    canal: "usuarios",
    prioridad: "alta",
    titulo: () => "Usuario dado de baja",
    mensaje: (p) => `Se dio de baja a ${texto(p.nombre, "")} ${texto(p.apellido, "")}`.trim(),
    audiencia: "rol",
    roles: ROLES_GESTION,
  },
  {
    evento: "usuarios.password",
    tipo: "seguridad",
    canal: "usuarios",
    prioridad: "critica",
    titulo: () => "Tu contraseña fue actualizada",
    mensaje: () => "Se cambió la contraseña de tu cuenta. Si no fuiste tú, avisa a control.",
    audiencia: "usuario",
    usuarios: async (p) => {
      const usuarioId = numero(p.usuarioId) ?? numero(p.sub);
      return usuarioId ? [usuarioId] : [];
    },
  },
  {
    evento: "usuarios.2fa",
    tipo: "seguridad",
    canal: "usuarios",
    prioridad: "critica",
    titulo: () => "Verificación en dos pasos activada",
    mensaje: () => "Se activó la verificación en dos pasos de tu cuenta.",
    audiencia: "usuario",
    usuarios: async (p) => {
      const usuarioId = numero(p.usuarioId) ?? numero(p.sub);
      return usuarioId ? [usuarioId] : [];
    },
  },
];

const INDICE = new Map(REGLAS.map((r) => [r.evento.toLowerCase(), r]));

export function eventosRegistrados(): string[] {
  return REGLAS.map((r) => r.evento);
}

export function tieneRegla(eventType: string): boolean {
  return INDICE.has(String(eventType ?? "").trim().toLowerCase());
}

async function resolverDestinatarios(
  regla: ReglaNotificacion,
  payload: Record<string, unknown>,
): Promise<string[]> {
  switch (regla.audiencia) {
    case "usuario":
      return (await regla.usuarios?.(payload)) ?? [];

    case "rol":
      return NotificationService.resolveUsuariosPorRol(regla.roles ?? []);

    case "curso": {
      const asignacionId = regla.asignacion?.(payload);
      let cursoPeriodoId = (regla.cursoPeriodo?.(payload) ??
        (await construirCurso(payload, asignacionId))) as string | undefined;

      if (cursoPeriodoId) {
        return NotificationService.resolveCursoDocentes(cursoPeriodoId);
      }

      const periodoId = regla.cursosDelPeriodo?.(payload);
      if (!periodoId) return [];

      const cursos = await NotificationService.resolveCursosDelPeriodoConHorarios(periodoId);
      const todos: string[] = [];
      for (const curso of cursos) {
        todos.push(...await NotificationService.resolveCursoDocentes(curso));
      }
      return [...new Set(todos)];
    }

    case "todos":
      return [];

    default:
      return [];
  }
}

/**
 * Punto de entrada del bus de eventos. Traduce un evento de dominio en una
 * notificación y la entrega. Si no hay regla, el evento se ignora en silencio:
 * no es un error, sólo significa que ese cambio no genera aviso.
 */
export async function procesarEvento(evento: DomainEvent): Promise<void> {
  const eventType = String(evento?.eventType ?? "").trim();
  const regla = INDICE.get(eventType.toLowerCase());

  if (!regla) return;

  const payload = (evento.payload ?? {}) as Record<string, unknown>;

  const draft: NotificationDraft = {
    tipo: regla.tipo,
    canal: regla.canal,
    prioridad: regla.prioridad,
    titulo: regla.titulo(payload),
    mensaje: regla.mensaje(payload),
    origen: `${evento.origen || "desconocido"}:${eventType}`,
  };

  // El contexto académico sólo aplica a las reglas de curso/asignación.
  if (regla.audiencia === "curso") {
    const asignacionId = regla.asignacion?.(payload);
    if (asignacionId) {
      const info = await NotificationService.resolveAsignacion(asignacionId);
      if (info) {
        draft.materiaNombre = info.materiaNombre;
        draft.profesorNombre = info.profesorNombre;
        draft.cursoParalelo = info.cursoParalelo;
        draft.cursoPeriodoId = info.cursoPeriodoId;
        draft.asignacionId = asignacionId;
        draft.publicoTexto = regla.tipo === "material" ? "Material académico" : "Actividad nueva";
      }
    }
    const cursoPeriodoId = regla.cursoPeriodo?.(payload);
    if (cursoPeriodoId && !draft.cursoPeriodoId) draft.cursoPeriodoId = cursoPeriodoId;
  }

  if (regla.audiencia === "usuario" && draft.tipo !== "seguridad") {
    const usuarioId = numero(payload.usuarioId) ?? numero(payload.sub);
    if (usuarioId) draft.itemId = usuarioId;
  }

  if (regla.audiencia === "todos") {
    const notif = await NotificationService.sendToAll(draft);
    broadcastNotification(notif);
    console.log(`[Reglas] ${eventType} → difusión a toda la institución`);
    return;
  }

  const destinatarios = await resolverDestinatarios(regla, payload);

  if (destinatarios.length === 0) {
    console.log(`[Reglas] ${eventType} sin destinatarios; no se notifica`);
    return;
  }

  await NotificationService.deliverToUsers(destinatarios, draft);
  console.log(`[Reglas] ${eventType} → ${destinatarios.length} destinatario(s)`);
}