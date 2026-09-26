// lib/flood-relief/notifyText.ts
// การ์ด LINE ของศูนย์ฯ (logic ล้วน — แยกจาก notify.ts ที่ยิง LINE จริง เพื่อให้เทสได้)
// ส่งเป็น "บล็อกพิเศษ" (Flex) เข้ากลุ่มเจ้าหน้าที่ smart-takhli เดิม — หัวการ์ดสีตามความเร่งด่วน ให้เด่นจากการ์ดร้องเรียนปกติ
// มีปุ่ม "โทรหาผู้แจ้ง" (tel:) ให้เจ้าหน้าที่กดโทรได้ทันทียามฉุกเฉิน — เจ้าของอนุมัติ 2026-09-26 (เดิม README ไม่ใส่เบอร์)
// เบอร์อยู่ในปุ่มเท่านั้น ไม่พิมพ์ในเนื้อการ์ด/altText (altText โผล่ในแจ้งเตือนมือถือและพรีวิวแชต) · ไม่ใส่ชื่อผู้แจ้ง

import type { FlexMessage } from "@/lib/lineMessaging";
import { formatCoords, googleMapsDirUrl, type LatLng } from "./geo";
import { REQUEST_TYPE_META, URGENCY_META, type RequestType, type Urgency } from "./status";
import { ZONE_META, type ZoneLevel } from "./zones";

/** สีหัวการ์ด — โทนเข้มพอให้ตัวขาวผ่าน 4.5:1 */
const HEADER_BG: Record<Urgency, string> = { critical: "#C62839", urgent: "#9E6206", normal: "#4A4458" };
const URGENCY_ICON: Record<Urgency, string> = { critical: "🔴", urgent: "🟠", normal: "⚪" };
const FLOOD_BLUE = "#1D4299";

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
  /** เบอร์ผู้แจ้ง (normalize แล้ว) — ใช้ในปุ่มโทรเท่านั้น */
  phone: string;
  createdAt: Date;
};

function placeText(r: NewRequestSummary): string {
  const zone =
    r.zoneName && r.zoneLevel && r.zoneLevel in ZONE_META
      ? `โซน ${r.zoneName} (${ZONE_META[r.zoneLevel as ZoneLevel].label})`
      : null;
  return [r.communityName ? `ชุมชน${r.communityName}` : "ไม่ทราบชุมชน", zone].filter(Boolean).join(" · ");
}

const row = (label: string, value: string) => ({
  type: "box",
  layout: "baseline",
  spacing: "sm",
  contents: [
    { type: "text", text: label, size: "sm", color: "#6B6880", flex: 2 },
    { type: "text", text: value, size: "sm", color: "#241F38", flex: 5, wrap: true },
  ],
});

/** @param dashboardUrl ลิงก์เปิดในแดชบอร์ด — ไม่ได้ตั้ง base URL ก็ไม่มีปุ่มนี้ */
export function formatNewRequestFlex(r: NewRequestSummary, dashboardUrl?: string | null): FlexMessage {
  const typeLabel = REQUEST_TYPE_META[r.type].label;
  const urgencyLabel = URGENCY_META[r.urgency].label;
  const place = placeText(r);

  return {
    type: "flex",
    altText: `🆘 ${r.ticket} ${typeLabel} · ${urgencyLabel} · ${place}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: HEADER_BG[r.urgency],
        paddingAll: "16px",
        contents: [
          { type: "text", text: "🆘 ศูนย์ช่วยเหลือผู้ประสบภัยน้ำท่วม", color: "#FFFFFF", size: "xs", weight: "bold" },
          { type: "text", text: typeLabel, color: "#FFFFFF", size: "xl", weight: "bold", margin: "sm" },
          {
            type: "text",
            text: `${URGENCY_ICON[r.urgency]} ${urgencyLabel} · ${r.ticket}`,
            color: "#FFFFFF",
            size: "sm",
            margin: "xs",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          row("📍 พื้นที่", place),
          ...(r.landmark ? [row("🏠 จุดสังเกต", r.landmark)] : []),
          ...(r.peopleCount != null ? [row("👥 คนในบ้าน", `${r.peopleCount} คน`)] : []),
          row("🧭 พิกัด", formatCoords(r.point)),
          { type: "separator", margin: "md" },
          {
            type: "text",
            text: `🕒 รับเรื่อง ${bangkokTime.format(r.createdAt)} น. · ผ่านฟอร์มหน้าเว็บ`,
            size: "xs",
            color: "#6B6880",
            margin: "md",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#1B935A",
            height: "sm",
            action: { type: "uri", label: "📞 โทรหาผู้แจ้ง", uri: `tel:${r.phone.replace(/\D/g, "")}` },
          },
          {
            type: "button",
            style: "primary",
            color: FLOOD_BLUE,
            height: "sm",
            action: { type: "uri", label: "นำทาง Google Maps", uri: googleMapsDirUrl(r.point) },
          },
          ...(dashboardUrl
            ? [
                {
                  type: "button",
                  style: "secondary",
                  height: "sm",
                  action: { type: "uri", label: "เปิดในแดชบอร์ด", uri: dashboardUrl },
                },
              ]
            : []),
        ],
      },
    },
  };
}

// ─── แจ้งทีมที่ถูกมอบหมาย (ส่งเข้า FloodTeam.lineGroupId) ───────────────
// ทีมต้องโทรหาผู้แจ้งได้ทันที จึงใส่เบอร์ในปุ่ม (เหมือนการ์ดกลุ่มเจ้าหน้าที่)

export type TeamAssignSummary = NewRequestSummary & { teamName: string; assignedBy: string };

export function formatTeamAssignFlex(r: TeamAssignSummary): FlexMessage {
  const card = formatNewRequestFlex(r);
  const contents = card.contents as { header: { contents: Array<Record<string, unknown>> } };
  contents.header.contents[0] = {
    type: "text",
    text: `🚤 มอบหมาย ${r.teamName}`,
    color: "#FFFFFF",
    size: "xs",
    weight: "bold",
  };
  return {
    ...card,
    altText: `🚤 ${r.teamName} ได้รับมอบหมาย ${r.ticket} ${REQUEST_TYPE_META[r.type].label} · ${placeText(r)}`,
  };
}

// ─── แจ้งผู้แจ้งที่เชื่อม LINE ไว้ (dispatched / on_site / done) ──────────
// ฝั่งประชาชน: ไม่มีชื่อ/เบอร์ใคร (นโยบายเดียวกับหน้าสถานะ)

const REPORTER_TEXT: Record<string, string> = {
  dispatched: "ทีมเจ้าหน้าที่ออกเดินทางไปยังจุดของคุณแล้ว",
  on_site: "ทีมเจ้าหน้าที่ถึงจุดเกิดเหตุแล้ว",
  done: "การช่วยเหลือเสร็จสิ้นแล้ว ขอให้ปลอดภัย",
};

/** สถานะที่ไม่ต้องแจ้งผู้แจ้ง = null */
export function formatReporterStatusText(ticket: string, status: string): string | null {
  const msg = REPORTER_TEXT[status];
  return msg ? `🌊 คำขอ ${ticket}\n${msg}` : null;
}
