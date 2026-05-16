//api/complaints/index.js
import dbConnect from '@/lib/dbConnect';
import Complaint from '@/models/Complaint';

// คำนวณช่วงปีงบประมาณ (1 ต.ค. - 30 ก.ย.)
function getFiscalYearRange(fiscalYear) {
  // fiscalYear คือปี พ.ศ. ของวันสิ้นสุด (30 ก.ย.)
  const endYear = fiscalYear - 543; // แปลงเป็น ค.ศ.
  const startYear = endYear - 1;
  
  return {
    start: new Date(startYear, 9, 1, 0, 0, 0), // 1 ตุลาคม ปีก่อน
    end: new Date(endYear, 8, 30, 23, 59, 59)  // 30 กันยายน
  };
}

// คำนวณปีงบประมาณปัจจุบัน
function getCurrentFiscalYear() {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  if (currentMonth >= 9) { // ตุลาคม - ธันวาคม
    return currentYear + 1 + 543;
  } else { // มกราคม - กันยายน
    return currentYear + 543;
  }
}

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === 'GET') {
    try {
      const isAdmin = req.query.role === 'admin';
      const projection = isAdmin ? {} : { fullName: 0, phone: 0 };
      
      // Pagination parameters
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 0; // 0 = ไม่จำกัด
      const skip = (page - 1) * limit;
      
      // Sorting
      const sortField = req.query.sortField || 'createdAt';
      const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
      
      let query = {};
      
      // Filter by status
      if (req.query.status) {
        query.status = req.query.status;
      }
      
      // Filter by complaint ID
      if (req.query.complaintId) {
        query._id = req.query.complaintId;
      }
      
      // Filter by fiscal year (ปีงบประมาณ)
      if (req.query.fiscalYear) {
        const fiscalYear = parseInt(req.query.fiscalYear);
        const { start, end } = getFiscalYearRange(fiscalYear);
        query.createdAt = { $gte: start, $lte: end };
      } else if (req.query.currentFiscalYear === 'true') {
        // ใช้ปีงบประมาณปัจจุบัน
        const currentFY = getCurrentFiscalYear();
        const { start, end } = getFiscalYearRange(currentFY);
        query.createdAt = { $gte: start, $lte: end };
      }
      
      // Build query
      let queryBuilder = Complaint.find(query, projection)
        .sort({ [sortField]: sortOrder });
      
      // Apply pagination if limit is set
      if (limit > 0) {
        queryBuilder = queryBuilder.skip(skip).limit(limit);
      }
      
      const complaints = await queryBuilder;
      
      // ถ้าต้องการข้อมูล pagination
      if (req.query.withCount === 'true') {
        const total = await Complaint.countDocuments(query);
        return res.status(200).json({
          success: true,
          data: complaints,
          pagination: {
            page,
            limit,
            total,
            totalPages: limit > 0 ? Math.ceil(total / limit) : 1
          }
        });
      }

      return res.status(200).json(complaints);
    } catch (err) {
      console.error('❌ Failed to fetch complaints:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch complaints' });
    }
  } else {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
}