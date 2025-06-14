// /pages/api/mongo-direct-insert.js

import clientPromise from '@/lib/mongodb';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { collection, document } = req.body;
    const client = await clientPromise;
    const db = client.db('test'); // ใช้ default DB หรือระบุชื่อก็ได้ เช่น db('test')
    const result = await db.collection(collection).insertOne(document);
    res.status(200).json({ success: true, insertedId: result.insertedId });
  } catch (err) {
    console.error('❌ Error in mongo-direct-insert:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}