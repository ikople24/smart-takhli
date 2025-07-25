import dbConnect from "@/lib/dbConnect";
import EducationRegister from "@/models/EducationRegisterModel";

export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    await dbConnect();

    const {
      prefix,
      educationLevel,
      fullName,
      address,
      phone,
      note,
      image,
      location
    } = req.body;

    if (!fullName || !image || !location?.lat) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const doc = await EducationRegister.create({
      prefix: prefix || '',
      educationLevel: educationLevel || '',
      name: fullName,
      address: address || '',
      phone: phone || '',
      note: note || '',
      imageUrl: image,
      location: {
        lat: location.lat,
        lng: location.lng,
      },
    });

    return res.status(200).json({ message: 'Success', id: doc._id });
  } catch (err) {
    console.error('❌ API error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
}