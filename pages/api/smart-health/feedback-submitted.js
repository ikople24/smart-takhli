import dbConnect from '@/lib/dbConnect';

const dbName = 'db_takhli';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const mongoose = await dbConnect();
    const db = mongoose.connection.useDb(dbName);
    const collection = db.collection('feedback_sm_health');

    const feedbacks = await collection.find({}).toArray();

    return res.status(200).json(feedbacks || []);
  } catch (error) {
    console.error('Error fetching feedback submissions:', error.message);
    // Return empty array instead of error to prevent frontend crash
    return res.status(200).json([]);
  }
}