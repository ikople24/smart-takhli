import { getAuth } from "@clerk/nextjs/server";
import { backendAuthHeaders } from "@/lib/backendAuthHeaders";

// API ตรวจสอบว่า user ลงทะเบียนในระบบหรือยัง (ต้องล็อกอิน และตรวจเฉพาะตัวเอง)
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { userId } = getAuth(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        registered: false,
        message: "Unauthorized",
      });
    }

    const { clerkId } = req.query;

    if (!clerkId || String(clerkId) !== userId) {
      return res.status(403).json({
        success: false,
        registered: false,
        message: "สามารถตรวจสอบได้เฉพาะบัญชีของตนเอง",
      });
    }

    const headers = await backendAuthHeaders(req);
    if (!headers.Authorization) {
      return res.status(401).json({
        success: false,
        registered: false,
        message: "Missing session for backend",
      });
    }

    const meRes = await fetch(
      `${process.env.BACKEND_API_URL}/api/users/me`,
      { headers }
    );

    if (!meRes.ok) {
      return res.status(200).json({
        success: false,
        registered: false,
        message: "Could not fetch user from backend",
      });
    }

    const payload = await meRes.json();
    const foundUser = payload.user || null;
    const registered = Boolean(payload.registered && foundUser);

    console.log(`🔍 Check registered: clerkId=${clerkId}, registered=${registered}, name=${foundUser?.name || "N/A"}`);

    return res.status(200).json({
      success: true,
      registered,
      user: foundUser,
    });
  } catch (e) {
    console.error("❌ Failed to check user registration:", e.message);
    return res.status(500).json({
      success: false,
      registered: false,
      message: e.message,
    });
  }
}
