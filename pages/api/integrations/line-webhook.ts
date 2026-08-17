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
import { toBlurredMediaUrl } from '@/lib/complaintPrivacy';
import { getAdminGroupId } from '@/lib/lineSettings';
import {
  lineReply,
  formatStatusMessage,
  formatThaiDateTime,
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

  // ผู้ใช้เพิ่มเพื่อน — ถ้าเคยผูกเรื่องไว้ ตอบเรื่องล่าสุดทันที ไม่งั้นทักทายสอนวิธีใช้
  if (event.type === 'follow') {
    await handleFollow(event.replyToken, event.source?.userId);
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
    // กลุ่มเจ้าหน้าที่ที่ลงทะเบียน (groupId ตรงกับที่ตั้งค่า) เห็นข้อมูลเต็ม
    // ห้ามผูก lineUserId จากบริบทกลุ่ม — ไม่งั้นเจ้าหน้าที่เช็คเรื่องแล้วแย่งการแจ้งเตือนผู้ร้อง
    const staffView = isGroupChat && groupOrRoomId === (await getAdminGroupId());
    await handleStatusQuery(
      event.replyToken,
      isGroupChat ? undefined : userId,
      complaintId,
      staffView
    );
    return;
  }

  // ในกลุ่ม: ตอบเฉพาะคำสั่งข้างบน — ห้ามตอบ default ไม่งั้นบอทสแปมทุกข้อความที่คุยกัน
  if (isGroupChat) return;

  // คำสั่ง "เรื่องของฉัน" — รายการเรื่องที่ LINE นี้ผูกไว้
  if (/^(?:เรื่องของฉัน|เรื่องฉัน|my)$/i.test(text)) {
    await handleMyCases(event.replyToken, userId);
    return;
  }

  // ยืนยันเจ้าของเรื่องด้วยเบอร์ 4 ตัวท้าย: "TKC-690001 6789" — ย้ายการผูกแจ้งเตือน
  const rebindMatch = text.match(/^(?:สถานะ\s+)?tkc[-\s]?(\d{4,})\s+(\d{4})$/i);
  if (rebindMatch) {
    await handleRebind(event.replyToken, userId, `TKC-${rebindMatch[1]}`, rebindMatch[2]);
    return;
  }

  // แชท 1:1 — วางเลขเรื่องเปล่า ๆ ก็ได้ ไม่ต้องมีคำว่า "สถานะ" (รองรับ tkc690001 / TKC 690001)
  const bareMatch = text.match(/^tkc[-\s]?(\d{4,})$/i);
  if (bareMatch) {
    await handleStatusQuery(event.replyToken, userId, `TKC-${bareMatch[1]}`);
    return;
  }

  // เลขย่อ: ปี 2 หลัก + เลข 3 ตัวท้าย (69001 / 69-001 / 69 001)
  const shortMatch = text.match(/^(\d{2})[-\s]?(\d{3})$/);
  if (shortMatch) {
    await handleShortQuery(event.replyToken, userId, shortMatch[1], shortMatch[2]);
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
      text: `ส่งเลขที่เรื่องมาได้เลยครับ เช่น TKC-690001\nหรือเลขย่อ 69001 (ปี + 3 ตัวท้าย)\nระบบจะแสดงสถานะและแจ้งความคืบหน้าให้อัตโนมัติ\n\nหรือพิมพ์ "ช่วย" เพื่อดูคำสั่งทั้งหมด`,
    },
  ]);
}

const followGreeting = {
  type: 'text' as const,
  text:
    `สวัสดีครับ 🏛️ เทศบาลเมืองตาคลี\n\n` +
    `ต้องการติดตามเรื่องร้องเรียน ส่งเลขที่เรื่องมาได้เลย เช่น\n` +
    `TKC-690001 หรือเลขย่อ 69001 (ปี + 3 ตัวท้าย)\n\n` +
    `ระบบจะแจ้งความคืบหน้าให้อัตโนมัติทาง LINE นี้\n` +
    `พิมพ์ "ช่วย" เพื่อดูคำสั่งทั้งหมด`,
};

