// pages/api/report.js
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const data = req.body;
    console.log('📩 ได้รับข้อมูลจากฟอร์ม:', data);
    // TODO: บันทึกลง MongoDB หรือประมวลผลต่อ

    return res.status(200).json({ message: 'รับข้อมูลเรียบร้อย' });
  }

  res.status(405).json({ error: 'Method Not Allowed' });
}