import clientPromise from '@/lib/mongodb'; // หรือ path ที่ใช้เชื่อมต่อ MongoDB

export default async function handler(req, res) {
  try {
    const client = await clientPromise;
    const db = client.db('test'); // หรือ 'db_takhli' ถ้าดึงจาก collection จริง
    const data = await db.collection('data_old_takhli67').find({}).toArray();
    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch data' });
  }
}