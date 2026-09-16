// deno-lint-ignore-file no-explicit-any
export function serialize<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_key, value) => {
      if (typeof value === "bigint") return value.toString();
      if (value instanceof Date) return value.toISOString();
      return value;
    }),
  );
}

export function toId(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val);
}

export function asDateString(val: unknown): string {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const s = String(val);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export function asDateTimeString(val: unknown): string {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString();
  return String(val);
}
