// lib/flood-relief/zones.ts
// ระดับโซนสีที่เจ้าหน้าที่วาดเอง + กฎลำดับความสำคัญเมื่อโซนซ้อนกัน (logic ล้วน)

/** เรียงจากรุนแรงที่สุด — ลำดับนี้คือ precedence เวลาจุดตกในหลายโซน */
export const ZONE_LEVELS = ["critical", "danger", "watch", "safe"] as const;
export type ZoneLevel = (typeof ZONE_LEVELS)[number];

export type ZoneStyle = {
  label: string;
  meaning: string;
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
  dashed: boolean;
};

export const ZONE_META: Readonly<Record<ZoneLevel, ZoneStyle>> = Object.freeze({
  critical: { label: "วิกฤต", meaning: "อพยพทันที", fill: "#E0455B", fillOpacity: 0.3, stroke: "#E0455B", strokeWidth: 2.5, dashed: false },
  danger: { label: "อันตราย", meaning: "เตรียมอพยพ", fill: "#F2A93B", fillOpacity: 0.28, stroke: "#F2A93B", strokeWidth: 2, dashed: true },
  watch: { label: "เฝ้าระวัง", meaning: "น้ำกำลังขึ้น", fill: "#E8C547", fillOpacity: 0.32, stroke: "#D4AF1F", strokeWidth: 2, dashed: true },
  safe: { label: "ปลอดภัย / ศูนย์พักพิง", meaning: "จุดรวมพล", fill: "#1B935A", fillOpacity: 0.16, stroke: "#1B935A", strokeWidth: 2, dashed: true },
});

export function isZoneLevel(v: unknown): v is ZoneLevel {
  return typeof v === "string" && (ZONE_LEVELS as readonly string[]).includes(v);
}

export function zoneRank(level: string | null | undefined): number {
  const i = (ZONE_LEVELS as readonly string[]).indexOf(String(level));
  return i < 0 ? ZONE_LEVELS.length : i;
}

type ZoneLike = { level: string; name: string; active?: boolean };

/**
 * เลือกโซนของจุดจากโซนที่ $geoIntersects คืนมา — ซ้อนหลายโซนเอาระดับสูงสุด
 * ระดับเท่ากันเรียงชื่อ เพื่อให้ได้คำตอบเดิมทุกครั้งไม่ว่า DB คืนลำดับไหน · ข้ามโซนที่ปิดใช้งาน
 */
export function pickZone<T extends ZoneLike>(matches: readonly T[]): T | null {
  const candidates = matches.filter((z) => z.active !== false && isZoneLevel(z.level));
  if (candidates.length === 0) return null;
  return [...candidates].sort(
    (a, b) => zoneRank(a.level) - zoneRank(b.level) || a.name.localeCompare(b.name, "th")
  )[0];
}

// ─── ระดับสถานการณ์บนบล็อกหน้าแรก ─────────────────────────────

export type SituationLevel = "critical" | "danger" | "watch" | "normal";

export const SITUATION_META: Readonly<Record<SituationLevel, { label: string; dot: string }>> = Object.freeze({
  critical: { label: "วิกฤต", dot: "#FF6B7D" },
  danger: { label: "อันตราย", dot: "#F5B544" },
  watch: { label: "เฝ้าระวัง", dot: "#F5B544" },
  normal: { label: "ปกติ", dot: "#3DD68C" },
});

/** ระดับสถานการณ์ = ระดับโซนสูงสุดที่ยังเปิดใช้งาน · ไม่มีโซน/มีแต่โซนปลอดภัย = ปกติ */
export function situationLevel(zones: ReadonlyArray<{ level: string; active?: boolean }>): SituationLevel {
  let best: SituationLevel = "normal";
  for (const z of zones) {
    if (z.active === false) continue;
    if (z.level === "safe" || !isZoneLevel(z.level)) continue;
    if (best === "normal" || zoneRank(z.level) < zoneRank(best)) best = z.level as SituationLevel;
  }
  return best;
}

// ─── ชื่อโซนเริ่มต้น A, B, C … ────────────────────────────────

function letterName(n: number): string {
  // 0 → A, 25 → Z, 26 → AA (แบบคอลัมน์ spreadsheet)
  let s = "";
  let i = n + 1;
  while (i > 0) {
    const r = (i - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

/** ชื่อถัดไปที่ยังไม่ถูกใช้ — ชื่อที่ลบไปแล้วนำกลับมาใช้ได้ */
export function nextZoneName(existing: ReadonlyArray<string | null | undefined>): string {
  const used = new Set(existing.map((n) => String(n ?? "").trim().toUpperCase()));
  for (let i = 0; ; i++) {
    const name = letterName(i);
    if (!used.has(name)) return name;
  }
}

/** ป้ายโซนในรายการ เช่น "โซน A" · ไม่มีโซน = null */
export function zoneLabel(zoneName: string | null | undefined): string | null {
  const n = String(zoneName ?? "").trim();
  return n ? `โซน ${n}` : null;
}
