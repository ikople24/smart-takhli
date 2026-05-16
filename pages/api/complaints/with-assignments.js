// pages/api/complaints/with-assignments.js
// Optimized API that combines complaints and assignments in a single call
import dbConnect from '@/lib/dbConnect';
import Complaint from '@/models/Complaint';
import Assignment from '@/models/Assignment';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === 'GET') {
    try {
      const { 
        page = 1, 
        limit = 10, 
        status, 
        category, 
        search,
        sortBy = 'updatedAt',
        sortOrder = 'desc'
      } = req.query;

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Build query
      let query = {};
      
      if (status && status !== 'all') {
        if (status === 'รอการมอบหมาย') {
          // Will filter after aggregation
        } else {
          query.status = status;
        }
      }
      
      if (category && category !== 'all') {
        query.category = category;
      }
      
      if (search) {
        query.$or = [
          { detail: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } },
          { fullName: { $regex: search, $options: 'i' } }
        ];
      }

      // Fetch complaints with aggregation for better performance
      const sortDirection = sortOrder === 'desc' ? -1 : 1;
      
      // Get all assignments first
      const assignments = await Assignment.find({}).lean();
      const assignmentMap = {};
      assignments.forEach(a => {
        assignmentMap[a.complaintId] = a;
      });
      
      const assignedComplaintIds = new Set(assignments.map(a => a.complaintId));

      // Modify query for pending status
      let complaintsQuery = { ...query };
      
      // Query is ready, proceed with fetching
      
      // Get complaints
      let complaints = await Complaint.find(complaintsQuery)
        .sort({ [sortBy]: sortDirection })
        .lean();

      // Filter by pending status if needed (complaints without assignments)
      if (status === 'รอการมอบหมาย') {
        complaints = complaints.filter(c => !assignedComplaintIds.has(c._id.toString()));
      }

      // Calculate stats
      const allComplaints = await Complaint.find({}).lean();
      const stats = {
        total: allComplaints.length,
        pending: allComplaints.filter(c => !assignedComplaintIds.has(c._id.toString())).length,
        inProgress: allComplaints.filter(c => c.status === "อยู่ระหว่างดำเนินการ").length,
        completed: allComplaints.filter(c => c.status === "ดำเนินการเสร็จสิ้น").length
      };

      // Get unique categories
      const categories = [...new Set(allComplaints.map(c => c.category).filter(Boolean))];

      // Paginate
      const totalFiltered = complaints.length;
      const paginatedComplaints = complaints.slice(skip, skip + limitNum);

      // Merge with assignments
      const complaintsWithAssignments = paginatedComplaints.map(complaint => ({
        ...complaint,
        assignment: assignmentMap[complaint._id.toString()] || null,
        isAssigned: assignedComplaintIds.has(complaint._id.toString())
      }));

      // Get user IDs for batch fetch
      const userIds = [...new Set(
        assignments
          .filter(a => a.userId)
          .map(a => a.userId)
      )];

      return res.status(200).json({
        success: true,
        data: complaintsWithAssignments,
        stats,
        categories,
        userIds,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalFiltered,
          totalPages: Math.ceil(totalFiltered / limitNum)
        }
      });
    } catch (err) {
      console.error('❌ Failed to fetch complaints with assignments:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch data' });
    }
  } else {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
}

