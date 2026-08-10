// lib/lineMessaging.ts
// LINE Messaging API utility — ส่ง Reply / Push message ผ่าน LINE OA
//
// ENV vars ที่ต้องมีใน .env.local:
//   LINE_CHANNEL_ACCESS_TOKEN  — Channel Access Token จาก LINE Developers Console
//   LINE_ADMIN_GROUP_ID        — groupId ของกลุ่มเจ้าหน้าที่ (ขึ้นต้น C...)
//                                ได้จากการเชิญบอทเข้ากลุ่มแล้วบอทตอบ groupId กลับมา
//                                หรือพิมพ์ "groupid" ในกลุ่ม
//
// ใช้งาน:
//   import { lineReply, linePush, formatStatusMessage, buildMessages } from '@/lib/lineMessaging'
//
//   // Reply ใน webhook handler (พร้อมภาพ)
//   await lineReply(replyToken, buildMessages(formatStatusMessage(c), c.images?.[0]))
//
//   // Push เมื่อสถานะเปลี่ยน (พร้อมภาพ)
//   await linePush(lineUserId, buildMessages(formatStatusMessage(c), c.images?.[0]))
//
//   // แจ้งกลุ่มเจ้าหน้าที่ (skip เงียบ ๆ ถ้าไม่ได้ตั้ง LINE_ADMIN_GROUP_ID)
//   await lineNotifyAdminGroup(buildMessages(formatNewComplaintMessage(c), c.images?.[0]))

import { getAdminGroupId } from './lineSettings';

const LINE_API = 'https://api.line.me/v2/bot/message';
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';

// ---------- Types ----------

export interface TextMessage {
  type: 'text';
  text: string;
}

export interface FlexMessage {
  type: 'flex';
  altText: string;
  contents: Record<string, unknown>;
}

export interface ImageMessage {
  type: 'image';
  originalContentUrl: string;
  previewImageUrl: string;
}

export type LineMessage = TextMessage | FlexMessage | ImageMessage;

// ---------- Helpers ----------

/**
 * สร้าง ImageMessage จาก URL
 * LINE ต้องการ HTTPS เท่านั้น — ตรวจก่อนใส่
 */
export function makeImageMessage(url: string): ImageMessage | null {
  if (!url || !url.startsWith('https://')) return null;
  // Cloudinary: ใช้ thumbnail สำหรับ preview (w_400,q_70)
  const previewUrl = url.includes('cloudinary.com')
    ? url.replace('/upload/', '/upload/w_400,q_70/')
    : url;
  return {
    type: 'image',
    originalContentUrl: url,
    previewImageUrl: previewUrl,
  };
}

/**
 * สร้าง message array โดยแทรก ImageMessage ต่อท้าย main message ถ้ามี imageUrl
 * LINE รองรับสูงสุด 5 messages ต่อ reply/push
 */
export function buildMessages(
  main: LineMessage,
  imageUrl?: string | null
): LineMessage[] {
  const messages: LineMessage[] = [main];
  if (imageUrl) {
    const img = makeImageMessage(imageUrl);
    if (img) messages.push(img);
  }
  return messages;
}

// ---------- Core functions ----------

/**
 * ส่ง reply message (ใช้ใน webhook handler — ต้องใช้ภายใน 30 วินาที)
 */
export async function lineReply(
  replyToken: string,
  messages: LineMessage[]
): Promise<boolean> {
  if (!ACCESS_TOKEN) {
    console.warn('[LINE] LINE_CHANNEL_ACCESS_TOKEN not set — skipping reply');
    return false;
  }

  try {
    const res = await fetch(`${LINE_API}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ replyToken, messages }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[LINE] Reply failed: ${res.status} — ${body}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[LINE] Reply error:', err);
    return false;
  }
}

/**
 * ส่ง push message ไปหา user โดยตรง (ไม่ต้องมี replyToken)
 * fire-and-forget: ล้มเหลวจะ log ไม่โยน error
 */
export async function linePush(
  userId: string,
  messages: LineMessage[]
): Promise<boolean> {
  if (!ACCESS_TOKEN) {
    console.warn('[LINE] LINE_CHANNEL_ACCESS_TOKEN not set — skipping push');
    return false;
  }

  try {
    const res = await fetch(`${LINE_API}/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ to: userId, messages }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[LINE] Push failed: ${res.status} — ${body}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[LINE] Push error:', err);
    return false;
  }
}

