import dbConnect from '@/lib/dbConnect';
import StudentFeedback from '@/models/StudentFeedback';

// ฟังก์ชันคำนวณความคล้ายคลึงของข้อความ (Simple Jaccard Similarity)
function calculateSimilarity(text1, text2) {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

// ฟังก์ชันจัดกลุ่มความคิดเห็นที่คล้ายกัน
function groupSimilarComments(comments, similarityThreshold = 0.3) {
  const groups = [];
  const processed = new Set();

  comments.forEach((comment, index) => {
    if (processed.has(index)) return;

    const group = [comment];
    processed.add(index);

    comments.forEach((otherComment, otherIndex) => {
      if (index === otherIndex || processed.has(otherIndex)) return;

      const similarity = calculateSimilarity(comment.comment, otherComment.comment);
      if (similarity >= similarityThreshold) {
        group.push(otherComment);
        processed.add(otherIndex);
      }
    });

    if (group.length > 1) {
      groups.push({
        id: `group_${index}`,
        comments: group,
        size: group.length,
        representativeComment: group[0],
        averageEmotionLevel: group.reduce((sum, c) => sum + c.emotionLevel, 0) / group.length,
        commonEmotionLevels: getMostCommonEmotionLevels(group),
        commonCategories: getMostCommonCategories(group)
      });
    }
  });

  return groups;
}

function getMostCommonEmotionLevels(comments) {
  const levelCounts = {};
  comments.forEach(comment => {
    const level = comment.emotionLevel;
    levelCounts[level] = (levelCounts[level] || 0) + 1;
  });
  
  return Object.entries(levelCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([level, count]) => ({ level: parseFloat(level), count }));
}

function getMostCommonCategories(comments) {
  const categoryCounts = {};
  comments.forEach(comment => {
    categoryCounts[comment.category] = (categoryCounts[comment.category] || 0) + 1;
  });
  
  return Object.entries(categoryCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([category, count]) => ({ category, count }));
}

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { threshold = 0.3, limit = 100 } = req.query;

    // ดึงความคิดเห็นทั้งหมด
    const comments = await StudentFeedback.find({ isApproved: true })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // จัดกลุ่มความคิดเห็นที่คล้ายกัน
    const similarGroups = groupSimilarComments(comments, parseFloat(threshold));

    // สถิติเพิ่มเติม
    const totalComments = comments.length;
    const groupedComments = similarGroups.reduce((sum, group) => sum + group.size, 0);
    const ungroupedComments = totalComments - groupedComments;

    // วิเคราะห์คำที่ใช้บ่อย
    const wordFrequency = {};
    comments.forEach(comment => {
      const words = comment.comment.toLowerCase()
        .replace(/[^\u0E00-\u0E7F\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 1);
      
      words.forEach(word => {
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      });
    });

    const topWords = Object.entries(wordFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([word, count]) => ({ word, count }));

    // สถิติตามช่วงเวลา
    const timeStats = await StudentFeedback.aggregate([
      { $match: { isApproved: true } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 },
          avgEmotionLevel: { $avg: '$emotionLevel' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    // คำนวณคะแนนเฉลี่ย
    const averageEmotionLevel = comments.length > 0 
      ? comments.reduce((sum, comment) => sum + comment.emotionLevel, 0) / comments.length 
      : 0;

    // แปลง timeStats เป็นรูปแบบที่ต้องการ
    const timeStatsFormatted = {};
    timeStats.forEach(stat => {
      const period = `${stat._id.month}/${stat._id.year}`;
      timeStatsFormatted[period] = stat.count;
    });

    res.status(200).json({
      success: true,
      totalComments,
      groupedComments,
      ungroupedComments,
      groupCount: similarGroups.length,
      groupingPercentage: totalComments > 0 ? (groupedComments / totalComments * 100) : 0,
      averageEmotionLevel,
      similarGroups,
      wordFrequency: topWords,
      timeStats: timeStatsFormatted
    });

  } catch (error) {
    console.error('Error analyzing feedback:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
} 