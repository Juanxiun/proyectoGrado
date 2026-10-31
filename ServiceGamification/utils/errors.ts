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

export function mapDbError(err: unknown, defaultMsg: string): HttpError {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("duplicate key")) return new HttpError(409, "Registro duplicado");
  if (msg.includes("foreign key")) return new HttpError(400, "Referencia inválida");
  return new HttpError(500, defaultMsg);
}