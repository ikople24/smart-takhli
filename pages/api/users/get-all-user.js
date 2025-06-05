import dbConnect from '@/lib/dbConnect';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const response = await fetch('http://localhost:3004/api/users/all-basic');
    const data = await response.json();
    return res.status(response.status).json(data.users || data);
  } catch (error) {
    console.error('Failed to fetch users from backend:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}