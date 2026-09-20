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

export function mapDbError(err: unknown, fallback: string): HttpError {
  if (err instanceof HttpError) return err;
  const e = err as { code?: string; constraint?: string; message?: string; fields?: { code?: string; constraint?: string } };
  const constraint = (e.constraint || e.fields?.constraint || e.message || "").toLowerCase();

  if (isUniqueViolation(err)) {
    let msg = "Ya existe un registro con esos datos únicos";
    if (constraint.includes("codigo")) msg = "El código ya se encuentra registrado";
    else if (constraint.includes("nombre")) msg = "El nombre ya se encuentra registrado";
    else if (constraint.includes("curso")) msg = "Ese curso ya está registrado";
    return new HttpError(409, msg);
  }
  if (isForeignKeyViolation(err)) {
    return new HttpError(409, "No se puede completar la operación: hay registros relacionados");
  }
  console.error("[db]", err);
  return new HttpError(500, fallback);
}
