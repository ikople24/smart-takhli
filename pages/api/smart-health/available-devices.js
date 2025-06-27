import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = 'db_takhli';

let cachedClient = null;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    if (!cachedClient) {
      cachedClient = await MongoClient.connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    }

    const db = cachedClient.db(dbName);
    const collection = db.collection('register_object_health');
    const menuCollection = db.collection('menu_ob_health');

    const availableDevices = await collection.find({ ob_status: true }).toArray();
    const menuItems = await menuCollection.find().toArray();
    const devicesWithType = availableDevices.map(device => {
      const matchedType = menuItems.find(menu => menu.id_code_th === device.index_id_tk?.substring(0, 8));
      return {
        ...device,
        type_label: matchedType?.label || '',
        display_label: `${device.index_id_tk} ${matchedType?.shot_name || ''}`,
      };
    });

    res.status(200).json(devicesWithType);
  } catch (error) {
    console.error('Failed to fetch available devices:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
