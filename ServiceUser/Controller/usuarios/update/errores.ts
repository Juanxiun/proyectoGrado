import type { RouterContext } from "@oak/oak";

// error -> respuesta controlada del controlador
export interface ErrorActualizacion {
  status: number;
  body: Record<string, unknown>;
}

// helper -> escribir respuesta de error
export function aplicarError(
  ctx: RouterContext<"/usuarios/:id">,
  error: ErrorActualizacion,
): void {
  ctx.response.status = error.status;
  ctx.response.body = error.body;
}

// helper -> traducir excepcion a respuesta http
export function manejarErrorActualizacion(
  ctx: RouterContext<"/usuarios/:id">,
  err: unknown,
): void {
  // deno-lint-ignore no-explicit-any
  const cause = (err as any)?.cause as any;
  const uploadStatus = (err as { status?: number })?.status;
  const msg = [
    (err as Error)?.message ?? "",
    cause?.message ?? "",
  ].join(" ").toLowerCase();
  const constraint = [
    String((err as { constraint?: string })?.constraint ?? ""),
    String(cause?.fields?.constraint ?? ""),
    String(cause?.constraint ?? ""),
  ].join(" ").toLowerCase();

  console.error("[updateUsuario]", err);

  if (uploadStatus && uploadStatus >= 400) {
    ctx.response.status = uploadStatus;
    ctx.response.body = {
      error: (err as Error)?.message ?? "No se pudo procesar el archivo",
    };
    return;
  }

  if (
    msg.includes("unique") || msg.includes("duplicate") ||
    msg.includes("23505") || constraint.trim().length > 0
  ) {
    let field = "general";
    let error = "Ya existe un dato registrado para otro usuario";
    if (
      constraint.includes("username") || msg.includes("username") ||
      msg.includes("uq_usuario_username")
    ) {
      field = "username";
      error = "El username ya está registrado";
    } else if (
      constraint.includes("email") || msg.includes("email") ||
      msg.includes("uq_usuario_email")
    ) {
      field = "email";
      error = "El correo electrónico ya está registrado";
    } else if (
      constraint.includes("numero_doc") || msg.includes("numero_doc") ||
      msg.includes("documentos")
    ) {
      field = "numeroDoc";
      error = "El número de documento ya está registrado para otro usuario";
    }
    ctx.response.status = 409;
    ctx.response.body = { error, message: error, field };
    return;
  }
  ctx.response.status = 500;
  ctx.response.body = { error: "Error interno del servidor" };
}
