// lib/lineNotify.ts
// LINE Messaging API wrapper — ส่งข้อความแจ้งเตือนไปยัง LINE OA ของเทศบาล
// Phase 2: LINE OA Integration
//
// ENV vars ที่ต้องตั้งใน .env.local:
//   LINE_CHANNEL_ACCESS_TOKEN  — Channel Access Token จาก LINE Developers Console
//   LINE_CHANNEL_SECRET        — Channel Secret สำหรับ verify webhook signature
//   LINE_OA_USER_ID            — userId ของ OA หรือ groupId ที่ต้องการส่ง (optional)
//
// ดู: https://developers.line.biz/en/docs/messaging-api/

const LINE_API_BASE = 'https://api.line.me/v2/bot';
const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';

// ---------- Types ----------

export interface LineTextMessage {
  type: 'text';
  text: string;
}

export interface LineFlexMessage {
  type: 'flex';
  altText: string;
  contents: Record<string, unknown>; // Flex Message container
}

export type LineMessage = LineTextMessage | LineFlexMessage;

interface PushPayload {
  to: string;
  messages: LineMessage[];
}

interface MulticastPayload {
  to: string[];
  messages: LineMessage[];
}

// ---------- Core send functions ----------

/**
 * ส่งข้อความไปยัง userId / groupId เดียว
 */
export async function linePushMessage(to: string, messages: LineMessage[]): Promise<boolean> {
  if (!TOKEN) {
    console.warn('[LINE] LINE_CHANNEL_ACCESS_TOKEN is not set — skipping push');
    return false;
  }

  const payload: PushPayload = { to, messages };

  try {
    const res = await fetch(`${LINE_API_BASE}/message/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[LINE] Push failed:', res.status, err);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[LINE] Push error:', err);
    return false;
  }
}

/**
 * ส่งข้อความไปยังหลาย userId พร้อมกัน (สูงสุด 500 users)
 */
export async function lineMulticast(to: string[], messages: LineMessage[]): Promise<boolean> {
  if (!TOKEN || to.length === 0) return false;

  const payload: MulticastPayload = { to, messages };

  try {
    const res = await fetch(`${LINE_API_BASE}/message/multicast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[LINE] Multicast failed:', res.status, err);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[LINE] Multicast error:', err);
    return false;
  }
}

// ---------- Pre-built message templates ----------

/**
 * แจ้งเตือนสถานะเรื่องร้องเรียนเปลี่ยน
 */
export function buildComplaintStatusMessage(opts: {
  complaintId: string;
  fullName: string;
  oldStatus: string;
  newStatus: string;
  appUrl?: string;
}): LineFlexMessage {
  const { complaintId, fullName, oldStatus, newStatus, appUrl } = opts;
  const statusEmoji: Record<string, string> = {
    'เสร็จสิ้น': '✅',
    'อยู่ระหว่างดำเนินการ': '🔄',
    'รอการตรวจสอบ': '🔍',
    'รอการอนุมัติ': '⏳',
    'ยกเลิก': '❌',
  };
  const emoji = statusEmoji[newStatus] || '📋';

  return {
    type: 'flex',
    altText: `${emoji} สถานะเรื่องร้องเรียนของ ${fullName} เปลี่ยนเป็น ${newStatus}`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#5B4FCF',
        contents: [
          {
            type: 'text',
            text: `${emoji} อัปเดตสถานะ`,
            color: '#FFFFFF',
            weight: 'bold',
            size: 'md',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: `เรื่องร้องเรียนของ ${fullName}`,
            weight: 'bold',
            size: 'sm',
            wrap: true,
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'จาก', size: 'xs', color: '#888888', flex: 1 },
              { type: 'text', text: oldStatus, size: 'xs', flex: 3, wrap: true },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'เป็น', size: 'xs', color: '#888888', flex: 1 },
              {
                type: 'text',
                text: newStatus,
                size: 'xs',
                flex: 3,
                color: '#5B4FCF',
                weight: 'bold',
                wrap: true,
              },
            ],
          },
          {
            type: 'text',
            text: `รหัส: ${complaintId.slice(-8).toUpperCase()}`,
            size: 'xxs',
            color: '#AAAAAA',
          },
        ],
      },
      footer: appUrl
        ? {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'uri',
                  label: 'ดูรายละเอียด',
                  uri: appUrl,
                },
                style: 'primary',
                color: '#5B4FCF',
                height: 'sm',
              },
            ],
          }
        : undefined,
    },
  };
}

/**
 * แจ้งเตือนเจ้าหน้าที่ว่าได้รับมอบหมายงาน
 */
export function buildAssignmentMessage(opts: {
  officerName: string;
  complaintCategory: string;
  complaintDetail: string;
  complaintId: string;
  appUrl?: string;
}): LineTextMessage {
  const { officerName, complaintCategory, complaintDetail, complaintId, appUrl } = opts;
  const short = complaintDetail?.slice(0, 80) || '';
  return {
    type: 'text',
    text: [
      `📋 มอบหมายงานใหม่`,
      `เจ้าหน้าที่: ${officerName}`,
      `หมวดหมู่: ${complaintCategory || 'ทั่วไป'}`,
      `รายละเอียด: ${short}${short.length >= 80 ? '...' : ''}`,
      `รหัส: ${complaintId.slice(-8).toUpperCase()}`,
      appUrl ? `ลิงก์: ${appUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}
