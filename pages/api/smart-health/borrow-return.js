import dbConnect from '@/lib/dbConnect';
import { ObjectId } from 'mongodb';

const dbName = 'db_takhli';
const collectionName = 'resoles_sm_health';
const menuCollectionName = 'menu_ob_health';
const personCollectionName = 'person_data';

export default async function handler(req, res) {
  try {
    const mongoose = await dbConnect();
    const db = mongoose.connection.useDb(dbName);

    if (req.method === 'POST') {
      // ----- Save feedback -----
      const feedbackCollection = db.collection('feedback_sm_health');
      const { ob_type, relation, satisfaction, suggestion } = req.body;

      if (!ob_type || !relation || !satisfaction || !suggestion) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await feedbackCollection.insertOne({
        ob_type,
        relation,
        satisfaction,
        suggestion,
        createdAt: new Date(),
      });

      return res.status(201).json({ success: true, id: result.insertedId });
    }

    if (req.method === 'GET') {
      // ----- Fetch borrow‑return data -----
      const collection = db.collection(collectionName);
      const menuCollection = db.collection(menuCollectionName);
      const personColl = db.collection(personCollectionName);

      const data = await collection.find({}).toArray();
      const menuItems = await menuCollection.find({}).toArray();

      const citizenIds = [
        ...new Set(
          data
            .map((e) => e.id_personal_use)
            .map((id) => String(id || '').replace(/\D/g, ''))
            .filter((id) => id.length === 13)
        ),
      ];
      const people =
        citizenIds.length > 0
          ? await personColl.find({ citizenId: { $in: citizenIds } }).toArray()
          : [];
      const byCitizen = Object.fromEntries(
        (people || []).map((p) => [String(p.citizenId || '').replace(/\D/g, ''), p])
      );

      const mappedData = data.map((entry) => {
        const entryCitizenId = String(entry.id_personal_use || '').replace(/\D/g, '');
        const matchedMenu = menuItems.find(
          (menu) =>
            String(menu.id_code_th || '') ===
            String(entry.index_id_tk || '').substring(0, 8)
        );
        const person = entryCitizenId
          ? byCitizen[entryCitizenId]
          : null;
        const resolvedCommunity =
          (entry.sm_community && String(entry.sm_community).trim()) ||
          (person?.community && String(person.community).trim()) ||
          null;
        const resolvedLocation =
          entry.sm_location?.lat != null && entry.sm_location?.lng != null
            ? {
                lat: Number(entry.sm_location.lat),
                lng: Number(entry.sm_location.lng),
              }
            : person?.location?.lat != null && person?.location?.lng != null
              ? {
                  lat: Number(person.location.lat),
                  lng: Number(person.location.lng),
                }
              : null;

        return {
          ...entry,
          image_icon: matchedMenu?.image_icon || null,
          shot_name: matchedMenu?.shot_name || null,
          personCommunity: person?.community || null,
          personFullName: person?.fullName || null,
          personLocation: person?.location || null,
          personId: person?._id?.toString?.() || null,
          resolvedCommunity,
          resolvedLocation,
        };
      });

      return res.status(200).json(mappedData);
    }

    if (req.method === 'PATCH') {
      const collection = db.collection(collectionName);
      const { id } = req.query;
      if (!id || !ObjectId.isValid(String(id))) {
        return res.status(400).json({ error: 'Missing or invalid id' });
      }

      const { community, location } = req.body || {};
      const $set = { updated_at: new Date() };

      if (community !== undefined) {
        if (community && String(community).trim()) {
          $set.sm_community = String(community).trim();
        } else {
          $set.sm_community = null;
        }
      }

      if (location !== undefined) {
        if (
          location &&
          Number.isFinite(Number(location.lat)) &&
          Number.isFinite(Number(location.lng))
        ) {
          $set.sm_location = {
            lat: Number(location.lat),
            lng: Number(location.lng),
          };
        } else {
          $set.sm_location = null;
        }
      }

      const result = await collection.updateOne(
        { _id: new ObjectId(String(id)) },
        { $set }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'ไม่พบรายการ' });
      }

      return res.status(200).json({ success: true, modifiedCount: result.modifiedCount });
    }

    // ----- Other HTTP methods -----
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Borrow‑return API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}