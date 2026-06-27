export function trimAll(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    out[String(key).trim()] = value == null ? "" : String(value).trim();
  }
  return out;
}
