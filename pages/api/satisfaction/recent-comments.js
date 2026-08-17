import dbConnect from '@/lib/dbConnect';
import Satisfaction from '@/models/Satisfaction';
import SubmittedReport from '@/models/SubmittedReport';
import { isComplaintStaffFromRequest } from '@/lib/complaintPrivacy';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // เฉพาะเจ้าหน้าที่ (role admin/superadmin) — ชุดข้อมูลนี้มีรายละเอียดเรื่องร้องเรียน
  // รวมเรื่องลับ/PDPA ที่หน้าเว็บสาธารณะไม่แสดง และไม่ได้ผ่าน lib/complaintPrivacy.js
  // ผู้ใช้จริงมีแค่แผงความเห็นในหน้า /admin/manage-complaints
  const isStaff = await isComplaintStaffFromRequest(req);
  if (!isStaff) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }

  await dbConnect();

  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 8, 20);

    const comments = await Satisfaction.find({
      comment: { $exists: true, $nin: [null, ''] },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    // ต่อให้กันด้วย auth แล้ว ก็ยังไม่แนบทั้ง document ของเรื่องร้องเรียน
    // (มี fullName / phone / lineUserId ของผู้แจ้ง) select เฉพาะฟิลด์ที่ UI เรนเดอร์จริง:
    // SatisfactionCommentsPanel ใช้ detail + category ทำหัวข้อ แล้วส่ง object เดิมต่อให้
    // CardModalDetail ซึ่งใช้ complaintId, category, problems, community, status, images,
    // createdAt, updatedAt, detail
    const complaintIds = [...new Set(comments.map((c) => c.complaintId?.toString()).filter(Boolean))];
    const complaints = complaintIds.length
      ? await SubmittedReport.find({ _id: { $in: complaintIds } })
          .select("complaintId detail category problems community status images createdAt updatedAt")
          .lean()
      : [];

    const complaintMap = Object.fromEntries(
      complaints.map((c) => [c._id.toString(), c])
    );

    const data = comments.map((item) => ({
      _id: item._id,
      rating: item.rating,
      comment: item.comment,
      createdAt: item.createdAt,
      complaintId: item.complaintId,
      complaint: complaintMap[item.complaintId?.toString()] || null,
    }));

    return res.status(200).json({
      success: true,
      total: data.length,
      data,
    });
  } catch (err) {
    console.error('Failed to fetch recent satisfaction comments:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch comments' });
  }
}
