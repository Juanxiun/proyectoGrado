import { LocationInfo } from "./deviceDetector.ts";

// util -> distancia haversine
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface AntiCheatResult {
  posibleTrampa: boolean;
  distanciaKm?: number;
  alertaMensaje?: string;
  sesionComparadaId?: string;
}

export interface PreviousSessionGeo {
  sessionId: string;
  ubicacion?: LocationInfo;
  inicioConexion: string;
  dispositivo: {
    browser?: string;
    os?: string;
    device?: string;
    ip?: string;
  };
}

// funcion -> detectar trampa geografica
export function evaluateStudentDistanceCheating(
  currentLocation: LocationInfo,
  activeOrRecentSessions: PreviousSessionGeo[],
  currentTime = new Date(),
): AntiCheatResult {
  if (!activeOrRecentSessions || activeOrRecentSessions.length === 0) {
    return { posibleTrampa: false };
  }

  for (const prev of activeOrRecentSessions) {
    const prevLoc = prev.ubicacion;
    if (!prevLoc) continue;

    if (
      currentLocation.lat !== undefined &&
      currentLocation.lon !== undefined &&
      prevLoc.lat !== undefined &&
      prevLoc.lon !== undefined
    ) {
      const distanceKm = calculateHaversineDistanceKm(
        currentLocation.lat,
        currentLocation.lon,
        prevLoc.lat,
        prevLoc.lon,
      );

      const prevTime = new Date(prev.inicioConexion);
      const diffHours = Math.max(0.01, (currentTime.getTime() - prevTime.getTime()) / (1000 * 60 * 60));
      const speedKmH = distanceKm / diffHours;

      if (distanceKm > 25 && (speedKmH > 120 || distanceKm > 50 || diffHours < 0.2)) {
        return {
          posibleTrampa: true,
          distanciaKm: Number(distanceKm.toFixed(2)),
          sesionComparadaId: prev.sessionId,
          alertaMensaje: `Posible trampa detectada: Inicio de sesión a ${distanceKm.toFixed(1)} km de distancia de otra sesión registrada (${currentLocation.zona || currentLocation.ciudad || 'Ubicación actual'} vs ${prevLoc.zona || prevLoc.ciudad || 'Ubicación previa'}). Velocidad estimada: ${speedKmH.toFixed(0)} km/h.`,
        };
      }
    }

    const currentZone = (currentLocation.zona || currentLocation.ciudad || "").toLowerCase().trim();
    const prevZone = (prevLoc.zona || prevLoc.ciudad || "").toLowerCase().trim();

    if (currentZone && prevZone && currentZone !== prevZone) {
      const prevTime = new Date(prev.inicioConexion);
      const diffMinutes = (currentTime.getTime() - prevTime.getTime()) / (1000 * 60);

      if (diffMinutes < 30) {
        return {
          posibleTrampa: true,
          sesionComparadaId: prev.sessionId,
          alertaMensaje: `Posible trampa detectada: Inicios de sesión simultáneos o muy cercanos en el tiempo desde zonas distintas (${currentZone} vs ${prevZone}) en menos de ${Math.round(diffMinutes)} minutos.`,
        };
      }
    }
  }

  return { posibleTrampa: false };
}
