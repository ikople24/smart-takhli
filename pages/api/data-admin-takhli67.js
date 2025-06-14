// File: /pages/api/data-admin-takhli67.js

import clientPromise from '@/lib/mongodb';

export default async function handler(req, res) {
  try {
    const client = await clientPromise;
    const db = client.db('test');
    const collection = db.collection('data_admin_takhli67');

    const data = await collection.find({}).toArray();
    res.status(200).json(data);
  } catch (err) {
    console.error('❌ Error fetching data_admin_takhli67:', err);
    res.status(500).json({ error: 'Failed to fetch data_admin_takhli67' });
  }
}
