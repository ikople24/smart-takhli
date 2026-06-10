// GET /api/geojson-features
// Public read-only endpoint — คืนค่า active GeoJSON features ของ app นี้
// ไม่ต้องการ auth เพราะข้อมูลขอบเขตพื้นที่ไม่ใช่ข้อมูลส่วนบุคคล
// (write/delete ยังอยู่ที่ /api/admin/geojson-features ซึ่งป้องกันด้วย admin auth)

import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/dbConnect';
import GeoJSONFeature from '@/models/GeoJSONFeature';

const APP_ID = process.env.NEXT_PUBLIC_APP_ID || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await dbConnect();

    const features = await GeoJSONFeature.find({ appId: APP_ID, active: true })
      .select('name featureType geometry properties color active')
      .sort({ createdAt: -1 })
      .lean();

    // Cache 5 นาที — ข้อมูลขอบเขตเปลี่ยนไม่บ่อย
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ success: true, features });
  } catch (e: unknown) {
    return res.status(500).json({ success: false, message: (e as Error).message });
  }
}
