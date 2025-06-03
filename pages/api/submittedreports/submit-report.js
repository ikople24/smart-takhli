// pages/api/submit-report.js
import dbConnect from '@/lib/dbConnect';
import SubmittedReport from '@/models/SubmittedReport';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    await dbConnect();
    const newReport = await SubmittedReport.create(req.body);

    // 🔔 POST ไปยัง n8n webhook
    await fetch('https://primary-production-a1769.up.railway.app/webhook/submit-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newReport),
    });

    res.status(201).json({ success: true, data: newReport });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}