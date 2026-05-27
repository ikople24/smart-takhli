// POST /api/integrations/line-webhook
// รับ webhook event จาก LINE Platform
// ต้อง verify signature ด้วย LINE_CHANNEL_SECRET ก่อนประมวลผล
//
// ตั้งค่า webhook URL ใน LINE Developers Console:
//   https://your-domain/api/integrations/line-webhook
//
// ENV vars ที่ต้องมี:
//   LINE_CHANNEL_SECRET — ใช้ verify HMAC-SHA256 signature

import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

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

  // ประมวลผล events
  for (const event of body.events || []) {
    console.log(`[LINE Webhook] Event: ${event.type}`, {
      userId: event.source?.userId,
      groupId: event.source?.groupId,
    });

    // ตัวอย่าง: ถ้า user ส่งข้อความ "สถานะ <รหัส>" ตอบกลับสถานะเรื่องร้องเรียน
    if (event.type === 'message' && event.message?.type === 'text') {
      const text = event.message.text.trim();
      console.log(`[LINE Webhook] Message from ${event.source.userId}: "${text}"`);
      // TODO: implement reply logic — ดึงสถานะจาก MongoDB แล้ว reply
    }
  }

  // LINE ต้องการ 200 ทันที ไม่เช่นนั้นจะ retry
  return res.status(200).json({ success: true });
}
