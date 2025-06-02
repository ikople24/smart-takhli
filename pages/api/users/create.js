//pages/api/users/create.js
import axios from "axios";
import { getAuth } from "@clerk/nextjs/server";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const { userId, getToken } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = await getToken();

  try {
    const response = await axios.post(`${process.env.BACKEND_API_URL}/api/users/create`, req.body, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    return res.status(200).json(response.data);
  } catch (e) {
    console.error("❌ Failed to create user:", e.response?.data || e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
}