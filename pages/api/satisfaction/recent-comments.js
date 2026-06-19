import dbConnect from '@/lib/dbConnect';
import Satisfaction from '@/models/Satisfaction';
import SubmittedReport from '@/models/SubmittedReport';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 8, 20);

    const comments = await Satisfaction.find({
      comment: { $exists: true, $nin: [null, ''] },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const complaintIds = [...new Set(comments.map((c) => c.complaintId?.toString()).filter(Boolean))];
    const complaints = complaintIds.length
      ? await SubmittedReport.find({ _id: { $in: complaintIds } }).lean()
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
