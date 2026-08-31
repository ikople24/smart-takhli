// GET /api/analytics/satisfaction?days=90 (ค่าเริ่มต้น 90, สูงสุด 365)
// แนวโน้มความพึงพอใจรายสัปดาห์ (ISO week เวลา Bangkok) — สำหรับ Area Chart
// avgRating ต่อสัปดาห์นับแบบ "1 ผู้แจ้ง = 1 เสียง" เหมือน headline บนแดชบอร์ด
// (ไม่งั้นกราฟจะดิ่งค้านกับตัวเลขรวม) · count และ distribution เป็นจำนวนครั้งดิบ
// แบ่งถังใน JS แทน $isoWeek เพราะกติกาต่อผู้แจ้งต้อง join เบอร์โทร — ข้อมูล ~60 แถว/ช่วง ทำใน JS พอ
// (ของเดิมยังผสม $year ปฏิทินกับ $isoWeek ทำให้ label ช่วงปีใหม่เพี้ยน — isoWeekKey ใช้ ISO week-year ที่ถูก)

import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import { loadSatisfactionStats } from '@/lib/satisfaction/readStats';
import { computeFairStats } from '@/lib/satisfaction/fairStats';
import { isoWeekKey } from '@/lib/satisfaction/isoWeek';

// ชนิดข้อมูลอนุมานจาก JSDoc ของ readStats.js — ถ้ารูปข้อมูลเปลี่ยนที่นั่น ไฟล์นี้จะ compile ไม่ผ่านแทนที่จะพังตอนรัน
type RatingRow = Awaited<ReturnType<typeof loadSatisfactionStats>>['ratings'][number];
type Bucket = { year: number; week: number; label: string; rows: RatingRow[] };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const days = Math.min(Math.max(parseInt(req.query.days as string, 10) || 90, 1), 365);
  const from = new Date();
  from.setDate(from.getDate() - days);

  try {
    const { ratings, reports } = await loadSatisfactionStats({ from });

    // แบ่งถังรายสัปดาห์ แล้วใช้กติกาเดียวกับ headline ต่อถัง
    const buckets = new Map<string, Bucket>();
    for (const r of ratings) {
      // แถวที่ไม่มี/เพี้ยน createdAt ไม่เข้ากราฟ (กันถัง "NaN-WNaN" — schema มี default จึงแทบไม่เกิด)
      if (!r.createdAt || !Number.isFinite(new Date(r.createdAt).getTime())) continue;
      const k = isoWeekKey(r.createdAt);
      let b = buckets.get(k.label);
      if (!b) {
        b = { year: k.year, week: k.week, label: k.label, rows: [] };
        buckets.set(k.label, b);
      }
      b.rows.push(r);
    }
    const weeklyTrend = [...buckets.values()]
      .sort((a, b) => a.year - b.year || a.week - b.week)
      .map(({ year, week, label, rows }) => {
        const s = computeFairStats(rows, reports);
        return {
          year,
          week,
          label,
          avgRating: Math.round(s.averageRating * 100) / 100,
          count: s.totalRatings,
          reporters: s.reporters,
        };
      });

    // สรุปรายดาวของช่วงเวลา — จำนวนครั้งดิบ (ไม่ซ่อน 1 ดาว)
    const { ratingDistribution: distribution } = computeFairStats(ratings, reports);

    return res.status(200).json({
      success: true,
      weeklyTrend,
      distribution,
      days,
    });
  } catch (error) {
    console.error('satisfaction analytics error:', error);
    return res.status(500).json({ error: 'Failed to fetch satisfaction analytics' });
  }
}
