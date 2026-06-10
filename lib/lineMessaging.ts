// lib/lineMessaging.ts
// LINE Messaging API utility — ส่ง Reply / Push message ผ่าน LINE OA
//
// ENV vars ที่ต้องมีใน .env.local:
//   LINE_CHANNEL_ACCESS_TOKEN  — Channel Access Token จาก LINE Developers Console
//   LINE_ADMIN_GROUP_ID        — (optional) LINE group/user ID สำหรับแจ้งเจ้าหน้าที่เรื่องใหม่
//
// ใช้งาน:
//   import { lineReply, linePush, formatStatusMessage, buildMessages } from '@/lib/lineMessaging'
//
//   // Reply ใน webhook handler (พร้อมภาพ)
//   await lineReply(replyToken, buildMessages(formatStatusMessage(c), c.images?.[0]))
//
//   // Push เมื่อสถานะเปลี่ยน (พร้อมภาพ)
//   await linePush(lineUserId, buildMessages(formatStatusMessage(c), c.images?.[0]))

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

// ---------- Message formatters ----------

/** สี badge ตามสถานะ */
function statusColor(status: string): string {
  const map: Record<string, string> = {
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
 */
export function formatStatusMessage(complaint: {
  complaintId: string;
  fullName?: string;
  category?: string;
  status: string;
  updatedAt?: Date | string | null;
}): FlexMessage {
  const { complaintId, fullName, category, status, updatedAt } = complaint;
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
            text: 'เทศบาลตำบลตาคลี',
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
 */
export function formatNewComplaintMessage(complaint: {
  complaintId: string;
  fullName?: string;
  category?: string;
  detail?: string;
  community?: string;
  createdAt?: Date | string | null;
}): FlexMessage {
  const { complaintId, fullName, category, detail, community, createdAt } = complaint;

  const createdStr = createdAt
    ? new Date(createdAt).toLocaleDateString('th-TH', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

  const detailSnippet = detail
    ? detail.length > 60 ? detail.slice(0, 60) + '…' : detail
    : '';

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
            ? [{ type: 'text', text: `ผู้แจ้ง: ${fullName}`, size: 'sm', color: '#333333', weight: 'bold' }]
            : []),
          ...(category
            ? [{ type: 'text', text: `หมวดหมู่: ${category}`, size: 'sm', color: '#555555' }]
            : []),
          ...(community
            ? [{ type: 'text', text: `ชุมชน: ${community}`, size: 'sm', color: '#555555' }]
            : []),
          ...(detailSnippet
            ? [{ type: 'text', text: detailSnippet, size: 'sm', color: '#666666', wrap: true }]
            : []),
          { type: 'separator' },
          {
            type: 'text',
            text: `แจ้งเมื่อ: ${createdStr}`,
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
            text: 'เทศบาลตำบลตาคลี — กรุณาตรวจสอบและดำเนินการ',
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
 * ข้อความไม่พบเรื่องร้องเรียน
 */
export function notFoundMessage(complaintId: string): TextMessage {
  return {
    type: 'text',
    text:
      `❌ ไม่พบเรื่องร้องเรียนรหัส "${complaintId}"\n\n` +
      `กรุณาตรวจสอบรหัสและลองใหม่อีกครั้ง\n` +
      `รูปแบบที่ถูกต้อง: สถานะ TK-001-2025`,
  };
}

/**
 * ข้อความช่วยเหลือ
 */
export const helpMessage: TextMessage = {
  type: 'text',
  text:
    `🏛️ เทศบาลตำบลตาคลี — LINE Bot\n\n` +
    `คำสั่งที่ใช้ได้:\n` +
    `📋 สถานะ <รหัส> — ตรวจสอบสถานะเรื่องร้องเรียน\n` +
    `   ตัวอย่าง: สถานะ TK-001-2025\n\n` +
    `หากต้องการความช่วยเหลือเพิ่มเติม\n` +
    `ติดต่อ: โทร 056-280-366`,
};