/**
 * เพิ่มเพื่อน: ถ้า LINE นี้เคยผูกเรื่องไว้ (เช่น เคย add แล้ว block แล้วกลับมา)
 * ตอบเรื่องล่าสุดของเขาทันที — ไม่เคยผูกค่อยทักทายแบบปกติ
 */
async function handleFollow(
  replyToken: string,
  userId: string | undefined
): Promise<void> {
  try {
    if (userId) {
      await dbConnect();
      const latest = await SubmittedReport.findOne({ lineUserId: userId })
        .sort({ updatedAt: -1 })
        .select('complaintId')
        .lean() as { complaintId?: string } | null;

      if (latest?.complaintId) {
        const result = await buildStatusMessages(latest.complaintId);
        if (result) {
          await lineReply(replyToken, [
            {
              type: 'text' as const,
              text:
                `ยินดีต้อนรับกลับครับ 🏛️ เทศบาลเมืองตาคลี\n\n` +
                `เรื่องล่าสุดที่คุณติดตามไว้ 👇\n` +
                `(พิมพ์ "เรื่องของฉัน" เพื่อดูเรื่องทั้งหมด)`,
            },
            ...result.messages,
          ].slice(0, 5));
          return;
        }
      }
    }
  } catch (err) {
    console.error('[LINE] Follow lookup error:', err);
  }
  await lineReply(replyToken, [followGreeting]);
}

/**
 * คำสั่ง "เรื่องของฉัน" — รายการเรื่องที่ผูกกับ LINE userId นี้ (ของตัวเองเท่านั้น)
 */
