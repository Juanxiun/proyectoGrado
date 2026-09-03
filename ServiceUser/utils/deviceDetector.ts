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

export function extractDeviceInfo(ctx: Context, overrideUserAgent?: string): DeviceInfo {
  const rawUserAgent = overrideUserAgent || ctx.request.headers.get("user-agent") || "Desconocido";
  
  // Extraer IP de cabeceras de proxy o conexión
  const forwardedFor = ctx.request.headers.get("x-forwarded-for");
  const realIp = ctx.request.headers.get("x-real-ip");
  const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : (realIp || ctx.request.ip || "127.0.0.1");

  // deno-lint-ignore no-explicit-any
  const parser = new (UAParser as any)(rawUserAgent);
  const result = parser.getResult();

  const browserName = result.browser.name ? `${result.browser.name} ${result.browser.version ?? ""}`.trim() : "Navegador Desconocido";
  const osName = result.os.name ? `${result.os.name} ${result.os.version ?? ""}`.trim() : "SO Desconocido";
  const deviceType = result.device.type ? `${result.device.type} ${result.device.vendor ?? ""} ${result.device.model ?? ""}`.trim() : (rawUserAgent.includes("Mobile") ? "Móvil" : "Escritorio / PC");

  return {
    browser: browserName,
    os: osName,
    device: deviceType,
    rawUserAgent,
    ip: clientIp,
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

  const lat = body?.lat ?? body?.ubicacion?.lat ?? (headerLat ? parseFloat(headerLat) : undefined);
  const lon = body?.lon ?? body?.ubicacion?.lon ?? (headerLon ? parseFloat(headerLon) : undefined);
  const zona = body?.zona ?? body?.ubicacion?.zona ?? headerZona ?? undefined;
  const ciudad = body?.ciudad ?? body?.ubicacion?.ciudad ?? headerCiudad ?? undefined;
  const pais = body?.pais ?? body?.ubicacion?.pais ?? headerPais ?? undefined;

  return {
    lat: isNaN(lat) ? undefined : lat,
    lon: isNaN(lon) ? undefined : lon,
    zona,
    ciudad,
    pais,
  };
}
