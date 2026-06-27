export function parseCurrency(input: string): number | null {
  const cleaned = (input ?? "").replace(/[฿,\s]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
