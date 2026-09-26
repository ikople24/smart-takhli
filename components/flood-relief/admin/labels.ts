// components/flood-relief/admin/labels.ts — สี/ป้ายที่ใช้ซ้ำในแดชบอร์ด (อิงค่าคงที่ใน lib/flood-relief)
import { DONE_PIN_COLOR, isClosedStatus, URGENCY_META, type Urgency } from "@/lib/flood-relief/status";

export const URGENCY_BADGE: Record<string, string> = {
  critical: "bg-tk-overdue-ink text-white",
  urgent: "bg-tk-due-soft text-tk-due-ink",
  normal: "bg-tk-unclaimed-soft text-tk-unclaimed-ink",
};

export const URGENCY_TILE: Record<string, string> = {
  critical: "bg-tk-overdue-soft text-tk-overdue-ink",
  urgent: "bg-tk-due-soft text-tk-due-ink",
  normal: "bg-tk-unclaimed-soft text-tk-ink-3",
};

export const ZONE_BADGE: Record<string, string> = {
  critical: "bg-tk-overdue-soft text-tk-overdue-ink",
  danger: "bg-tk-due-soft text-tk-due-ink",
  watch: "bg-[#FBF3D6] text-[#7A6510]",
  safe: "bg-tk-done-soft text-tk-done-ink",
};

/** สีหมุด: ปิดแล้ว = เขียว · ไม่งั้นตามความเร่งด่วน */
export function pinColor(status: string, urgency: string): string {
  if (isClosedStatus(status)) return status === "cancelled" ? "#A9A4B8" : DONE_PIN_COLOR;
  return URGENCY_META[urgency as Urgency]?.pin ?? "#6B6880";
}

const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false });
export const hhmm = (v: string | null | undefined) => (v ? clock.format(new Date(v)) : "");
