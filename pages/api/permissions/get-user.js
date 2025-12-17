import axios from "axios";
import { users } from "@clerk/clerk-sdk-node";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const appId = req.headers['x-app-id'] || process.env.NEXT_PUBLIC_APP_ID;
    const authToken = req.headers['authorization'] || req.headers['Authorization'];

    const { userId, clerkId } = req.query;

    if (!userId && !clerkId) {
      return res.status(400).json({ success: false, message: "userId or clerkId is required" });
    }

    // Try backend API first
    try {
      const response = await axios.get(
        `${process.env.BACKEND_API_URL}/api/users/get-permissions/${userId}`,
        {
          headers: {
            'x-app-id': appId,
            'Authorization': authToken,
          },
        }
      );
      return res.status(200).json(response.data);
    } catch {
      console.warn("Backend API not available, using Clerk metadata fallback");
      
      // Fallback: Get permissions from Clerk user metadata
      if (clerkId || userId) {
        try {
          const clerkUser = await users.getUser(clerkId || userId);
          return res.status(200).json({ 
            success: true, 
            permissions: clerkUser.privateMetadata?.permissions || [],
            role: clerkUser.publicMetadata?.role || 'admin',
            fallback: true
          });
        } catch (clerkError) {
          console.warn("Could not get Clerk user:", clerkError.message);
        }
      }
      
      // Return empty permissions if all fails
      return res.status(200).json({ 
        success: true, 
        permissions: [],
        role: 'admin'
      });
    }
  } catch (e) {
    console.error("❌ Failed to get user permissions:", e.response?.data || e.message);
    return res.status(200).json({ 
      success: true, 
      permissions: [],
      role: 'admin'
    });
  }
}

