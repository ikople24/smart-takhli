// lib/flood-relief/publicStats.ts
// ตัวเลขภาพรวมสำหรับหน้าติดตามสถานการณ์สาธารณะ /flood (logic ล้วน)
// **นับรวมเท่านั้น** — หน้าสาธารณะห้ามมีรายคำขอ/พิกัด/ชื่อ/เบอร์/จุดสังเกต (บ้านผู้ป่วยติดเตียงคือข้อมูลอ่อนไหว)

import { isClosedStatus, REQUEST_TYPES, type RequestType } from "./status";

const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" });

type Req = { status?: string | null; type?: string | null; doneAt?: Date | string | null };

export type PublicStats = {
  /** รับเรื่องแล้ว ยังไม่มีทีมออกเดินทาง */
  waiting: number;
  /** ทีมออกเดินทาง / ถึงจุดแล้ว */
  helping: number;
  doneToday: number;
  doneTotal: number;
  /** คำขอที่ยังไม่ปิด แยกตามประเภท */
  openByType: Record<RequestType, number>;
};

export function computePublicStats(requests: readonly Req[], now: Date = new Date()): PublicStats {
  const today = ymd.format(now);
  const openByType = Object.fromEntries(REQUEST_TYPES.map((t) => [t, 0])) as Record<RequestType, number>;
  let waiting = 0;
  let helping = 0;
  let doneToday = 0;
  let doneTotal = 0;
  for (const r of requests) {
    if (r.status === "done") {
      doneTotal++;
      if (r.doneAt && ymd.format(new Date(r.doneAt)) === today) doneToday++;
      continue;
    }
    if (isClosedStatus(r.status)) continue; // ยกเลิก — ไม่นับ
    if (r.status === "dispatched" || r.status === "on_site") helping++;
    else waiting++;
    if (r.type && r.type in openByType) openByType[r.type as RequestType]++;
  }
  return { waiting, helping, doneToday, doneTotal, openByType };
}
