

import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = 'db_takhli';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const client = await MongoClient.connect(uri);
    const db = client.db(dbName);
    const collection = db.collection('feedback_sm_health');

    const feedbacks = await collection.find({}).toArray();

    client.close();
    return res.status(200).json(feedbacks);
  } catch (error) {
    console.error('Error fetching feedback submissions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}