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
    // ตรวจสอบ MongoDB connection
    try {
      await dbConnect();
    } catch (dbError) {
      console.error('❌ Database connection error:', dbError);
      return res.status(500).json({ 
        message: 'Database connection failed. Please check your MongoDB connection.',
        error: dbError.message 
      });
    }

    const {
      prefix,
      educationLevel,
      fullName,
      address,
      actualAddress,
      phone,
      note,
      schoolName,
      gradeLevel,
      gpa,
      image,
      location,
      housingStatus,
      householdMembers,
      annualIncome,
      familyStatus
    } = req.body;

    console.log('📝 Received data:', { 
      prefix, 
      educationLevel, 
      fullName, 
      address, 
      actualAddress,
      phone, 
      note, 
      schoolName,
      gradeLevel,
      gpa,
      image, 
      location,
      housingStatus,
      householdMembers,
      annualIncome,
      familyStatus
    });

    if (!fullName || !image || !location?.lat) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        required: ['fullName', 'image', 'location.lat'],
        received: { fullName: !!fullName, image: !!image, location: !!location }
      });
    }

    const count = await EducationRegister.countDocuments();
    const applicantId = `TKC-${(count + 1).toString().padStart(3, '0')}`;

    const doc = await EducationRegister.create({
      applicantId,
      prefix: prefix || '',
      educationLevel: educationLevel || '',
      name: fullName,
      address: address || '',
      actualAddress: actualAddress || '',
      phone: phone || '',
      note: note || '',
      schoolName: schoolName || '',
      gradeLevel: gradeLevel || '',
      gpa: gpa ? parseFloat(gpa) : null,
      imageUrl: image,
      location: {
        lat: location.lat,
        lng: location.lng,
      },
      housingStatus: housingStatus || 'ไม่ระบุ',
      householdMembers: householdMembers || 1,
      annualIncome: annualIncome || 0,
      familyStatus: familyStatus || [],
      incomeSource: [],
      receivedScholarship: []
    });

    console.log('✅ Data saved successfully:', doc._id);

    // ✅ แจ้งเตือนไปยัง n8n webhook
    try {
      await fetch("https://primary-production-a1769.up.railway.app/webhook/sm-school", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantId,
          name: `${prefix || ''} ${fullName}`.trim(),
          educationLevel,
          phone,
          address,
          note,
          image,
          location,
        }),
      });
    } catch (e) {
      console.error("n8n notification failed:", e);
    }

    return res.status(200).json({ message: 'Success', id: doc._id });
  } catch (err) {
    console.error('❌ API error:', err);
    return res.status(500).json({ 
      message: 'Server error', 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}