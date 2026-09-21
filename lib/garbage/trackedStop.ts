import type { Minutes, TruckColor, Weekday } from "@/types/garbage";

/** คีย์ใน localStorage — ใช้ร่วมกันระหว่างหน้าแรกกับหน้า /garbage ห้ามเปลี่ยนคนละที่ */
export const TRACKED_STOP_KEY = "garbage.trackedStop";

/** จุดที่ผู้ใช้กดติดตามไว้ — เก็บที่เครื่องผู้ใช้เท่านั้น ไม่ส่งขึ้นเซิร์ฟเวอร์ */
export interface TrackedStop {
  routeCode: string;
  seq: number;
  stopName: string;
  zoneLabel: string;
  truckNumber: number;
  truckColor: TruckColor;
  /** null = จุดนี้เก็บแต่ยังไม่ระบุเวลา — ติดตามได้ แต่นับถอยหลังไม่ได้ */
  atMin: Minutes | null;
  weekday: Weekday;
}

export function serializeTrackedStop(t: TrackedStop): string {
  return JSON.stringify(t);
}

const isInt = (v: unknown, min: number, max: number): boolean =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/**
 * อ่านค่าจาก localStorage แบบไม่เชื่อค่าที่อ่านได้
 * เป็นข้อมูลฝั่งผู้ใช้ — แก้มือได้ ค้างจากรุ่นก่อนได้ เจอค่าเพี้ยนต้องคืน null เฉย ๆ
 * ห้ามโยน error เพราะตัวเรียกคือการ์ดบนหน้าแรก ถ้าพังคือหน้าแรกพังทั้งหน้า
 */
export function parseTrackedStop(raw: string | null | undefined): TrackedStop | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.routeCode !== "string" || o.routeCode === "") return null;
  if (typeof o.stopName !== "string" || o.stopName === "") return null;
  if (typeof o.zoneLabel !== "string") return null;
  if (!isInt(o.seq, 1, 9999)) return null;
  if (!isInt(o.truckNumber, 1, 9999)) return null;
  if (o.truckColor !== "yellow" && o.truckColor !== "green") return null;
  if (!isInt(o.weekday, 0, 6)) return null;
  if (o.atMin !== null && !isInt(o.atMin, 0, 1439)) return null;
  return {
    routeCode: o.routeCode,
    seq: o.seq as number,
    stopName: o.stopName,
    zoneLabel: o.zoneLabel,
    truckNumber: o.truckNumber as number,
    truckColor: o.truckColor as TruckColor,
    atMin: o.atMin as Minutes | null,
    weekday: o.weekday as Weekday,
  };
}

/**
 * นาทีที่เหลือก่อนรถถึงจุดที่ติดตาม · ค่าติดลบ = รถผ่านไปแล้ววันนี้
 * null เมื่อไม่มีจุดที่ติดตาม / คนละวันกับที่ติดตามไว้ / จุดนั้นยังไม่ระบุเวลา
 * (จุดเดียวกันคนละวันรถถึงไม่ตรงกัน จึงนับถอยหลังข้ามวันไม่ได้)
 */
export function trackedEta(
  tracked: TrackedStop | null | undefined,
  weekdayToday: number,
  nowMin: Minutes
): number | null {
  if (!tracked || tracked.atMin == null) return null;
  if (tracked.weekday !== weekdayToday) return null;
  return tracked.atMin - nowMin;
}
