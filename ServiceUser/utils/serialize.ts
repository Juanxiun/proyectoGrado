/**
 * Serializa recursivamente un objeto, convirtiendo los valores BigInt
 * a string para que sean compatibles con JSON.stringify de Oak.
 *
 * El tipo de retorno usa `as` cast a `T` para que Oak acepte el valor
 * directamente como `ctx.response.body`.
 */
export function serialize<T = Record<string, unknown>>(obj: unknown): T {
  if (typeof obj === "bigint") return String(obj) as T;
  if (Array.isArray(obj)) return obj.map(serialize) as T;
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        k,
        serialize(v),
      ]),
    ) as T;
  }
  return obj as T;
}
