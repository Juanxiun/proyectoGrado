import { createSubscriber } from "../connects/Redis/redis.ts";
import { notificationConfig } from "../config/notification.config.ts";
import { procesarEvento } from "./reglas.service.ts";
import { reevaluar } from "./riesgo.service.ts";
import type { DomainEvent } from "../models/notification.ts";

/**
 * Eventos que, además de notificar, disparan una reevaluación del desempeño
 * del estudiante afectado.
 */
const EVENTOS_REVALUAN = new Set([
  "calificaciones.create",
  "calificaciones.update",
  "calificaciones.bulk",
  "asistencia.bulk",
]);

// deno-lint-ignore no-explicit-any
let subscriber: any = null;
let conectado = false;
let reintentoEnCurso = false;

const CANAL = notificationConfig.eventosCanal;

function programarReintento(): void {
  if (reintentoEnCurso) return;
  reintentoEnCurso = true;
  setTimeout(() => {
    reintentoEnCurso = false;
    iniciarBusEventos().catch((err) => {
      console.error("[EventBus] No se pudo reintentar la suscripción:", err);
    });
  }, 5000);
}

/**
 * Suscribe el servicio al canal de eventos de dominio. Todos los servicios
 * publican ahí sus cambios (materias, horarios, inscripciones, usuarios…) y
 * este servicio es el único que decide a quién notifica.
 */
export async function iniciarBusEventos(): Promise<void> {
  if (conectado) return;

  try {
    subscriber = await createSubscriber();
  } catch (err) {
    console.error("[EventBus] No se pudo abrir la conexión de suscripción:", err);
    programarReintento();
    return;
  }

  subscriber.on("message", async (_canal: string, mensaje: string) => {
    let evento: DomainEvent;
    try {
      evento = JSON.parse(mensaje) as DomainEvent;
    } catch {
      console.warn("[EventBus] Evento con JSON inválido, se ignora");
      return;
    }

    if (!evento?.eventType) return;

    try {
      await procesarEvento(evento);
    } catch (err) {
      console.error(`[EventBus] Error procesando ${evento.eventType}:`, err);
    }

    // El seguimiento se recalcula después de resolver la notificación, para
    // que una reevaluación lenta no retarde el aviso del evento original.
    if (EVENTOS_REVALUAN.has(evento.eventType)) {
      try {
        await reevaluar((evento.payload ?? {}) as Record<string, unknown>);
      } catch (err) {
        console.error(`[EventBus] Error reevaluando riesgo en ${evento.eventType}:`, err);
      }
    }
  });

  subscriber.on("error", (err: Error) => {
    console.warn(`[EventBus/Suscriptor] ${err?.message ?? err}`);
  });

  subscriber.on("end", () => {
    conectado = false;
    console.warn("[EventBus] Suscripción cerrada, se reintentará");
    programarReintento();
  });

  await subscriber.subscribe(CANAL);
  conectado = true;
  console.log(`[EventBus] Suscrito al canal "${CANAL}"`);
}

export function estadoBusEventos(): { canal: string; conectado: boolean } {
  return { canal: CANAL, conectado };
}
