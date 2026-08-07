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
import Assignment from '@/models/Assignment';
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
  if (!event.replyToken) return;

  const isGroupChat = event.source?.type === 'group' || event.source?.type === 'room';
  const groupOrRoomId = event.source?.groupId || event.source?.roomId;

  // บอทถูกเชิญเข้ากลุ่ม — ตอบ groupId ให้เอาไปตั้ง LINE_ADMIN_GROUP_ID
  if (event.type === 'join') {
    if (groupOrRoomId) {
      await lineReply(event.replyToken, [
        {
          type: 'text',
          text:
            `🆔 Group ID ของกลุ่มนี้คือ\n${groupOrRoomId}\n\n` +
            `นำไปตั้งค่า LINE_ADMIN_GROUP_ID ในระบบ\nเพื่อรับแจ้งเตือนเรื่องร้องเรียนเข้ากลุ่มนี้`,
        },
      ]);
    }
    return;
  }

  // ผู้ใช้เพิ่มเพื่อน — ทักทาย + สอนวิธีติดตามเรื่อง
  if (event.type === 'follow') {
    await lineReply(event.replyToken, [
      {
        type: 'text',
        text:
          `สวัสดีครับ 🏛️ เทศบาลเมืองตาคลี\n\n` +
          `ต้องการติดตามเรื่องร้องเรียน ส่งเลขที่เรื่องมาได้เลย เช่น\n` +
          `TKC-690001\n\n` +
          `ระบบจะแจ้งความคืบหน้าให้อัตโนมัติทาง LINE นี้\n` +
          `พิมพ์ "ช่วย" เพื่อดูคำสั่งทั้งหมด`,
      },
    ]);
    return;
  }

  if (event.type !== 'message' || event.message?.type !== 'text') return;

  const userId = event.source?.userId;
  const text = event.message.text.trim();

  // คำสั่ง "groupid" — ขอ groupId ของกลุ่มปัจจุบัน
  if (/^groupid$/i.test(text) && groupOrRoomId) {
    await lineReply(event.replyToken, [
      { type: 'text', text: `🆔 Group ID ของกลุ่มนี้คือ\n${groupOrRoomId}` },
    ]);
    return;
  }

  // คำสั่ง: "สถานะ <รหัส>" หรือ "status <รหัส>"
  const statusMatch = text.match(/^(?:สถานะ|status)\s+(.+)$/i);

  if (statusMatch) {
    const complaintId = statusMatch[1].trim().toUpperCase();
    await handleStatusQuery(event.replyToken, userId, complaintId);
    return;
  }

  // ในกลุ่ม: ตอบเฉพาะคำสั่งข้างบน — ห้ามตอบ default ไม่งั้นบอทสแปมทุกข้อความที่คุยกัน
  if (isGroupChat) return;

  // แชท 1:1 — วางเลขเรื่องเปล่า ๆ ก็ได้ ไม่ต้องมีคำว่า "สถานะ" (รองรับ tkc690001 / TKC 690001)
  const bareMatch = text.match(/^tkc[-\s]?(\d{4,})$/i);
  if (bareMatch) {
    await handleStatusQuery(event.replyToken, userId, `TKC-${bareMatch[1]}`);
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
      text: `ส่งเลขที่เรื่องมาได้เลยครับ เช่น TKC-690001\nระบบจะแสดงสถานะและแจ้งความคืบหน้าให้อัตโนมัติ\n\nหรือพิมพ์ "ช่วย" เพื่อดูคำสั่งทั้งหมด`,
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
        _id: unknown;
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

    // เรื่องที่ปิดงานแล้ว: ใช้รูปผลงานหลังแก้ไข + แสดงรายละเอียดการแก้ไขจาก Assignment ล่าสุด
    let solution: string[] | undefined;
    let note: string | undefined;
    let solutionImage: string | null = null;
    if (complaint.status === 'ดำเนินการเสร็จสิ้น') {
      const assignment = await Assignment.findOne({ complaintId: complaint._id })
        .sort({ assignedAt: -1 })
        .select('solution solutionImages note')
        .lean() as { solution?: string[]; solutionImages?: string[]; note?: string } | null;
      if (assignment) {
        solution = assignment.solution;
        note = assignment.note;
        solutionImage =
          assignment.solutionImages?.find((u) => u?.startsWith('https://')) ?? null;
      }
    }

    // ซ่อนชื่อสำหรับเรื่องลับ (PDPA)
    const safeComplaint = {
      ...complaint,
      fullName: complaint.isConfidential ? 'ไม่เปิดเผย' : complaint.fullName,
      solution,
      note,
    };

    // รูปประกอบ: เรื่องปิดแล้วใช้รูปผลงาน, ไม่มีค่อย fallback รูปตอนแจ้ง
    const firstImage =
      solutionImage ?? complaint.images?.find((u) => u?.startsWith('https://')) ?? null;
    await lineReply(replyToken, buildMessages(formatStatusMessage(safeComplaint), firstImage));
  } catch (err) {
    console.error('[LINE] Status query error:', err);
    await lineReply(replyToken, [
      { type: 'text', text: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' },
    ]);
  }
}
