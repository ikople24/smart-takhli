// ป้ายภาษาไทย + escape สำหรับ popup แผนที่ — DB เก็บ enum อังกฤษ แต่ UI ทั้งระบบเป็นไทย
import { NODE_TYPES, type NodeType, type PipeStatus } from './constants';

/** escape ก่อนยัดข้อความจาก DB ลง HTML popup (pattern เดียวกับ smart-light) */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ] as string
  );
}

export const PIPE_STATUS_LABELS: Record<PipeStatus, string> = {
  existing: 'ใช้งานอยู่',
  new: 'วางใหม่',
  abandoned: 'ยกเลิกใช้งาน',
  planned: 'แผนจะวาง',
};

export const NODE_CONDITION_LABELS: Record<string, string> = {
  ok: 'ปกติ',
  leaking: 'รั่ว',
  blocked: 'อุดตัน',
  damaged: 'ชำรุด',
  missing: 'สูญหาย',
  unknown: 'ยังไม่สำรวจ',
};

/** enum ที่ไม่รู้จัก (ข้อมูลนำเข้า/รุ่นเก่า) คืนค่าดิบ ดีกว่าโชว์ช่องว่าง */
export function pipeStatusLabel(status: string): string {
  return PIPE_STATUS_LABELS[status as PipeStatus] ?? status ?? '-';
}

export function nodeTypeLabel(type: string): string {
  return NODE_TYPES[type as NodeType]?.nameTh ?? type ?? '-';
}

export function nodeConditionLabel(condition: string): string {
  return NODE_CONDITION_LABELS[condition] ?? condition ?? '-';
}
