import dbConnect from "@/lib/dbConnect";
import Assignment from "@/models/Assignment";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    // รับพารามิเตอร์การกรอง
    const { dateRange, fiscalYear } = req.query;
    
    // สร้าง filter สำหรับวันที่
    let dateFilter = {};
    const now = new Date();
    
    if (fiscalYear === "2568") {
      // ปีงบประมาณ 2568: 1 ตุลาคม 2567 - 30 กันยายน 2568
      const fiscalStart = new Date(2024, 9, 1); // ตุลาคม 2567
      const fiscalEnd = new Date(2025, 8, 30); // กันยายน 2568
      dateFilter.assignedAt = { $gte: fiscalStart, $lte: fiscalEnd };
    } else if (dateRange && dateRange !== 'all') {
      // กรองตามช่วงเวลาปกติ
      let days;
      switch (dateRange) {
        case '7d': days = 7; break;
        case '30d': days = 30; break;
        case '90d': days = 90; break;
        default: days = null;
      }
      
      if (days) {
        const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
        dateFilter.assignedAt = { $gte: startDate };
      }
    }

    // ดึงข้อมูล assignments พร้อม populate user data และกรองตามวันที่
    const assignments = await Assignment.aggregate([
      { $match: dateFilter },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user"
        }
      },
      {
        $unwind: {
          path: "$user",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          user: {
            $cond: {
              if: { $ne: ["$user", null] },
              then: "$user",
              else: {
                _id: "$userId",
                name: null,
                position: null,
                department: null,
                role: null
              }
            }
          }
        }
      }
    ]);

    res.status(200).json({ 
      success: true, 
      assignments: assignments,
      total: assignments.length
    });
  } catch (error) {
    console.error("Error fetching assignments with users:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch assignments with users",
      message: error.message
    });
  }
}
