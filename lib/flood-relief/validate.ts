// lib/flood-relief/validate.ts
// ตรวจ/ทำความสะอาด body ของ POST public/requests (logic ล้วน) — บังคับแค่ 3 อย่าง: ประเภท · พิกัด · เบอร์โทร
// ที่เหลือเป็นตัวเลือกทั้งหมด (หลักคิด "ด่วน กรอกง่าย") ค่าที่ผิดรูปแบบในช่องไม่บังคับให้ทิ้งไป ไม่ปฏิเสธทั้งคำขอ

import { parseLatLng, type LatLng } from "./geo";
import { isValidPhone, normalizePhone } from "./phone";
import { defaultUrgencyForType, isRequestType, isUrgency, type RequestType, type Urgency } from "./status";

export const TEXT_LIMITS = Object.freeze({ landmark: 200, reporterName: 100, detail: 1000 });
export const MAX_PEOPLE = 999;
export const MAX_IMAGES = 3;
/** GPS ความแม่นยำแย่กว่านี้ถือว่าไม่มีความหมาย — เก็บเป็น null แทน */
const MAX_ACCURACY_M = 10000;

export type CleanRequestInput = {
  type: RequestType;
  urgency: Urgency;
  point: LatLng;
  accuracyM: number | null;
  phone: string;
  landmark: string;
  reporterName: string;
  detail: string;
  peopleCount: number | null;
  images: string[];
};

export type ValidationResult =
  | { ok: true; value: CleanRequestInput }
  | { ok: false; errors: Partial<Record<"type" | "location" | "phone", string>> };

const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

function cleanImages(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  // รับเฉพาะรูปที่อัปโหลดขึ้น Cloudinary แล้ว — กันการฝังลิงก์ภายนอกลงแดชบอร์ด
  return v
    .filter((u): u is string => typeof u === "string" && /^https:\/\/res\.cloudinary\.com\//.test(u))
    .slice(0, MAX_IMAGES);
}

export function validateRequestInput(body: unknown): ValidationResult {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const errors: Partial<Record<"type" | "location" | "phone", string>> = {};

  if (!isRequestType(b.type)) errors.type = "กรุณาเลือกเรื่องที่ต้องการความช่วยเหลือ";
  const point = parseLatLng(b.lat, b.lng);
  if (!point) errors.location = "กรุณาระบุตำแหน่งที่ต้องการความช่วยเหลือ";
  if (!isValidPhone(b.phone)) errors.phone = "กรุณากรอกเบอร์โทรศัพท์ 9–10 หลัก";

  if (!isRequestType(b.type) || !point || Object.keys(errors).length > 0) return { ok: false, errors };

  const acc = Number(b.accuracyM);
  const people = Number(b.peopleCount);

  return {
    ok: true,
    value: {
      type: b.type,
      urgency: isUrgency(b.urgency) ? b.urgency : defaultUrgencyForType(b.type),
      point,
      accuracyM: Number.isFinite(acc) && acc >= 0 && acc <= MAX_ACCURACY_M ? Math.round(acc) : null,
      phone: normalizePhone(b.phone),
      landmark: clip(b.landmark, TEXT_LIMITS.landmark),
      reporterName: clip(b.reporterName, TEXT_LIMITS.reporterName),
      detail: clip(b.detail, TEXT_LIMITS.detail),
      peopleCount:
        b.peopleCount !== "" && b.peopleCount != null && Number.isInteger(people) && people >= 0 && people <= MAX_PEOPLE
          ? people
          : null,
      images: cleanImages(b.images),
    },
  };
}
