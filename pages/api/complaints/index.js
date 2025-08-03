//api/complaints/index.js
import dbConnect from '@/lib/dbConnect';
import Complaint from '@/models/Complaint';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === 'GET') {
    try {
      const isAdmin = req.query.role === 'admin';
      const projection = isAdmin ? {} : { fullName: 0, phone: 0 };
      
      let query = {};
      if (req.query.status) {
        query.status = req.query.status;
      }
      if (req.query.complaintId) {
        query._id = req.query.complaintId;
      }
      
      const complaints = await Complaint.find(query, projection);

      return res.status(200).json(complaints);
    } catch (err) {
      console.error('❌ Failed to fetch complaints:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch complaints' });
    }
  } else {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
}