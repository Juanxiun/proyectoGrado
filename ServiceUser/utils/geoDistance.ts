import { LocationInfo } from "./deviceDetector.ts";

/**
 * Calcula la distancia en kilómetros entre dos coordenadas usando la fórmula de Haversine.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Radio de la Tierra en km
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

/**
 * Evalúa si un nuevo inicio de sesión de estudiante presenta discrepancias geográficas
 * sospechosas o indicios de trampa (compartir cuenta, proxies, viajes imposibles).
 */
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

    // Caso 1: Coordenadas GPS / geográficas disponibles en ambas sesiones
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

      // Si la distancia es mayor a 25 km y la velocidad de desplazamiento es físicamente inverosímil (>150 km/h)
      // o si la distancia simultánea es grande (>30 km)
      if (distanceKm > 25 && (speedKmH > 120 || distanceKm > 50 || diffHours < 0.2)) {
        return {
          posibleTrampa: true,
          distanciaKm: Number(distanceKm.toFixed(2)),
          sesionComparadaId: prev.sessionId,
          alertaMensaje: `Posible trampa detectada: Inicio de sesión a ${distanceKm.toFixed(1)} km de distancia de otra sesión registrada (${currentLocation.zona || currentLocation.ciudad || 'Ubicación actual'} vs ${prevLoc.zona || prevLoc.ciudad || 'Ubicación previa'}). Velocidad estimada: ${speedKmH.toFixed(0)} km/h.`,
        };
      }
    }

    // Caso 2: Comparación por zona o ciudad si no hay coordenadas exactas
    const currentZone = (currentLocation.zona || currentLocation.ciudad || "").toLowerCase().trim();
    const prevZone = (prevLoc.zona || prevLoc.ciudad || "").toLowerCase().trim();

    if (currentZone && prevZone && currentZone !== prevZone) {
      const prevTime = new Date(prev.inicioConexion);
      const diffMinutes = (currentTime.getTime() - prevTime.getTime()) / (1000 * 60);

      // Si inició sesión en zonas/ciudades distintas en menos de 30 minutos
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
