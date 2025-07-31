import dbConnect from '@/lib/dbConnect';
import StudentFeedback from '@/models/StudentFeedback';

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
        const { page = 1, limit = 10, category } = req.query;
        const skip = (page - 1) * limit;
        
        let query = { isApproved: true };
        
        if (category) query.category = category;

        const feedbacks = await StudentFeedback.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit));

        const total = await StudentFeedback.countDocuments(query);

        // สถิติ
        const stats = await StudentFeedback.aggregate([
          { $match: { isApproved: true } },
          {
            $group: {
              _id: null,
              totalComments: { $sum: 1 },
              categoryStats: {
                $push: '$category'
              },
              averageEmotionLevel: { $avg: '$emotionLevel' }
            }
          }
        ]);

        // จัดกลุ่มหมวดหมู่
        const categoryCounts = {};
        
        if (stats.length > 0) {
          stats[0].categoryStats.forEach(category => {
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;
          });
        }

        res.status(200).json({
          success: true,
          data: feedbacks,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            hasNext: skip + feedbacks.length < total,
            hasPrev: page > 1
          },
          statistics: {
            totalComments: stats.length > 0 ? stats[0].totalComments : 0,
            averageEmotionLevel: stats.length > 0 ? Math.round(stats[0].averageEmotionLevel * 10) / 10 : 0,
            categoryCounts
          }
        });
      } catch (error) {
        console.error('Error fetching feedbacks:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
      }
      break;

    case 'POST':
      try {
        console.log('Received data:', req.body);
        const { grade, comment, emotionLevel, category, tags } = req.body;

      // Validation
      if (!grade || !comment || !emotionLevel || !category) {
        return res.status(400).json({ 
          success: false, 
          message: 'กรุณากรอกข้อมูลให้ครบถ้วน' 
        });
      }

      if (comment.length > 500) {
        return res.status(400).json({ 
          success: false, 
          message: 'ความคิดเห็นต้องไม่เกิน 500 ตัวอักษร' 
        });
      }

      // Validate emotionLevel
      const level = parseFloat(emotionLevel);
      if (isNaN(level) || level < 1 || level > 5) {
        return res.status(400).json({ 
          success: false, 
          message: 'คะแนนต้องอยู่ระหว่าง 1-5' 
        });
      }

        // Get IP address
        const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

        const feedback = new StudentFeedback({
          grade,
          comment: comment.trim(),
          emotionLevel: level,
          category,
          tags: tags || [],
          ipAddress
        });

        await feedback.save();

        res.status(201).json({
          success: true,
          message: 'บันทึกความคิดเห็นเรียบร้อยแล้ว',
          data: feedback
        });
      } catch (error) {
        console.error('Error creating feedback:', error);
        console.error('Error details:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }
} 