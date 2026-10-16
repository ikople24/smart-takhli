// แจ้งปัญหาน้ำประปาจากประชาชน (/papar/report) — logic ล้วน (เทสต์: __tests__/waterReport.test.js)
// ส่งการ์ด LINE เข้ากลุ่มเจ้าหน้าที่ smart-takhli เดิม (lineNotifyAdminGroup) — เจ้าของเลือก 2026-10-16
// เบอร์/ชื่อผู้แจ้ง: ไม่ใส่ใน altText (โผล่ในแจ้งเตือนมือถือ/พรีวิวแชต) · เบอร์อยู่ในปุ่มโทรเท่านั้น (แบบเดียวกับ flood-relief)

export const WATER_SYMPTOMS = {
  turbid: "น้ำขุ่น",
  no_water: "น้ำไม่ไหล",
  weak: "น้ำไหลอ่อน",
  odd: "สี/กลิ่นผิดปกติ",
};
export const WATER_SINCE = {
  hour: "ไม่ถึง 1 ชม.",
  today: "วันนี้",
  yesterday: "ตั้งแต่เมื่อวาน",
  days: "หลายวันแล้ว",
};
export const MAX_REPORT_PHOTOS = 3;

const CLOUDINARY_RE = /^https:\/\/res\.cloudinary\.com\//;
const TICKET_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ไม่มี 0 O 1 I — อ่านให้เจ้าหน้าที่ทางโทรศัพท์ไม่สับสน

const str = (v) => (v === null || v === undefined ? "" : String(v)).trim();
const num = (v) => (v === null || v === undefined || v === "" ? NaN : Number(v));

/** ตัดทุกอย่างที่ไม่ใช่ตัวเลข · +66 / 66 นำหน้า → 0 (ตรงกับ lib/flood-relief/phone.ts) */
export function normalizePhone(input) {
  let d = String(input ?? "").replace(/\D/g, "");
  if (d.startsWith("66") && (d.length === 11 || d.length === 10)) d = "0" + d.slice(2);
  return d;
}

export function maskPhone(input) {
  const d = normalizePhone(input);
  if (d.length < 9) return "xxx";
  return `${d.slice(0, 2)}x-xxx-${d.slice(-4)}`;
}

export function validateWaterReportInput(body) {
  const b = body || {};
  const errors = {};
  const value = {};

  const symptoms = [...new Set((Array.isArray(b.symptoms) ? b.symptoms : []).filter((s) => s in WATER_SYMPTOMS))];
  if (symptoms.length === 0) errors.symptoms = "เลือกอย่างน้อย 1 อาการ";
  value.symptoms = symptoms;

  value.since = str(b.since);
  if (!(value.since in WATER_SINCE)) errors.since = "เลือกว่าเริ่มเป็นตั้งแต่เมื่อไหร่";

  const lat = num(b.lat);
  const lng = num(b.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    errors.location = "ยังไม่ได้ปักหมุดบ้าน";
  } else {
    value.point = { lat, lng };
  }
  const acc = num(b.accuracyM);
  value.accuracyM = Number.isFinite(acc) && acc >= 0 ? Math.round(acc) : null;

  value.addressNote = str(b.addressNote).slice(0, 200);

  value.photos = (Array.isArray(b.photos) ? b.photos : [])
    .filter((u) => typeof u === "string" && CLOUDINARY_RE.test(u))
    .slice(0, MAX_REPORT_PHOTOS);

  value.prefix = str(b.prefix).slice(0, 20);
  value.fullName = str(b.fullName);
  if (!value.fullName) errors.fullName = "กรอกชื่อ–นามสกุล";
  else if (value.fullName.length > 100) errors.fullName = "ชื่อยาวเกินไป";

  value.phone = normalizePhone(b.phone);
  if (!/^0\d{8,9}$/.test(value.phone)) errors.phone = "เบอร์โทรไม่ถูกต้อง";

  if (b.consent !== true) errors.consent = "กรุณายินยอมให้ใช้ข้อมูลเพื่อติดต่อกลับ";

  return { ok: Object.keys(errors).length === 0, value, errors };
}

/** เลขที่เรื่องแบบสุ่ม (เดาเลขคนอื่นไม่ได้) · rand คืน 0 ≤ x < 1 */
export function newWaterTicket(rand) {
  const r =
    rand ||
    (() => {
      const a = new Uint32Array(1);
      globalThis.crypto.getRandomValues(a);
      return a[0] / 2 ** 32;
    });
  let out = "";
  for (let i = 0; i < 6; i++) out += TICKET_ALPHABET[Math.floor(r() * TICKET_ALPHABET.length)];
  return `WR-${out}`;
}

const bangkokTime = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const row = (label, value) => ({
  type: "box",
  layout: "baseline",
  spacing: "sm",
  contents: [
    { type: "text", text: label, size: "sm", color: "#6B6880", flex: 2 },
    { type: "text", text: value, size: "sm", color: "#241F38", flex: 5, wrap: true },
  ],
});

/** การ์ด LINE เรื่องแจ้งใหม่ — 1 ข้อความต่อเรื่อง (รูปแรกเป็น hero ไม่ส่งรูปแยก เพื่อประหยัดโควตา OA) */
export function formatWaterReportFlex(r) {
  const symptoms = r.symptoms.map((s) => WATER_SYMPTOMS[s]).filter(Boolean).join(" · ");
  const place = r.communityName ? `ชุมชน${r.communityName}` : "ไม่ทราบชุมชน";
  const { lat, lng } = r.point;
  const coords = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  const bubble = {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#1E40AF",
      paddingAll: "16px",
      contents: [
        { type: "text", text: "💧 ประชาชนแจ้งปัญหาน้ำประปา", color: "#FFFFFF", size: "xs", weight: "bold" },
        { type: "text", text: symptoms, color: "#FFFFFF", size: "xl", weight: "bold", margin: "sm", wrap: true },
        { type: "text", text: `เริ่ม${WATER_SINCE[r.since] || "-"} · ${r.ticket}`, color: "#FFFFFF", size: "sm", margin: "xs" },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        row("📍 พื้นที่", place),
        ...(r.addressNote ? [row("🏠 จุดสังเกต", r.addressNote)] : []),
        row("🧭 พิกัด", coords),
        ...(r.photos?.length > 1 ? [row("📷 รูป", `${r.photos.length} รูป (ดูในระบบ)`)] : []),
        { type: "separator", margin: "md" },
        {
          type: "text",
          text: `🕒 รับเรื่อง ${bangkokTime.format(r.createdAt)} น. · ผ่านหน้าเว็บ /papar`,
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
        { type: "button", style: "primary", color: "#1E40AF", height: "sm", action: { type: "uri", label: "นำทางไปจุดแจ้ง", uri: mapsUrl } },
        { type: "button", style: "secondary", height: "sm", action: { type: "uri", label: "โทรหาผู้แจ้ง", uri: `tel:${r.phone}` } },
      ],
    },
  };
  if (r.photos?.[0]) {
    bubble.hero = { type: "image", url: r.photos[0], size: "full", aspectRatio: "20:13", aspectMode: "cover" };
  }
  return { type: "flex", altText: `💧 ${r.ticket} ${symptoms} · ${place}`, contents: bubble };
}
