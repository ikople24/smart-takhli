import { requireAuth } from '@/lib/requireAuth';
import { backendAuthHeaders } from '@/lib/backendAuthHeaders';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const auth = await requireAuth(req, res, ['admin', 'superadmin']);
  if (!auth) return;

  try {
    const headers = await backendAuthHeaders(req);
    const response = await fetch(`${process.env.BACKEND_API_URL}/api/users/all-basic`, {
      headers,
    });
    const data = await response.json();
    return res.status(response.status).json(data.users || data);
  } catch (error) {
    console.error('Failed to fetch users from backend:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}