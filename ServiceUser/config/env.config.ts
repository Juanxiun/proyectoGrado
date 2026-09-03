import { loadSync } from "@std/dotenv";

try {
  const envUrl = new URL("../.env", import.meta.url);
  let envPath = decodeURIComponent(envUrl.pathname);
  if (Deno.build.os === "windows" && envPath.startsWith("/")) {
    envPath = envPath.substring(1);
  }

  loadSync({
    envPath,
    export: true,
  });
} catch (e) {
  console.warn("[env.config] Advertencia cargando .env:", (e as Error)?.message);
}
