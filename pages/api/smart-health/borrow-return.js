import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = 'db_takhli';
const collectionName = 'resoles_sm_health';
const menuCollectionName = 'menu_ob_health';

export default async function handler(req, res) {
  try {
    const client = await MongoClient.connect(uri);
    const db = client.db(dbName);

    if (req.method === 'POST') {
      // ----- Save feedback -----
      const feedbackCollection = db.collection('feedback_sm_health');
      const { ob_type, relation, satisfaction, suggestion } = req.body;

      if (!ob_type || !relation || !satisfaction || !suggestion) {
        client.close();
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await feedbackCollection.insertOne({
        ob_type,
        relation,
        satisfaction,
        suggestion,
        createdAt: new Date(),
      });

      client.close();
      return res.status(201).json({ success: true, id: result.insertedId });
    }

    if (req.method === 'GET') {
      // ----- Fetch borrow‑return data -----
      const collection = db.collection(collectionName);
      const menuCollection = db.collection(menuCollectionName);

      const data = await collection.find({}).toArray();
      const menuItems = await menuCollection.find({}).toArray();

      const mappedData = data.map((entry) => {
        const matchedMenu = menuItems.find(
          (menu) => menu.id_code_th === entry.index_id_tk?.substring(0, 8)
        );
        return {
          ...entry,
          image_icon: matchedMenu?.image_icon || null,
          shot_name: matchedMenu?.shot_name || null,
        };
      });

      client.close();
      return res.status(200).json(mappedData);
    }

    // ----- Other HTTP methods -----
    client.close();
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Borrow‑return API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}