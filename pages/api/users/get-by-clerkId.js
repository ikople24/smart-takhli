import axios from 'axios';
import { getAuth } from "@clerk/nextjs/server";
import { backendAuthHeaders } from "@/lib/backendAuthHeaders";

export default async function handler(req, res) {
  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const headers = await backendAuthHeaders(req);
    if (!headers.Authorization) {
      return res.status(401).json({ message: "Missing session for backend" });
    }

    const response = await axios.get(`${process.env.BACKEND_API_URL}/api/users/get-by-clerkId?clerkId=${userId}`, {
      headers: {
        ...headers,
      }
    });
    console.log("📦 AUTH HEADER:", req.headers.authorization);

    return res.status(200).json(response.data);
  } catch (error) {
    console.error("GET USER API ERROR:", error.message);
    return res.status(500).json({
      success: false,
      message: error.response?.data?.message || "Internal Server Error",
    });
  }
}