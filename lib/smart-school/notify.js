// lib/smart-school/notify.js
// แจ้งเตือน n8n webhook (→ Telegram)
// Contract: caller ควร `await` ได้เลย — ฟังก์ชันนี้ไม่มีทาง throw (คืน boolean)
// และถูกจำกัดเวลา 5s จึงไม่ block นาน; บนอาจ serverless ห้ามปล่อย promise ลอยไว้
// ENV: N8N_SCHOOL_WEBHOOK_URL — ไม่ตั้ง = ใช้ URL webhook sm-school เดิม (workflow "Api All"),
//      ตั้งเป็นค่าว่าง ("") = ปิดการแจ้งเตือน (เช่น local dev)

const WEBHOOK_URL =
  process.env.N8N_SCHOOL_WEBHOOK_URL ??
  "https://primary-production-a1769.up.railway.app/webhook/sm-school";

const HEADERS = {
  "school.submitted": "📚 รายใหม่ — สำรวจข้อมูลการศึกษา TAKHLI-SCHOOL",
  "school.renewal_updated": "🔄 รายเก่า update ข้อมูล — TAKHLI-SCHOOL",
  "school.images_changed": "🖼️ เปลี่ยนรูปภาพ — TAKHLI-SCHOOL",
};

/**
 * @param {"school.submitted"|"school.renewal_updated"|"school.images_changed"} event
 * @param {{applicationId?: string, surveyYear?: number, name?: string, educationLevel?: string,
 *          phone?: string, address?: string, note?: string, image?: string[],
 *          location?: {lat:number,lng:number}}} data
 */
export async function notifySchoolEvent(event, data) {
  if (!WEBHOOK_URL) return false;
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        header: HEADERS[event] || HEADERS["school.submitted"],
        appId: process.env.NEXT_PUBLIC_APP_ID || "smart-takhli",
        timestamp: new Date().toISOString(),
        ...data,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`[n8n school] webhook failed: ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[n8n school] webhook error for "${event}":`, err?.message || err);
    return false;
  }
}
