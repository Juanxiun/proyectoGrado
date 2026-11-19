// utils -> serializacion bigint -> string
export function toId(value: bigint | number | string): string {
  return String(value);
}

export function asDateString(value: Date | string | undefined | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().split("T")[0] : String(value).split("T")[0];
}

export function asDateTimeString(value: Date | string | undefined | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

export function serialize<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "bigint") {
      result[key] = value.toString();
    } else if (value instanceof Date) {
      result[key] = value.toISOString();
    } else if (value !== null && value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
}