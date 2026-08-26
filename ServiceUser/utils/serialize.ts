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