/**
 * ส่ง multicast message ไปยังหลาย userId พร้อมกัน (สูงสุด 500 คน)
 * ใช้แจ้งเจ้าหน้าที่หลายคนพร้อมกันโดยไม่ต้องใช้ group
 * fire-and-forget: ล้มเหลวจะ log ไม่โยน error
 */
export async function lineMulticast(
  userIds: string[],
  messages: LineMessage[]
): Promise<boolean> {
  if (!ACCESS_TOKEN) {
    console.warn('[LINE] LINE_CHANNEL_ACCESS_TOKEN not set — skipping multicast');
    return false;
  }
  const validIds = userIds.filter(Boolean);
  if (!validIds.length) return false;

  try {
    const res = await fetch(`${LINE_API}/multicast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ to: validIds, messages }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[LINE] Multicast failed: ${res.status} — ${body}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[LINE] Multicast error:', err);
    return false;
  }
}

/**
 * ส่งข้อความเข้ากลุ่ม LINE ของเจ้าหน้าที่
 * groupId มาจาก Mongo (หน้า /admin/superadmin/line-settings) → fallback env LINE_ADMIN_GROUP_ID
 * fire-and-forget: ถ้าไม่ได้ตั้งค่าจะ log warning แล้ว skip — ระบบหลักทำงานต่อปกติ
 */
export async function lineNotifyAdminGroup(messages: LineMessage[]): Promise<boolean> {
  const groupId = await getAdminGroupId();
  if (!groupId) {
    console.warn('[LINE] admin group id not configured — skipping admin group notify');
    return false;
  }
  return linePush(groupId, messages);
}

// ---------- Message formatters ----------

/** สี badge ตามสถานะ */
function statusColor(status: string): string {
  const map: Record<string, string> = {
    'ดำเนินการเสร็จสิ้น': '#22c55e',
    'เสร็จสิ้น': '#22c55e',
    'อยู่ระหว่างดำเนินการ': '#f59e0b',
    'รอการตรวจสอบ': '#06b6d4',
    'รอการอนุมัติ': '#a855f7',
    'ยกเลิก': '#ef4444',
  };
  return map[status] ?? '#6b7280';
}

/** Emoji ตามสถานะ */
function statusEmoji(status: string): string {
  const map: Record<string, string> = {
    'ดำเนินการเสร็จสิ้น': '✅',
    'เสร็จสิ้น': '✅',
    'อยู่ระหว่างดำเนินการ': '🔄',
    'รอการตรวจสอบ': '🔍',
    'รอการอนุมัติ': '⏳',
    'ยกเลิก': '❌',
  };
  return map[status] ?? '📋';
}

/**
 * สร้าง Flex Message สำหรับแสดงสถานะเรื่องร้องเรียน
 * เรื่องที่ปิดงานแล้วส่ง solution/note มาด้วยเพื่อแสดงส่วน "การแก้ไข"
 */
export function formatStatusMessage(complaint: {
  complaintId: string;
  fullName?: string;
  category?: string;
  status: string;
  updatedAt?: Date | string | null;
  solution?: string[];
  note?: string;
}): FlexMessage {
  const { complaintId, fullName, category, status, updatedAt, solution, note } = complaint;
  const color = statusColor(status);
  const emoji = statusEmoji(status);

  const updatedStr = updatedAt
    ? new Date(updatedAt).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

  // ส่วน "การแก้ไข" — แสดงเมื่อมีข้อมูล solution/note (เรื่องที่ปิดงานแล้ว)
  const solutionItems = (solution ?? []).filter(Boolean);
  const noteText = note?.trim() || '';
  const fixContents =
    solutionItems.length || noteText
      ? [
          { type: 'separator' },
          { type: 'text', text: '🔧 การแก้ไข', size: 'sm', weight: 'bold', color: '#166534' },
          ...solutionItems.map((s) => ({
            type: 'text',
            text: `• ${s}`,
            size: 'sm',
            color: '#555555',
            wrap: true,
          })),
          ...(noteText
            ? [{ type: 'text', text: noteText, size: 'sm', color: '#555555', wrap: true }]
            : []),
        ]
      : [];

  return {
    type: 'flex',
    altText: `${emoji} อัปเดตสถานะเรื่องร้องเรียน ${complaintId}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: color,
        contents: [
          {
            type: 'text',
            text: `${emoji} ${status}`,
            color: '#ffffff',
            weight: 'bold',
            size: 'lg',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: `เรื่องร้องเรียน #${complaintId}`,
            weight: 'bold',
            size: 'md',
            color: '#111111',
          },
          ...(fullName
            ? [{ type: 'text', text: `ผู้แจ้ง: ${fullName}`, size: 'sm', color: '#555555' }]
            : []),
          ...(category
            ? [{ type: 'text', text: `หมวดหมู่: ${category}`, size: 'sm', color: '#555555' }]
            : []),
          ...fixContents,
          { type: 'separator' },
          {
            type: 'text',
            text: `อัปเดตล่าสุด: ${updatedStr}`,
            size: 'xs',
            color: '#aaaaaa',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'เทศบาลเมืองตาคลี',
            size: 'xs',
            color: '#aaaaaa',
            align: 'center',
          },
        ],
      },
    },
  };
}

