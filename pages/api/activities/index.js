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

  switch (req.method) {
    case 'GET':
      try {
        const { active, default: isDefault } = req.query;
        
        let query = {};
        
        if (active !== undefined) {
          query.isActive = active === 'true';
        }
        
        if (isDefault !== undefined) {
          query.isDefault = isDefault === 'true';
        }

        const activities = await Activity.find(query)
          .sort({ createdAt: -1 });

        res.status(200).json({
          success: true,
          data: activities
        });
      } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
      break;

    case 'POST':
      try {
        const auth = await requireActivitiesAdmin(req);
        if (!auth.ok) {
          return res.status(auth.status).json({ success: false, message: auth.message });
        }

        const { name, description, startDate, endDate, isDefault } = req.body;

        // Validation
        if (!name || !startDate || !endDate) {
          return res.status(400).json({
            success: false,
            message: 'กรุณากรอกข้อมูลให้ครบถ้วน'
          });
        }

        const images = Array.isArray(req.body.images)
          ? req.body.images.filter((u) => typeof u === "string")
          : [];
        if (images.length > 6) {
          return res.status(400).json({ success: false, message: "อัปโหลดรูปได้สูงสุด 6 รูป" });
        }

        // ถ้าเป็น default activity ให้ยกเลิก default ของกิจกรรมอื่นๆ ก่อน
        if (isDefault) {
          await Activity.updateMany(
            { isDefault: true },
            { isDefault: false }
          );
        }

        const activity = new Activity({
          name: name.trim(),
          description: description?.trim() || '',
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          isDefault: isDefault || false,
          images
        });

        await activity.save();

        res.status(201).json({
          success: true,
          message: 'สร้างกิจกรรมเรียบร้อยแล้ว',
          data: activity
        });
      } catch (error) {
        console.error('Error creating activity:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }
}
