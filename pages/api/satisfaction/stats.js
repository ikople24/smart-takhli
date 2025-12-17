import dbConnect from '@/lib/dbConnect';
import Satisfaction from '@/models/Satisfaction';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === 'GET') {
    try {
      // Get all satisfaction ratings
      const satisfactions = await Satisfaction.find({});
      
      if (satisfactions.length === 0) {
        return res.status(200).json({
          averageRating: 0,
          totalRatings: 0,
          ratingDistribution: {
            1: 0, 2: 0, 3: 0, 4: 0, 5: 0
          }
        });
      }

      // Calculate average rating
      const totalRating = satisfactions.reduce((sum, satisfaction) => sum + satisfaction.rating, 0);
      const averageRating = totalRating / satisfactions.length;

      // Calculate rating distribution
      const ratingDistribution = {
        1: 0, 2: 0, 3: 0, 4: 0, 5: 0
      };

      satisfactions.forEach(satisfaction => {
        if (ratingDistribution[satisfaction.rating] !== undefined) {
          ratingDistribution[satisfaction.rating]++;
        }
      });

      return res.status(200).json({
        averageRating,
        totalRatings: satisfactions.length,
        ratingDistribution
      });
    } catch (err) {
      console.error('❌ Failed to fetch satisfaction stats:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch satisfaction stats' });
    }
  } else {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
}
