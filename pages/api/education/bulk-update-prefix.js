import dbConnect from "@/lib/dbConnect";
import EducationRegister from "@/models/EducationRegisterModel";
import { requireAuth } from "@/lib/requireAuth";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const auth = await requireAuth(req, res, ['admin', 'superadmin']);
  if (!auth) return;

  try {
    await dbConnect();

    console.log('🔄 Starting bulk prefix update...');

    // แก้ไขคำนำหน้า "ดช." เป็น "ด.ช."
    const result1 = await EducationRegister.updateMany(
      { prefix: "ดช." },
      { $set: { prefix: "ด.ช." } }
    );
    console.log(`✅ แก้ไข "ดช." เป็น "ด.ช." จำนวน ${result1.modifiedCount} รายการ`);

    // แก้ไขคำนำหน้า "ดญ." เป็น "ด.ญ."
    const result2 = await EducationRegister.updateMany(
      { prefix: "ดญ." },
      { $set: { prefix: "ด.ญ." } }
    );
    console.log(`✅ แก้ไข "ดญ." เป็น "ด.ญ." จำนวน ${result2.modifiedCount} รายการ`);

    // นับจำนวนข้อมูลทั้งหมด
    const totalCount = await EducationRegister.countDocuments();
    const countByPrefix = await EducationRegister.aggregate([
      { $group: { _id: "$prefix", count: { $sum: 1 } } }
    ]);

    console.log('📊 สรุปข้อมูล:', { totalCount, countByPrefix });

    return res.status(200).json({
      message: 'แก้ไขคำนำหน้าสำเร็จ',
      results: {
        'ดช. → ด.ช.': {
          matchedCount: result1.matchedCount,
          modifiedCount: result1.modifiedCount
        },
        'ดญ. → ด.ญ.': {
          matchedCount: result2.matchedCount,
          modifiedCount: result2.modifiedCount
        }
      },
      summary: {
        totalRecords: totalCount,
        prefixDistribution: countByPrefix
      }
    });

  } catch (err) {
    console.error('❌ API error:', err);
    return res.status(500).json({ 
      message: 'Server error', 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
} 