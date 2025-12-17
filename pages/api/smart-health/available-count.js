import dbConnect from '@/lib/dbConnect';
import RegisterHealthModel from '@/models/RegisterHealthModel';
import MenuHealthModel from '@/models/MenuHealthModel';

export default async function handler(req, res) {
  await dbConnect();
  try {
    // ดึง available count - exclude broken and repair devices
    const availableCounts = await RegisterHealthModel.aggregate([
      { 
        $match: { 
          ob_status: true, 
          id_code_th: { $ne: null },
          // Exclude broken and repair devices
          $or: [
            { device_status: { $exists: false } },
            { device_status: null },
            { device_status: "available" }
          ]
        } 
      },
      {
        $group: {
          _id: "$id_code_th",
          count: { $sum: 1 }
        }
      }
    ]);

    const menus = await MenuHealthModel.find({});

    const mergedData = menus.map(menu => {
      const match = availableCounts.find(c => String(c._id) === String(menu.id_code_th));
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