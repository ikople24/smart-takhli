import { users } from "@clerk/clerk-sdk-node";
import { getAuth } from "@clerk/nextjs/server";

// API สำหรับตั้งค่า superadmin
// ใช้สำหรับตั้งค่าครั้งแรก หรือโดย superadmin ที่มีอยู่แล้ว
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { targetClerkId, secretKey } = req.body;

  if (!targetClerkId) {
    return res.status(400).json({ message: "Missing targetClerkId" });
  }

  try {
    // ตรวจสอบสิทธิ์
    const { userId } = getAuth(req);
    
    if (userId) {
      // ถ้ามี user login อยู่ ต้องเป็น superadmin เท่านั้น
      const currentUser = await users.getUser(userId);
      if (currentUser.publicMetadata?.role !== 'superadmin') {
        return res.status(403).json({ message: "Only superadmin can create superadmin" });
      }
    } else if (secretKey !== process.env.SUPERADMIN_SECRET) {
      // ถ้าไม่ได้ login ต้องมี secret key (สำหรับการตั้งค่าครั้งแรก)
      return res.status(403).json({ message: "Unauthorized" });
    }

    // ตั้งค่า superadmin
    const updatedUser = await users.updateUser(targetClerkId, {
      publicMetadata: {
        role: 'superadmin',
      },
    });

    console.log("✅ User set as superadmin:", targetClerkId);
    res.status(200).json({ 
      success: true,
      message: "User is now superadmin",
      userId: updatedUser.id 
    });
  } catch (error) {
    console.error("❌ Error setting superadmin:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to set superadmin", 
      error: error?.message 
    });
  }
}

