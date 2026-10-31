// utils -> serializacion bigint -> string
export function toId(value: bigint | number | string): string {
  return String(value);
}

export function asDateTimeString(value: Date | string | undefined | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

// utils -> numero seguro (numeric/float8 llegan como string)
export function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// utils -> serializacion profunda (bigint -> string, date -> iso)
export function serialize<T = unknown>(value: T): T {
  if (typeof value === "bigint") return value.toString() as unknown as T;
  if (value instanceof Date) return value.toISOString() as unknown as T;
  if (Array.isArray(value)) return value.map((item) => serialize(item)) as unknown as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, serialize(item)]),
    ) as unknown as T;
  }
  return value;
}