/**
 * สร้าง Flex Message สำหรับแจ้งเรื่องร้องเรียนใหม่ (ส่งให้เจ้าหน้าที่)
 * รายละเอียดครบตามข้อความ n8n/Telegram เดิม + ปุ่มเปิดแผนที่จากพิกัดผู้แจ้ง
 * เรื่องลับ: caller ไม่ส่ง fullName/phone/detail มา (เซ็นเซอร์ตั้งแต่ต้นทาง)
 */
export function formatNewComplaintMessage(complaint: {
  complaintId: string;
  fullName?: string;
  phone?: string;
  category?: string;
  problems?: string[];
  detail?: string;
  community?: string;
  location?: { lat?: number; lng?: number } | null;
  createdAt?: Date | string | null;
}): FlexMessage {
  const { complaintId, fullName, phone, category, problems, detail, community, location, createdAt } =
    complaint;

  const createdStr = createdAt
    ? new Date(createdAt).toLocaleDateString('th-TH', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

  const problemsStr = (problems ?? []).filter(Boolean).join(', ');
  const mapUrl =
    typeof location?.lat === 'number' && typeof location?.lng === 'number'
      ? `https://www.google.com/maps?q=${location.lat},${location.lng}`
      : null;

  return {
    type: 'flex',
    altText: `📢 เรื่องร้องเรียนใหม่ #${complaintId}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#6366f1',
        contents: [
          {
            type: 'text',
            text: '📢 เรื่องร้องเรียนใหม่',
            color: '#ffffff',
            weight: 'bold',
            size: 'lg',
          },
          {
            type: 'text',
            text: `#${complaintId}`,
            color: '#e0e7ff',
            size: 'sm',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          ...(fullName
            ? [{ type: 'text', text: `👤 ผู้แจ้ง: ${fullName}`, size: 'sm', color: '#333333', weight: 'bold' }]
            : []),
          ...(phone
            ? [{ type: 'text', text: `📞 โทร: ${phone}`, size: 'sm', color: '#555555' }]
            : []),
          ...(community
            ? [{ type: 'text', text: `🏘️ ชุมชน: ${community}`, size: 'sm', color: '#555555' }]
            : []),
          ...(category
            ? [{ type: 'text', text: `หมวดหมู่: ${category}`, size: 'sm', color: '#555555' }]
            : []),
          ...(problemsStr
            ? [{ type: 'text', text: `🚧 ปัญหา: ${problemsStr}`, size: 'sm', color: '#555555', wrap: true }]
            : []),
          ...(detail
            ? [
                { type: 'separator' },
                { type: 'text', text: '🧾 รายละเอียด', size: 'sm', weight: 'bold', color: '#333333' },
                { type: 'text', text: detail, size: 'sm', color: '#666666', wrap: true },
              ]
            : []),
          { type: 'separator' },
          {
            type: 'text',
            text: `🕒 แจ้งเมื่อ: ${createdStr}`,
            size: 'xs',
            color: '#aaaaaa',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          ...(mapUrl
            ? [
                {
                  type: 'button',
                  action: { type: 'uri', label: '🗺️ เปิดแผนที่จุดแจ้ง', uri: mapUrl },
                  style: 'primary',
                  color: '#6366f1',
                  height: 'sm',
                },
              ]
            : []),
          {
            type: 'text',
            text: 'เทศบาลเมืองตาคลี — กรุณาตรวจสอบและดำเนินการ',
            size: 'xs',
            color: '#aaaaaa',
            align: 'center',
            wrap: true,
          },
        ],
      },
    },
  };
}

