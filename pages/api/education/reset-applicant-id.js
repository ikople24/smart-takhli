import dbConnect from "@/lib/dbConnect";
import EducationRegister from "@/models/EducationRegisterModel";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    await dbConnect();

    // ดึงข้อมูลทั้งหมดเรียงตาม createdAt
    const allRecords = await EducationRegister.find({}).sort({ createdAt: 1 });
    
    if (allRecords.length === 0) {
      return res.status(200).json({ 
        message: 'ไม่มีข้อมูลในระบบ',
        updatedCount: 0 
      });
    }

    // อัปเดต applicantId ใหม่ตามลำดับ (ทีละรายการเพื่อหลีกเลี่ยง duplicate key error)
    const updatedRecords = [];
    
    for (let i = 0; i < allRecords.length; i++) {
      const record = allRecords[i];
      const newApplicantId = `TKC-${(i + 1).toString().padStart(3, '0')}`;
      
      try {
        const updatedRecord = await EducationRegister.findByIdAndUpdate(
          record._id,
          { applicantId: newApplicantId },
          { new: true }
        );
        updatedRecords.push(updatedRecord);
        console.log(`✅ อัปเดต ${record.name} จาก ${record.applicantId} เป็น ${newApplicantId}`);
      } catch (error) {
        console.error(`❌ เกิดข้อผิดพลาดในการอัปเดต ${record.name}:`, error.message);
        throw error;
      }
    }

    console.log(`✅ รีเซ็ต applicantId สำเร็จ: อัปเดต ${updatedRecords.length} รายการ`);

    return res.status(200).json({
      message: `รีเซ็ต applicantId สำเร็จ`,
      updatedCount: updatedRecords.length,
      records: updatedRecords.map(record => ({
        _id: record._id,
        applicantId: record.applicantId,
        name: record.name
      }))
    });

  } catch (error) {
    console.error('❌ Error resetting applicantId:', error);
    return res.status(500).json({
      message: 'เกิดข้อผิดพลาดในการรีเซ็ต applicantId',
      error: error.message
    });
  }
} 