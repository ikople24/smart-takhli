// POST /api/integrations/line-webhook
// รับ webhook event จาก LINE Platform
// ต้อง verify signature ด้วย LINE_CHANNEL_SECRET ก่อนประมวลผล
//
// ตั้งค่า webhook URL ใน LINE Developers Console:
//   https://your-domain/api/integrations/line-webhook
//
// ENV vars ที่ต้องมี:
//   LINE_CHANNEL_SECRET        — ใช้ verify HMAC-SHA256 signature
//   LINE_CHANNEL_ACCESS_TOKEN  — ใช้ส่ง reply/push message

import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import dbConnect from '@/lib/dbConnect';
import SubmittedReport from '@/models/SubmittedReport';
import {
  lineReply,
  formatStatusMessage,
  notFoundMessage,
  helpMessage,
  buildMessages,
} from '@/lib/lineMessaging';

// Next.js ต้อง parse raw body เพื่อ verify signature
export const config = {
  api: { bodyParser: false },
};

async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifyLineSignature(body: Buffer, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('SHA256', secret);
  hmac.update(body);
  const expected = hmac.digest('base64');
  return expected === signature;
}

// ---------- Types ----------

interface LineEventSource {
  type: 'user' | 'group' | 'room';
  userId?: string;
  groupId?: string;
  roomId?: string;
}

interface LineTextContent {
  type: 'text';
  text: string;
}

interface LineEvent {
  type: string;
  replyToken?: string;
  source: LineEventSource;
  message?: LineTextContent;
  timestamp: number;
}

interface LineWebhookBody {
  destination: string;
  events: LineEvent[];
}

// ---------- Handler ----------

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.LINE_CHANNEL_SECRET || '';
  const signature = req.headers['x-line-signature'] as string;

  if (!signature) {
    return res.status(400).json({ error: 'Missing LINE signature' });
  }

  // อ่าน raw body เพื่อ verify
  const rawBody = await getRawBody(req);

  if (secret && !verifyLineSignature(rawBody, signature, secret)) {
    console.warn('[LINE Webhook] Invalid signature — request rejected');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let body: LineWebhookBody;
  try {
    body = JSON.parse(rawBody.toString());
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  // ประมวลผล events (fire-and-forget เพื่อ return 200 เร็ว)
  Promise.all(body.events?.map(handleEvent) || []).catch((err) => {
    console.error('[LINE Webhook] Event processing error:', err);
  });

  // LINE ต้องการ 200 ทันที ไม่เช่นนั้นจะ retry
  return res.status(200).json({ success: true });
}

// ---------- Event processing ----------

async function handleEvent(event: LineEvent): Promise<void> {
  if (event.type !== 'message' || event.message?.type !== 'text') return;
  if (!event.replyToken) return;

  const userId = event.source?.userId;
  const text = event.message.text.trim();

  // คำสั่ง: "สถานะ <รหัส>" หรือ "status <รหัส>"
  const statusMatch = text.match(/^(?:สถานะ|status)\s+(.+)$/i);

  if (statusMatch) {
    const complaintId = statusMatch[1].trim().toUpperCase();
    await handleStatusQuery(event.replyToken, userId, complaintId);
    return;
  }

  // ช่วยเหลือ / welcome
  if (/^(?:ช่วย|help|สวัสดี|hello|hi|เริ่ม|start)$/i.test(text)) {
    await lineReply(event.replyToken, [helpMessage]);
    return;
  }

  // default: แนะนำวิธีใช้
  await lineReply(event.replyToken, [
    {
      type: 'text',
      text: `พิมพ์ "สถานะ <รหัสเรื่อง>" เพื่อตรวจสอบสถานะ\nเช่น: สถานะ TK-001-2025\n\nหรือพิมพ์ "ช่วย" เพื่อดูคำสั่งทั้งหมด`,
    },
  ]);
}

async function handleStatusQuery(
  replyToken: string,
  lineUserId: string | undefined,
  complaintId: string
): Promise<void> {
  try {
    await dbConnect();

    const complaint = await SubmittedReport.findOne({ complaintId })
      .select('complaintId fullName category status updatedAt lineUserId isConfidential images')
      .lean() as {
        complaintId: string;
        fullName?: string;
        category?: string;
        status: string;
        updatedAt?: Date;
        lineUserId?: string;
        isConfidential?: boolean;
        images?: string[];
      } | null;

    if (!complaint) {
      await lineReply(replyToken, [notFoundMessage(complaintId)]);
      return;
    }

    // บันทึก LINE userId ไว้กับเรื่องร้องเรียน (เพื่อส่ง push notification เมื่อสถานะเปลี่ยน)
    if (lineUserId && complaint.lineUserId !== lineUserId) {
      SubmittedReport.updateOne(
        { complaintId },
        { $set: { lineUserId } }
      ).catch((err) => console.error('[LINE] Failed to save lineUserId:', err));
    }

    // ซ่อนชื่อสำหรับเรื่องลับ (PDPA)
    const safeComplaint = {
      ...complaint,
      fullName: complaint.isConfidential ? 'ไม่เปิดเผย' : complaint.fullName,
    };

    // ส่งภาพแรกพร้อมกับ status card (ถ้ามี)
    const firstImage = complaint.images?.find((u) => u?.startsWith('https://')) ?? null;
    await lineReply(replyToken, buildMessages(formatStatusMessage(safeComplaint), firstImage));
  } catch (err) {
    console.error('[LINE] Status query error:', err);
    await lineReply(replyToken, [
      { type: 'text', text: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' },
    ]);
  }
}
