import { users } from "@clerk/clerk-sdk-node";
import { requireAuth } from "@/lib/requireAuth";

export default async function handler(req, res) {
  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const auth = await requireAuth(req, res, ["superadmin"]);
  if (!auth) return;

  try {
    const { userId, permissions, role, clerkId } = req.body;

    console.log("📝 Update permissions request:", { userId, clerkId, role, permissionsCount: permissions?.length });

    if (!clerkId) {
      return res.status(400).json({ 
        success: false, 
        message: "clerkId is required for updating permissions" 
      });
    }

    // Use Clerk metadata to store permissions (since backend may not have this endpoint)
    try {
      await users.updateUser(clerkId, {
        publicMetadata: {
          role: role || 'admin',
        },
        privateMetadata: {
          permissions: permissions || [],
        },
      });
      
      console.log("✅ Permissions updated via Clerk for:", clerkId);
      
      return res.status(200).json({ 
        success: true, 
        message: "Permissions updated successfully",
        fallback: true
      });
    } catch (clerkError) {
      console.error("❌ Clerk update failed:", clerkError.message);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to update Clerk metadata: " + clerkError.message 
      });
    }
  } catch (e) {
    console.error("❌ Failed to update user permissions:", e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
}

