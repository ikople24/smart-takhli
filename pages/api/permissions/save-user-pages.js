import { users } from "@clerk/clerk-sdk-node";

// API สำหรับบันทึกหน้าที่อนุญาตให้ user เข้าถึง
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { clerkId, allowedPages } = req.body;

    if (!clerkId) {
      return res.status(400).json({ 
        success: false, 
        message: "clerkId is required" 
      });
    }

    // Get current user to preserve existing metadata
    const currentUser = await users.getUser(clerkId);
    const currentMetadata = currentUser.publicMetadata || {};

    // Update public metadata with allowed pages
    await users.updateUser(clerkId, {
      publicMetadata: {
        ...currentMetadata,
        allowedPages: allowedPages || [],
      },
    });

    console.log(`✅ Updated allowed pages for ${clerkId}:`, allowedPages?.length || 0, "pages");

    return res.status(200).json({ 
      success: true, 
      message: "Allowed pages updated successfully" 
    });
  } catch (e) {
    console.error("❌ Failed to save user pages:", e.message);
    return res.status(500).json({ 
      success: false, 
      message: e.message 
    });
  }
}

