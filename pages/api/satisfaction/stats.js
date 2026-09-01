// GET /api/satisfaction/stats — สถิติรวมสำหรับการ์ด "ความพึงพอใจ" บน /admin/dashboard
// averageRating นับแบบ "1 ผู้แจ้ง = 1 เสียง" (lib/satisfaction/fairStats.js) ·
// totalRatings / rawAverage / ratingDistribution / bySource เป็นค่าดิบ (จำนวนครั้ง) เพื่อความโปร่งใส
// endpoint นี้เปิดสาธารณะ — คืนแค่ตัวเลขรวม ห้ามคืนคีย์ผู้แจ้ง/เบอร์โทร
import { loadSatisfactionStats } from '@/lib/satisfaction/readStats';
import { computeFairStats } from '@/lib/satisfaction/fairStats';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { ratings, reports } = await loadSatisfactionStats();
    return res.status(200).json(computeFairStats(ratings, reports));
  } catch (err) {
    console.error('❌ Failed to fetch satisfaction stats:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch satisfaction stats' });
  }
}
