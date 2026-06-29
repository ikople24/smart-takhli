import { type Area, NormalizeError } from "../types";

function num(part: string, field: string): number {
  const t = part.trim();
  if (t === "") return 0;
  const n = Number(t);
  if (!Number.isFinite(n)) throw new NormalizeError("area_parse_failed", `${field}="${part}"`);
  return n;
}

export function parseArea(rai: string, ngan: string, wa: string, sub: string): Area {
  // เศษ = ส่วนร้อยของ ตร.ว. (ยืนยันกับ LTAX: "2 ตร.ว. เศษ 9" = 2.09 ตร.ว.) → /100
  const r = num(rai, "rai"), ng = num(ngan, "ngan"), w = num(wa, "wa"), s = num(sub, "sub");
  const waWithSub = w + s / 100;
  return { rai: r, ngan: ng, wa: waWithSub, sqm: (r * 400 + ng * 100 + waWithSub) * 4 };
}
