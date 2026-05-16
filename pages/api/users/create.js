import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const appId = req.headers['x-app-id'] || process.env.NEXT_PUBLIC_APP_ID;
    const authToken = req.headers['authorization'] || req.headers['Authorization'];

    const response = await axios.post(
      `${process.env.BACKEND_API_URL}/api/users/create`,
      req.body,
      {
        headers: {
          'x-app-id': appId,
          'Authorization': authToken,
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