/**
 * สร้าง Flex Message แจ้งกลุ่มเจ้าหน้าที่เมื่อปิดงาน
 */
export function formatClosedMessage(opts: {
  complaintId: string;
  community?: string;
  fullName?: string;
  officerName?: string;
  closedAt?: Date | string | null;
}): FlexMessage {
  const { complaintId, community, fullName, officerName, closedAt } = opts;

  const closedStr = closedAt
    ? new Date(closedAt).toLocaleDateString('th-TH', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

  return {
    type: 'flex',
    altText: `✅ ปิดงานเรื่องร้องเรียน #${complaintId}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#22c55e',
        contents: [
          {
            type: 'text',
            text: '✅ ปิดงานเรียบร้อย',
            color: '#ffffff',
            weight: 'bold',
            size: 'lg',
          },
          {
            type: 'text',
            text: `#${complaintId}`,
            color: '#dcfce7',
            size: 'sm',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          ...(fullName
            ? [{ type: 'text', text: `ผู้แจ้ง: ${fullName}`, size: 'sm', color: '#333333' }]
            : []),
          ...(community
            ? [{ type: 'text', text: `ชุมชน: ${community}`, size: 'sm', color: '#555555' }]
            : []),
          ...(officerName
            ? [{ type: 'text', text: `เจ้าหน้าที่: ${officerName}`, size: 'sm', color: '#555555', weight: 'bold' }]
            : []),
          { type: 'separator' },
          {
            type: 'text',
            text: `ปิดงานเมื่อ: ${closedStr}`,
            size: 'xs',
            color: '#aaaaaa',
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'เทศบาลเมืองตาคลี',
            size: 'xs',
            color: '#aaaaaa',
            align: 'center',
          },
        ],
      },
    },
  };
}

/**
 * ข้อความไม่พบเรื่องร้องเรียน
 */
export function notFoundMessage(complaintId: string): TextMessage {
  return {
    type: 'text',
    text:
      `❌ ไม่พบเรื่องร้องเรียนรหัส "${complaintId}"\n\n` +
      `กรุณาตรวจสอบรหัสและลองใหม่อีกครั้ง\n` +
      `รูปแบบที่ถูกต้อง: สถานะ TKC-680001`,
  };
}

/**
 * ข้อความช่วยเหลือ
 */
export const helpMessage: TextMessage = {
  type: 'text',
  text:
    `🏛️ เทศบาลเมืองตาคลี — LINE Bot\n\n` +
    `ตรวจสอบสถานะเรื่องร้องเรียน:\n` +
    `📋 ส่งเลขที่เรื่องมาได้เลย เช่น TKC-690001\n` +
    `   (หรือพิมพ์ สถานะ TKC-690001)\n\n` +
    `หากต้องการความช่วยเหลือเพิ่มเติม\n` +
    `ติดต่อ: โทร 056-219-299 หรือ LINE OA @075cphqu`,
};
