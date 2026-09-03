import { Context } from "@oak/oak";

/**
 * Lee multipart/form-data de forma robusta en Deno y Oak 17+.
 * 1) Intenta ctx.request.body.formData() (parser nativo de Oak/Deno sobre stream)
 * 2) Intenta originalRequest.request.formData() (Request web original)
 * 3) Fallback reconstruyendo un Request POST sobre el ArrayBuffer crudo
 */
export async function readMultipartForm(ctx: Context): Promise<FormData> {
  // 1. Intentar directamente con ctx.request.body.formData() (Oak 17+)
  try {
    const bodyObj = ctx.request.body as any;
    if (bodyObj && typeof bodyObj.formData === "function") {
      const fd = await bodyObj.formData();
      if (fd && typeof fd.get === "function") {
        return fd;
      }
    }
  } catch (err) {
    console.warn("[readMultipartForm] ctx.request.body.formData() falló:", err);
  }

  // 2. Intentar con el Request nativo subyacente de Deno
  try {
    const origReq = (ctx.request as any)?.originalRequest?.request;
    if (origReq && typeof origReq.formData === "function") {
      const fd = await origReq.formData();
      if (fd && typeof fd.get === "function") {
        return fd;
      }
    }
  } catch (err) {
    console.warn("[readMultipartForm] originalRequest.formData() falló:", err);
  }

  // 3. Fallback: Reconstrucción con Request POST
  const contentType = ctx.request.headers.get("content-type") ?? "";
  const raw = await ctx.request.body.arrayBuffer();
  if (!raw || raw.byteLength === 0) {
    throw new Error("El cuerpo multipart está vacío (0 bytes recibidos del proxy/cliente)");
  }

  const reconstructed = new Request("http://multipart.local/", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: raw,
  });
  return await reconstructed.formData();
}

export async function formFieldAsString(
  value: FormDataEntryValue | null,
): Promise<string | null> {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof (value as any).text === "function") return await (value as any).text();
  return String(value);
}

export async function readFilePart(
  value: FormDataEntryValue | null,
): Promise<{ bytes: Uint8Array; name: string } | null> {
  if (!value || typeof value === "string") return null;
  const fileLike = value as unknown as { arrayBuffer?: () => Promise<ArrayBuffer>; size?: number; name?: string };
  if (typeof fileLike.arrayBuffer !== "function" || fileLike.size === 0) return null;
  return {
    bytes: new Uint8Array(await fileLike.arrayBuffer()),
    name: fileLike.name || "archivo",
  };
}