async function handleMyCases(
  replyToken: string,
  userId: string | undefined
): Promise<void> {
  try {
    if (!userId) {
      await lineReply(replyToken, [followGreeting]);
      return;
    }
    await dbConnect();

    const rows = await SubmittedReport.find({ lineUserId: userId })
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('complaintId status category createdAt')
      .lean() as unknown as Array<{
        complaintId: string;
        status?: string;
        category?: string;
        createdAt?: Date;
      }>;

    if (!rows.length) {
      await lineReply(replyToken, [
        {
          type: 'text',
          text:
            `ยังไม่มีเรื่องที่ผูกกับ LINE นี้ครับ\n\n` +
            `ส่งเลขที่เรื่องมาก่อน 1 ครั้ง เช่น TKC-690001\n` +
            `แล้วเรื่องนั้นจะผูกกับ LINE นี้อัตโนมัติ`,
        },
      ]);
      return;
    }

    if (rows.length === 1) {
      await handleStatusQuery(replyToken, undefined, rows[0].complaintId);
      return;
    }

    const lines = rows.map((r) => {
      const dateStr = formatThaiDateTime(r.createdAt, {
        day: 'numeric',
        month: 'short',
        year: '2-digit',
      });
      const done = r.status === 'ดำเนินการเสร็จสิ้น' ? '✅' : '🔄';
      return `${done} ${r.complaintId}\n   ${[r.category, dateStr].filter(Boolean).join(' · ')}`;
    });
    await lineReply(replyToken, [
      {
        type: 'text',
        text:
          `📁 เรื่องที่คุณติดตามไว้ (${rows.length} เรื่องล่าสุด)\n\n` +
          `${lines.join('\n')}\n\n` +
          `ส่งเลขเรื่องที่ต้องการเพื่อดูรายละเอียด`,
      },
    ]);
  } catch (err) {
    console.error('[LINE] My cases error:', err);
    await lineReply(replyToken, [
      { type: 'text', text: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' },
    ]);
  }
}

/**
 * สร้าง message array การ์ดสถานะจาก complaintId (การ์ด + รูป)
 * คืน null ถ้าไม่พบเรื่อง
 * - staffView (เฉพาะกลุ่มเจ้าหน้าที่ที่ลงทะเบียน): ชื่อผู้แจ้ง + รูปต้นฉบับ
 * - ฝั่งประชาชน: ไม่แสดงชื่อผู้แจ้งเลย (เท่ากับเว็บ /status), เรื่องลับเบลอรูป
 * - bindUserId: ผูกรับ push เฉพาะเมื่อเรื่องยังไม่มีคนผูก (first-come) —
 *   ถ้ามีคนผูกแล้ว bindRefused=true เพื่อให้ caller แนะนำวิธียืนยันตัวด้วยเบอร์ 4 ตัวท้าย
 */
async function buildStatusMessages(
  complaintId: string,
  opts: { bindUserId?: string; staffView?: boolean } = {}
): Promise<{ messages: ReturnType<typeof buildMessages>; bindRefused: boolean } | null> {
  const { bindUserId, staffView = false } = opts;
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

  if (!complaint) return null;

  // ผูก LINE userId เพื่อรับ push — first-come เท่านั้น กันคนอื่นเอาเลขมาแย่งการแจ้งเตือน
  let bindRefused = false;
  if (bindUserId && !staffView) {
    if (!complaint.lineUserId || complaint.lineUserId === bindUserId) {
      if (complaint.lineUserId !== bindUserId) {
        SubmittedReport.updateOne(
          { complaintId },
          { $set: { lineUserId: bindUserId } }
        ).catch((err) => console.error('[LINE] Failed to save lineUserId:', err));
      }
    } else {
      bindRefused = true;
    }
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

  // ชื่อผู้แจ้ง: ฝั่งประชาชน "ไม่แสดงเลย" — เท่ากับเว็บสาธารณะ /status
  // (API เว็บตัด fullName/phone ทิ้งที่ pages/api/complaints/index.js)
  // เลขเรื่องเป็นเลขรันไล่เดาได้ ใครพิมพ์เลขมาถามก็เห็นการ์ดนี้ ชื่อย่อก็ยังระบุตัวคนได้
  // เฉพาะกลุ่มเจ้าหน้าที่ที่ลงทะเบียนเท่านั้นที่เห็นชื่อ (เรื่องลับยังปิดชื่อเหมือนเดิม)
  const displayName = staffView
    ? complaint.isConfidential
      ? 'ไม่เปิดเผย'
      : complaint.fullName
    : undefined;

  const safeComplaint = {
    ...complaint,
    fullName: displayName,
    solution,
    note,
  };

  // รูปประกอบ: เรื่องปิดแล้วใช้รูปผลงาน, ไม่มีค่อย fallback รูปตอนแจ้ง
  // เรื่องลับฝั่งประชาชน: เบลอรูปแบบเดียวกับเว็บสาธารณะ
  let firstImage =
    solutionImage ?? complaint.images?.find((u) => u?.startsWith('https://')) ?? null;
  if (firstImage && complaint.isConfidential && !staffView) {
    firstImage = toBlurredMediaUrl(firstImage);
  }
  return { messages: buildMessages(formatStatusMessage(safeComplaint), firstImage), bindRefused };
}

async function handleStatusQuery(
  replyToken: string,
  bindUserId: string | undefined,
  complaintId: string,
  staffView = false
): Promise<void> {
  try {
    const result = await buildStatusMessages(complaintId, { bindUserId, staffView });
    if (!result) {
      await lineReply(replyToken, [notFoundMessage(complaintId)]);
      return;
    }
    const messages = [...result.messages];
    if (result.bindRefused) {
      messages.push({
        type: 'text',
        text:
          `ℹ️ เรื่องนี้มีผู้รับแจ้งเตือนทาง LINE อยู่แล้ว\n` +
          `หากคุณเป็นเจ้าของเรื่องและต้องการย้ายการแจ้งเตือนมาที่ LINE นี้\n` +
          `ส่ง: ${complaintId} ตามด้วยเบอร์โทร 4 ตัวท้าย\n` +
          `เช่น ${complaintId} 6789`,
      });
    }
    await lineReply(replyToken, messages.slice(0, 5));
  } catch (err) {
    console.error('[LINE] Status query error:', err);
    await lineReply(replyToken, [
      { type: 'text', text: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' },
    ]);
  }
}

/**
 * ย้ายการผูกแจ้งเตือนด้วยการยืนยันเบอร์โทร 4 ตัวท้าย: "TKC-690001 6789"
 * ตรงกับเบอร์ในเรื่อง → ผูก LINE นี้แทนที่เดิม (รองรับเปลี่ยนเครื่อง/ญาติติดตาม)
 */
async function handleRebind(
  replyToken: string,
  userId: string | undefined,
  complaintId: string,
  last4: string
): Promise<void> {
  try {
    if (!userId) return;
    await dbConnect();

    const complaint = await SubmittedReport.findOne({ complaintId })
      .select('complaintId phone')
      .lean() as { complaintId: string; phone?: string } | null;

    if (!complaint) {
      await lineReply(replyToken, [notFoundMessage(complaintId)]);
      return;
    }

    const phoneDigits = (complaint.phone || '').replace(/\D/g, '');
    if (!phoneDigits || phoneDigits.slice(-4) !== last4) {
      await lineReply(replyToken, [
        {
          type: 'text',
          text:
            `❌ เบอร์โทร 4 ตัวท้ายไม่ตรงกับข้อมูลในเรื่อง ${complaintId}\n\n` +
            `กรุณาใช้เบอร์เดียวกับที่กรอกตอนแจ้งเรื่อง\n` +
            `หากไม่แน่ใจ ติดต่อ 056-219-299`,
        },
      ]);
      return;
    }

    await SubmittedReport.updateOne({ complaintId }, { $set: { lineUserId: userId } });

    const result = await buildStatusMessages(complaintId);
    await lineReply(replyToken, [
      {
        type: 'text' as const,
        text: `✅ ยืนยันตัวตนสำเร็จ — ย้ายการแจ้งเตือนเรื่อง ${complaintId} มาที่ LINE นี้แล้ว`,
      },
      ...(result?.messages ?? []),
    ].slice(0, 5));
  } catch (err) {
    console.error('[LINE] Rebind error:', err);
    await lineReply(replyToken, [
      { type: 'text', text: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' },
    ]);
  }
}

/**
 * ค้นด้วยเลขย่อ: ปี 2 หลัก + เลข 3 ตัวท้าย (เช่น 69001 → TKC-69xxxx ที่ลงท้าย 001)
 * เจอเรื่องเดียว → ตอบการ์ดสถานะ; เจอหลายเรื่อง → แสดงรายการให้ส่งเลขเต็มกลับมา
 */
async function handleShortQuery(
  replyToken: string,
  lineUserId: string | undefined,
  yy: string,
  last3: string
): Promise<void> {
  try {
    await dbConnect();

    const matches = await SubmittedReport.find({
      complaintId: new RegExp(`^TKC-${yy}\\d*${last3}$`),
    })
      .sort({ createdAt: -1 })
      .limit(6)
      .select('complaintId category community createdAt')
      .lean() as unknown as Array<{
        complaintId: string;
        category?: string;
        community?: string;
        createdAt?: Date;
      }>;

    if (!matches.length) {
      await lineReply(replyToken, [
        {
          type: 'text',
          text:
            `❌ ไม่พบเรื่องร้องเรียนปี ${yy} ที่ลงท้ายด้วย ${last3}\n\n` +
            `กรุณาตรวจสอบเลขและลองใหม่ หรือส่งเลขเต็ม เช่น TKC-${yy}0${last3}`,
        },
      ]);
      return;
    }

    if (matches.length === 1) {
      await handleStatusQuery(replyToken, lineUserId, matches[0].complaintId);
      return;
    }

    // เจอหลายเรื่อง — แสดงรายการ (สูงสุด 5) ให้ผู้ใช้ส่งเลขเต็มกลับมา
    const lines = matches.slice(0, 5).map((m, i) => {
      const dateStr = formatThaiDateTime(m.createdAt, {
        day: 'numeric',
        month: 'short',
        year: '2-digit',
      });
      const extra = [m.category, m.community].filter(Boolean).join(' · ');
      return `${i + 1}. ${m.complaintId}\n   ${extra ? extra + ' · ' : ''}${dateStr}`;
    });
    await lineReply(replyToken, [
      {
        type: 'text',
        text:
          `พบ ${matches.length} เรื่องที่ลงท้ายด้วย ${last3} ในปี ${yy}\n\n` +
          `${lines.join('\n')}\n\n` +
          `กรุณาส่งเลขเต็มของเรื่องที่ต้องการ เช่น ${matches[0].complaintId}`,
      },
    ]);
  } catch (err) {
    console.error('[LINE] Short query error:', err);
    await lineReply(replyToken, [
      { type: 'text', text: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' },
    ]);
  }
}
