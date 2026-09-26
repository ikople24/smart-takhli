// lib/flood-relief/localTickets.ts
// คำขอที่ส่งจากเครื่องนี้ — เก็บใน localStorage "flood:tickets" ให้ /flood/status ลิสต์ได้โดยไม่ต้องล็อกอิน (logic ล้วน)
// เก็บกุญแจไว้ด้วย: ไม่มีกุญแจ หน้าสถานะจะเห็นแค่ความคืบหน้า

import { parseTicket } from "./ticket";

export const LOCAL_TICKETS_KEY = "flood:tickets";
export const MAX_LOCAL_TICKETS = 20;

export type LocalTicket = { ticket: string; key: string; at: string };

/** อ่านค่าดิบจาก localStorage — พัง/ถูกแก้มือ = ข้ามรายการนั้น ไม่ throw */
export function parseLocalTickets(raw: string | null | undefined): LocalTicket[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: LocalTicket[] = [];
  const seen = new Set<string>();
  for (const item of data) {
    const t = parseTicket((item as LocalTicket)?.ticket);
    if (!t || seen.has(t.ticket)) continue;
    seen.add(t.ticket);
    out.push({
      ticket: t.ticket,
      key: typeof (item as LocalTicket).key === "string" ? (item as LocalTicket).key : "",
      at: typeof (item as LocalTicket).at === "string" ? (item as LocalTicket).at : "",
    });
  }
  return out.slice(0, MAX_LOCAL_TICKETS);
}

/** เพิ่มไว้บนสุด (ล่าสุดก่อน) · เลขซ้ำ = แทนที่ของเดิม · เกินจำนวนตัดของเก่าทิ้ง */
export function addLocalTicket(list: readonly LocalTicket[], entry: LocalTicket): LocalTicket[] {
  return [entry, ...list.filter((t) => t.ticket !== entry.ticket)].slice(0, MAX_LOCAL_TICKETS);
}

/** กุญแจของเลขที่นี้บนเครื่องนี้ (ถ้าเคยส่งจากเครื่องนี้) */
export function localKeyFor(list: readonly LocalTicket[], ticket: string): string {
  return list.find((t) => t.ticket === ticket)?.key ?? "";
}
