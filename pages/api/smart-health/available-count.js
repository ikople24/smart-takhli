import dbConnect from '@/lib/dbConnect';
import RegisterHealthModel from '@/models/RegisterHealthModel';
import MenuHealthModel from '@/models/MenuHealthModel';

export default async function handler(req, res) {
  await dbConnect();
  try {
    // ดึง available count
    console.log(dbConnect)
    const availableCounts = await RegisterHealthModel.aggregate([
      { $match: { ob_status: true, id_code_th: { $ne: null } } },
      {
        $group: {
          _id: "$id_code_th",
          count: { $sum: 1 }
        }
      }
    ]);
    console.log("availableCounts (aggregate result):", availableCounts);

    const menus = await MenuHealthModel.find({});

    const mergedData = menus.map(menu => {
      const match = availableCounts.find(c => c._id === menu.id_code_th);
      console.log(`Matching for menu.id_code_th=${menu.id_code_th}:`, match);
      return {
        label: menu.shot_name || menu.ob_type,
        image_icon: menu.image_icon,
        available: match ? match.count : 0
      };
    });

    return res.status(200).json(mergedData);
  } catch (error) {
    console.error('Error fetching available counts:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}