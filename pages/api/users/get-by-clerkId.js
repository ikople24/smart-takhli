// pages/api/users/get-by-clerkId.js
import axios from 'axios';

export default async function handler(req, res) {
  const { clerkId } = req.query;

  try {
    const response = await axios.get(`http://localhost:3004/api/users/get-by-clerkId`, {
      params: { clerkId },
    });

    return res.status(200).json(response.data);
  } catch (error) {
    console.error("GET USER API ERROR:", error.message);
    return res.status(500).json({
      success: false,
      message: error.response?.data?.message || "Internal Server Error",
    });
  }
}