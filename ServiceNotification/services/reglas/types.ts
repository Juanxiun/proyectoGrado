import { NotificationService } from "../notification.service.ts";
import type {
  NotificationAudience,
  NotificationChannel,
  NotificationPriority,
} from "../../models/notification.ts";

// reglas -> definicion de contrato y utilidades compartidas
export interface ReglaNotificacion {
  evento: string;
  tipo: string;
  canal: NotificationChannel;
  prioridad: NotificationPriority;
  titulo: (payload: Record<string, unknown>) => string;
  mensaje: (payload: Record<string, unknown>) => string;
  audiencia: NotificationAudience;
  usuarios?: (payload: Record<string, unknown>) => Promise<string[]>;
  cursoPeriodo?: (payload: Record<string, unknown>) => string | undefined;
  cursosDelPeriodo?: (payload: Record<string, unknown>) => string | undefined;
  asignacion?: (payload: Record<string, unknown>) => string | undefined;
  roles?: string[];
}

export const ROLES_GESTION = [
  "director",
  "control",
  "gerencia",
  "administrador",
  "administrativo",
  "secretaria",
  "secretario",
  "editor",
] as const;

export const ROLES_DOCENTES = ["profesor", "maestro", "maestros", "docente"] as const;

export function texto(value: unknown, porDefecto = ""): string {
  const s = String(value ?? "").trim();
  return s || porDefecto;
}

export function numero(value: unknown): string | undefined {
  const s = String(value ?? "").trim();
  return s || undefined;
}

export async function resolverEstudianteOUsuario(p: Record<string, unknown>): Promise<string[]> {
  const estudianteId = numero(p.estudianteId);
  if (estudianteId) {
    const uid = await NotificationService.resolveEstudianteUsuario(estudianteId);
    return uid ? [uid] : [];
  }
  const usuarioId = numero(p.usuarioId);
  return usuarioId ? [usuarioId] : [];
}

export async function resolverUsuarioOSub(p: Record<string, unknown>): Promise<string[]> {
  const usuarioId = numero(p.usuarioId) ?? numero(p.sub);
  return usuarioId ? [usuarioId] : [];
}

export async function construirCurso(
  payload: Record<string, unknown>,
  fallbackAsignacion?: string,
): Promise<string | undefined> {
  const explicito = numero(payload.cursoPeriodoId);
  if (explicito) return explicito;
  if (!fallbackAsignacion) return undefined;
  const info = await NotificationService.resolveAsignacion(fallbackAsignacion);
  return info?.cursoPeriodoId;
}
