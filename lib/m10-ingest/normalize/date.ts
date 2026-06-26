import { NormalizeError } from "../types";

export function parseThaiDate(input: string): string {
  const m = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) throw new NormalizeError("date_parse_failed", `bad date: "${input}"`);
  const day = Number(m[1]), month = Number(m[2]), yearCE = Number(m[3]) - 543;
  if (month < 1 || month > 12 || day < 1 || day > 31 || yearCE < 1900)
    throw new NormalizeError("date_parse_failed", `out-of-range: "${input}"`);
  const d = new Date(Date.UTC(yearCE, month - 1, day));
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day)
    throw new NormalizeError("date_parse_failed", `invalid calendar date: "${input}"`);
  return `${yearCE}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
