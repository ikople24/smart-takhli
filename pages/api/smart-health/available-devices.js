import dbConnect from '@/lib/dbConnect';
import RegisterObjectHealth from '@/models/RegisterHealthModel';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    await dbConnect();

    const availableDevices = await RegisterObjectHealth.find({ ob_status: true });
    const devicesWithType = availableDevices.map(device => ({
      ...device.toObject(),
      display_label: `${device.id_code_th} - ${device.ob_type || '-'}`,
    }));
    res.status(200).json(devicesWithType);
  } catch (error) {
    console.error('Failed to fetch available devices:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}