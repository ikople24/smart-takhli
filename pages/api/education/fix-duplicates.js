import dbConnect from "@/lib/dbConnect";
import EducationRegister from "@/models/EducationRegisterModel";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    await dbConnect();

    console.log('🔄 Starting duplicate detection...');

    // 1. หาข้อมูลซ้ำตามชื่อและเบอร์โทร
    const duplicates = await EducationRegister.aggregate([
      {
        $group: {
          _id: {
            name: "$name",
            phone: "$phone"
          },
          count: { $sum: 1 },
          docs: { $push: "$$ROOT" }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    console.log(`📊 Found ${duplicates.length} duplicate groups`);

    let deletedCount = 0;

    // 2. ลบข้อมูลซ้ำ (เก็บข้อมูลแรกไว้)
    for (const group of duplicates) {
      const docs = group.docs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
      // ลบข้อมูลที่เหลือ (ไม่ใช่ข้อมูลแรก)
      for (let i = 1; i < docs.length; i++) {
        await EducationRegister.findByIdAndDelete(docs[i]._id);
        deletedCount++;
      }
    }

    // 3. นับจำนวนข้อมูลทั้งหมด
    const totalCount = await EducationRegister.countDocuments();

    return res.status(200).json({
      message: 'จัดการข้อมูลซ้ำสำเร็จ',
      results: {
        duplicateGroups: duplicates.length,
        deletedRecords: deletedCount
      },
      summary: {
        totalRecords: totalCount
      }
    });

  } catch (err) {
    console.error('❌ API error:', err);
    return res.status(500).json({ 
      message: 'Server error', 
      error: err.message
    });
  }
}
