const host = Deno.env.get("CLAMAV_HOST") ?? "localhost";
const port = Number(Deno.env.get("CLAMAV_PORT") ?? "3310");

export class UploadSecurityError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function writeAll(conn: Deno.Conn, bytes: Uint8Array): Promise<void> {
  for (let offset = 0; offset < bytes.length;) offset += await conn.write(bytes.subarray(offset));
}

// seguridad -> bloquear malware clamav
export async function scanUpload(bytes: Uint8Array): Promise<void> {
  let conn: Deno.Conn | undefined;
  try {
    conn = await Deno.connect({ hostname: host, port });
    await writeAll(conn, new TextEncoder().encode("zINSTREAM\0"));
    const chunkSize = 64 * 1024;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
      const header = new Uint8Array(4);
      new DataView(header.buffer).setUint32(0, chunk.length, false);
      await writeAll(conn, header);
      await writeAll(conn, chunk);
    }
    await writeAll(conn, new Uint8Array(4));
    const response = new Uint8Array(4096);
    let result = "";
    while (!result.includes("\0")) {
      const count = await conn.read(response);
      if (count === null) break;
      result += new TextDecoder().decode(response.subarray(0, count));
    }
    if (!result.includes("OK")) {
      if (result.includes("FOUND")) throw new UploadSecurityError("El archivo fue rechazado por contener una amenaza detectada", 400);
      throw new Error(`Respuesta inesperada de ClamAV: ${result}`);
    }
  } catch (error) {
    if (error instanceof UploadSecurityError) throw error;
    console.error(`[upload-security] No se pudo conectar con ClamAV en ${host}:${port}:`, error);
    throw new UploadSecurityError(
      `No se pudo conectar con ClamAV en ${host}:${port}. Verifique que shalom_antivirus este activo y en la red Docker shalom_backend. No se acepto el archivo.`,
      503,
    );
  } finally {
    conn?.close();
  }
}
