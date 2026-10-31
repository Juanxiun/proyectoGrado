// utils -> errores personalizados
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export class ValidationError extends Error {
  constructor(message: string, public fields: string[] = []) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export function mapDbError(err: unknown, defaultMsg: string): HttpError {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("duplicate key")) return new HttpError(409, "Registro duplicado");
  if (msg.includes("foreign key")) return new HttpError(400, "Referencia inválida");
  if (msg.includes("not null")) return new HttpError(400, "Campo obligatorio faltante");
  if (msg.includes("check constraint")) return new HttpError(400, "Valor inválido para restricción");
  return new HttpError(500, defaultMsg);
}