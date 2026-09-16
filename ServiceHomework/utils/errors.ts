export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; fields?: { code?: string } };
  return e.code === "23505" || e.fields?.code === "23505";
}

export function isForeignKeyViolation(err: unknown): boolean {
  const e = err as { code?: string; fields?: { code?: string } };
  return e.code === "23503" || e.fields?.code === "23503";
}

export function isCheckViolation(err: unknown): boolean {
  const e = err as { code?: string; fields?: { code?: string } };
  return e.code === "23514" || e.fields?.code === "23514";
}

export function mapDbError(err: unknown, fallback: string): HttpError {
  if (err instanceof HttpError) return err;
  if (isUniqueViolation(err)) {
    return new HttpError(409, "Ya existe un registro con esos datos únicos");
  }
  if (isForeignKeyViolation(err)) {
    return new HttpError(409, "No se puede completar la operación: referencia foránea no encontrada o en conflicto");
  }
  if (isCheckViolation(err)) {
    return new HttpError(400, "Los valores ingresados no cumplen con las restricciones de validación");
  }
  console.error("[db]", err);
  return new HttpError(500, fallback);
}
