// lib/flood-relief/notifyText.ts
// ข้อความ LINE ของศูนย์ฯ (logic ล้วน — แยกจาก notify.ts ที่ยิง LINE จริง เพื่อให้เทสได้)
// กลุ่มศูนย์ฯ: ไม่ใส่ชื่อ/เบอร์ผู้แจ้ง (README § LINE) — เจ้าหน้าที่เปิดดูเบอร์ในแดชบอร์ดที่ต้องล็อกอิน

import { formatCoords, googleMapsDirUrl, type LatLng } from "./geo";
import { REQUEST_TYPE_META, URGENCY_META, type RequestType, type Urgency } from "./status";
import { ZONE_META, type ZoneLevel } from "./zones";

const URGENCY_ICON: Record<Urgency, string> = { critical: "🔴", urgent: "🟠", normal: "⚪" };

const bangkokTime = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export type NewRequestSummary = {
  ticket: string;
  type: RequestType;
  urgency: Urgency;
  point: LatLng;
  communityName: string | null;
  zoneName: string | null;
  zoneLevel: string | null;
  landmark?: string;
  peopleCount?: number | null;
  createdAt: Date;
};

/** @param dashboardUrl ลิงก์เปิดในแดชบอร์ด — ไม่ได้ตั้ง base URL ก็ละบรรทัดนี้ */
export function formatNewRequestText(r: NewRequestSummary, dashboardUrl?: string | null): string {
  const zone =
    r.zoneName && r.zoneLevel && r.zoneLevel in ZONE_META
      ? `โซน ${r.zoneName} (${ZONE_META[r.zoneLevel as ZoneLevel].label})`
      : null;
  const place = [r.communityName ? `ชุมชน${r.communityName}` : "ไม่ทราบชุมชน", zone].filter(Boolean).join(" · ");

  const lines = [
    `${URGENCY_ICON[r.urgency]} คำขอช่วยเหลือน้ำท่วม ${r.ticket}`,
    `${REQUEST_TYPE_META[r.type].label} · ${URGENCY_META[r.urgency].label}`,
    `📍 ${place}`,
    r.landmark ? `จุดสังเกต: ${r.landmark}` : null,
    r.peopleCount != null ? `คนในบ้าน: ${r.peopleCount} คน` : null,
    `พิกัด ${formatCoords(r.point)}`,
    `นำทาง: ${googleMapsDirUrl(r.point)}`,
    dashboardUrl ? `เปิดในแดชบอร์ด: ${dashboardUrl}` : null,
    `รับเรื่อง ${bangkokTime.format(r.createdAt)} น.`,
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}
