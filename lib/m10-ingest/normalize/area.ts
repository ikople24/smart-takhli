import { type Area, NormalizeError } from "../types";

function num(part: string, field: string): number {
  const t = part.trim();
  if (t === "") return 0;
  const n = Number(t);
  if (!Number.isFinite(n)) throw new NormalizeError("area_parse_failed", `${field}="${part}"`);
  return n;
}

export function parseArea(rai: string, ngan: string, wa: string, sub: string): Area {
  const r = num(rai, "rai"), ng = num(ngan, "ngan"), w = num(wa, "wa"), s = num(sub, "sub");
  const waWithSub = w + s / 10;
  return { rai: r, ngan: ng, wa: waWithSub, sqm: (r * 400 + ng * 100 + waWithSub) * 4 };
}
