import dbConnect from '@/lib/dbConnect';
import Satisfaction from '@/models/Satisfaction';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === 'GET') {
    try {
      const satisfactions = await Satisfaction.find({}, { rating: 1, source: 1 }).lean();

      const emptyBySource = {
        public: { count: 0, average: 0 },
        line: { count: 0, average: 0 },
      };

      if (satisfactions.length === 0) {
        return res.status(200).json({
          averageRating: 0,
          totalRatings: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          bySource: emptyBySource,
        });
      }

      const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      const sums = { public: 0, line: 0 };
      const counts = { public: 0, line: 0 };

      satisfactions.forEach((s) => {
        if (ratingDistribution[s.rating] !== undefined) {
          ratingDistribution[s.rating]++;
        }
        // แถวที่ไม่มี source (ก่อน backfill) ถือเป็นคะแนนจากหน้าเว็บ
        const key = s.source === 'line' ? 'line' : 'public';
        sums[key] += s.rating;
        counts[key]++;
      });

      const totalRating = sums.public + sums.line;

      return res.status(200).json({
        averageRating: totalRating / satisfactions.length,
        totalRatings: satisfactions.length,
        ratingDistribution,
        bySource: {
          public: {
            count: counts.public,
            average: counts.public ? sums.public / counts.public : 0,
          },
          line: {
            count: counts.line,
            average: counts.line ? sums.line / counts.line : 0,
          },
        },
      });
    } catch (err) {
      console.error('❌ Failed to fetch satisfaction stats:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch satisfaction stats' });
    }
  } else {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
}
