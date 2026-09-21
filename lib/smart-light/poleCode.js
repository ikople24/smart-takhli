import StreetLightPole from "@/models/smart-light/StreetLightPole";
import { POLE_CODE_PREFIX } from "./constants";

// "ปปดด" = ปี พ.ศ. 2 หลัก + เดือน 2 หลัก ตามเวลาไทย เช่น ก.ค. 2026 → "6907"
export function buddhistYearMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year").value) + 543;
  const month = parts.find((p) => p.type === "month").value;
  return `${String(year % 100).padStart(2, "0")}${month}`;
}

export function formatPoleCode(yymm, running) {
  return `${POLE_CODE_PREFIX}-${yymm}${String(running).padStart(5, "0")}`;
}

// รหัสเสาถัดไป — เลขต้น 5 หลักท้ายวิ่งต่อเนื่องทั้งระบบ ไม่รีเซ็ตตามเดือน
// (ปปดดเพิ่มขึ้นตามเวลา + เลขต้นไม่รีเซ็ต → sort code แบบ string desc ได้ตัวเลขต้นสูงสุดเสมอ)
// ต้องเรียกหลัง dbConnect() แล้วเท่านั้น
export async function nextPoleCode() {
  const last = await StreetLightPole.findOne({
    code: new RegExp(`^${POLE_CODE_PREFIX}-\\d{9}$`),
  })
    .sort({ code: -1 })
    .select("code")
    .lean();
  const lastRunning = last ? Number(last.code.slice(-5)) : 0;
  return formatPoleCode(buddhistYearMonth(), lastRunning + 1);
}
