import dbConnect from '@/lib/dbConnect';
import Activity from '@/models/Activity';
import { requireActivitiesAdmin } from './_auth';

export default async function handler(req, res) {
  try {
    await dbConnect();
  } catch (error) {
    console.error('Database connection error:', error);
    return res.status(500).json({ success: false, message: 'Database connection failed' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ success: false, message: 'Activity ID is required' });
  }

  switch (req.method) {
    case 'GET':
      try {
        const activity = await Activity.findById(id);
        
        if (!activity) {
          return res.status(404).json({ success: false, message: 'Activity not found' });
        }

        res.status(200).json({
          success: true,
          data: activity
        });
      } catch (error) {
        console.error('Error fetching activity:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
      break;

    case 'PUT':
      try {
        const auth = await requireActivitiesAdmin(req);
        if (!auth.ok) {
          return res.status(auth.status).json({ success: false, message: auth.message });
        }

        const { name, description, startDate, endDate, isActive, isDefault } = req.body;

        // Validation
        if (!name || !startDate || !endDate) {
          return res.status(400).json({ 
            success: false, 
            message: 'กรุณากรอกข้อมูลให้ครบถ้วน' 
          });
        }

        // อัปเดตรูปเฉพาะเมื่อ client ส่ง images มา (กันลบรูปทิ้งโดยไม่ตั้งใจ)
        const updateDoc = {
          name: name.trim(),
          description: description?.trim() || '',
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          isActive: isActive !== undefined ? isActive : true,
          isDefault: isDefault || false
        };
        if (Array.isArray(req.body.images)) {
          const images = req.body.images.filter((u) => typeof u === "string");
          if (images.length > 6) {
            return res.status(400).json({ success: false, message: "อัปโหลดรูปได้สูงสุด 6 รูป" });
          }
          updateDoc.images = images;
        }

        // ถ้าเป็น default activity ให้ยกเลิก default ของกิจกรรมอื่นๆ ก่อน
        if (isDefault) {
          await Activity.updateMany(
            { _id: { $ne: id }, isDefault: true },
            { isDefault: false }
          );
        }

        const activity = await Activity.findByIdAndUpdate(
          id,
          updateDoc,
          { new: true, runValidators: true }
        );

        if (!activity) {
          return res.status(404).json({ success: false, message: 'Activity not found' });
        }

        res.status(200).json({
          success: true,
          message: 'อัปเดตกิจกรรมเรียบร้อยแล้ว',
          data: activity
        });
      } catch (error) {
        console.error('Error updating activity:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
      break;

    case 'DELETE':
      try {
        const auth = await requireActivitiesAdmin(req);
        if (!auth.ok) {
          return res.status(auth.status).json({ success: false, message: auth.message });
        }

        const activity = await Activity.findByIdAndDelete(id);
        
        if (!activity) {
          return res.status(404).json({ success: false, message: 'Activity not found' });
        }

        res.status(200).json({
          success: true,
          message: 'ลบกิจกรรมเรียบร้อยแล้ว'
        });
      } catch (error) {
        console.error('Error deleting activity:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }
}
