// lib/flood-relief/settings.ts
// ค่าตั้งศูนย์ฯ (singleton doc key 'default' ใน flood_settings) — ไม่มีเอกสาร = ใช้ค่าเริ่มต้น ระบบทำงานได้โดยไม่ต้อง seed
// อ่านแล้ว normalize ผ่านไฟล์นี้เสมอ

export const DEFAULT_FLOOD_SETTINGS = Object.freeze({
  /** ปิดไว้ก่อน — บล็อกหน้าแรกโผล่ต่อเมื่อ superadmin เปิดศูนย์ฯ */
  centerOpen: false,
  hotline: "056-261-500",
  /** เจ้าหน้าที่โทรกลับภายในกี่นาที (แสดงบนหน้าสถานะ) */
  callbackSlaMin: 15,
  announcement: "",
});

export type FloodSettingsValue = {
  centerOpen: boolean;
  hotline: string;
  callbackSlaMin: number;
  announcement: string;
};

export function normalizeSettings(doc: Partial<Record<keyof FloodSettingsValue, unknown>> | null | undefined): FloodSettingsValue {
  const d = doc ?? {};
  const sla = Number(d.callbackSlaMin);
  const hotline = String(d.hotline ?? "").trim();
  return {
    centerOpen: d.centerOpen === true,
    hotline: hotline || DEFAULT_FLOOD_SETTINGS.hotline,
    callbackSlaMin: Number.isInteger(sla) && sla >= 1 && sla <= 240 ? sla : DEFAULT_FLOOD_SETTINGS.callbackSlaMin,
    announcement: String(d.announcement ?? "").trim().slice(0, 500),
  };
}

/** "056-261-500" → "tel:056261500" */
export function telHref(hotline: string): string {
  return `tel:${String(hotline).replace(/[^\d+]/g, "")}`;
}
