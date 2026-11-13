import { Context } from "@oak/oak";
import { UAParser } from "ua-parser-js";

export interface DeviceInfo {
  browser: string;
  os: string;
  device: string;
  rawUserAgent: string;
  ip: string;
}

export interface LocationInfo {
  lat?: number;
  lon?: number;
  zona?: string;
  ciudad?: string;
  pais?: string;
}

function textoValido(value: unknown, maximo = 160): string | undefined {
  if (typeof value !== "string") return undefined;
  const texto = value.trim().slice(0, maximo);
  return texto.length > 0 ? texto : undefined;
}

function coordenadaValida(value: unknown, minimo: number, maximo: number): number | undefined {
  const numero = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(numero) && numero >= minimo && numero <= maximo ? numero : undefined;
}

// ubicacion -> validar datos recibidos
export function normalizarUbicacion(value: unknown): LocationInfo | undefined {
  if (!value || typeof value !== "object") return undefined;
  const ubicacion = value as Record<string, unknown>;
  let lat = coordenadaValida(ubicacion.lat, -90, 90);
  let lon = coordenadaValida(ubicacion.lon, -180, 180);
  if (lat === undefined || lon === undefined) {
    lat = undefined;
    lon = undefined;
  }
  const resultado: LocationInfo = {
    lat,
    lon,
    zona: textoValido(ubicacion.zona),
    ciudad: textoValido(ubicacion.ciudad),
    pais: textoValido(ubicacion.pais),
  };
  return Object.values(resultado).some((item) => item !== undefined) ? resultado : undefined;
}

// dispositivo -> validar datos recibidos
export function normalizarDispositivo(value: unknown, fallback?: DeviceInfo): DeviceInfo {
  const dispositivo = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    browser: textoValido(dispositivo.browser, 120) ?? fallback?.browser ?? "Navegador desconocido",
    os: textoValido(dispositivo.os, 120) ?? fallback?.os ?? "Sistema desconocido",
    device: textoValido(dispositivo.device, 120) ?? fallback?.device ?? "Dispositivo desconocido",
    rawUserAgent: textoValido(dispositivo.rawUserAgent, 512) ?? fallback?.rawUserAgent ?? "Desconocido",
    ip: textoValido(dispositivo.ip, 64) ?? fallback?.ip ?? "No disponible",
  };
}

export function extractDeviceInfo(ctx: Context, overrideUserAgent?: string, metadata?: Record<string, unknown>): DeviceInfo {
  const rawUserAgent = overrideUserAgent || ctx.request.headers.get("user-agent") || "Desconocido";
  
  // util -> extraer ip proxy
  const forwardedFor = ctx.request.headers.get("x-forwarded-for");
  const realIp = ctx.request.headers.get("x-real-ip");
  const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : (realIp || ctx.request.ip || "127.0.0.1");

  // deno-lint-ignore no-explicit-any
  const parser = new (UAParser as any)(rawUserAgent);
  const result = parser.getResult();

  const browserName = result.browser.name ? `${result.browser.name} ${result.browser.version ?? ""}`.trim() : "Navegador Desconocido";
  const osName = result.os.name ? `${result.os.name} ${result.os.version ?? ""}`.trim() : "SO Desconocido";
  const deviceType = /android/i.test(rawUserAgent)
    ? `Android${result.device.model ? ` ${result.device.model}` : ""}`
    : result.device.type ? `${result.device.type} ${result.device.vendor ?? ""} ${result.device.model ?? ""}`.trim() : (rawUserAgent.includes("Mobile") ? "Móvil" : "Escritorio / PC");

  return {
    browser: textoValido(metadata?.browser, 120) ?? browserName,
    os: textoValido(metadata?.os, 120) ?? osName,
    device: textoValido(metadata?.device, 120) ?? deviceType,
    rawUserAgent,
    ip: textoValido(clientIp, 64) ?? "No disponible",
  };
}

export function extractLocationInfo(
  ctx: Context,
  // deno-lint-ignore no-explicit-any
  body?: Record<string, any>,
): LocationInfo {
  const headerLat = ctx.request.headers.get("x-latitude");
  const headerLon = ctx.request.headers.get("x-longitude");
  const headerZona = ctx.request.headers.get("x-zona");
  const headerCiudad = ctx.request.headers.get("x-ciudad");
  const headerPais = ctx.request.headers.get("x-pais");

  return normalizarUbicacion({
    lat: body?.lat ?? body?.ubicacion?.lat ?? headerLat,
    lon: body?.lon ?? body?.ubicacion?.lon ?? headerLon,
    zona: body?.zona ?? body?.ubicacion?.zona ?? headerZona,
    ciudad: body?.ciudad ?? body?.ubicacion?.ciudad ?? headerCiudad,
    pais: body?.pais ?? body?.ubicacion?.pais ?? headerPais,
  }) ?? {};
}
