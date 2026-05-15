import axios from "axios";
import { requireAuth } from "@/lib/requireAuth";
import { backendAuthHeaders } from "@/lib/backendAuthHeaders";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const auth = await requireAuth(req, res, ["admin", "superadmin"]);
  if (!auth) return;

  try {
    const appId = req.headers['x-app-id'] || process.env.NEXT_PUBLIC_APP_ID;
    const headers = await backendAuthHeaders(req);
    if (!headers.Authorization) {
      return res.status(401).json({ success: false, message: "Missing session for backend" });
    }

    const response = await axios.post(
      `${process.env.BACKEND_API_URL}/api/users/create`,
      req.body,
      {
        headers: {
          'x-app-id': appId,
          'Authorization': headers.Authorization,
          'Content-Type': 'application/json'
        },
      }
    );
    return res.status(200).json(response.data);
  } catch (e) {
    console.error("❌ Failed to create user:", e.response?.data || e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
}