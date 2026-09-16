export function serialize<T = Record<string, unknown>>(obj: unknown): T {
  if (typeof obj === "bigint") return String(obj) as T;
  if (obj instanceof Date) {
    return (isNaN(obj.getTime()) ? "" : obj.toISOString().slice(0, 10)) as unknown as T;
  }
  if (Array.isArray(obj)) return obj.map(serialize) as T;
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, serialize(v)]),
    ) as T;
  }
  return obj as T;
}

export function toId(value: unknown): string {
  if (typeof value === "bigint") return value.toString();
  return String(value);
}

export function asDateString(value: unknown): string {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  }
  return value ? String(value).slice(0, 10) : "";
}

export function asDateTimeString(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString();
  }
  return String(value);
}
