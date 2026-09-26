// components/flood-relief/types.ts — รูปข้อมูลที่ GET public/requests/[ticket] คืน (ตาม lib/flood-relief/derive#publicRequest)
export type PublicFloodRequest = {
  ticket: string;
  type: string;
  urgency: string;
  status: string;
  citizenStep: number;
  createdAt: string | null;
  assignedAt: string | null;
  dispatchedAt: string | null;
  onSiteAt: string | null;
  doneAt: string | null;
  cancelledAt: string | null;
  full: boolean;
  landmark?: string;
  peopleCount?: number | null;
  communityName?: string | null;
  zoneLabel?: string | null;
  phoneMasked?: string;
};

/** ป้ายสถานะฝั่งประชาชน (ต่างจากป้ายแอดมินใน STATUS_META เช่น received = "รอมอบหมาย") */
export const CITIZEN_STATUS_CHIP: Record<string, { label: string; cls: string; pulse?: boolean }> = {
  received: { label: "รับเรื่องแล้ว", cls: "bg-tk-flood-soft text-tk-flood" },
  assigning: { label: "กำลังจัดทีม", cls: "bg-tk-due-soft text-tk-due-ink", pulse: true },
  dispatched: { label: "ทีมออกเดินทาง", cls: "bg-tk-due-soft text-tk-due-ink", pulse: true },
  on_site: { label: "ทีมถึงจุดแล้ว", cls: "bg-tk-coord-soft text-tk-coord-ink" },
  done: { label: "เสร็จสิ้น", cls: "bg-tk-done-soft text-tk-done-ink" },
  cancelled: { label: "ยกเลิก", cls: "bg-tk-unclaimed-soft text-tk-unclaimed-ink" },
};
