import { users } from "@clerk/clerk-sdk-node";
import { requireAuth } from "@/lib/requireAuth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const auth = await requireAuth(req, res, ["superadmin"]);
  if (!auth) return;

  const { clerkId, role } = req.body;

  if (!clerkId || !role) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const VALID_ROLES = ["superadmin", "admin", "user", "guest"];
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ message: `role ไม่ถูกต้อง: ${role}` });
  }

  try {
    await users.updateUser(clerkId, {
      publicMetadata: {
        role,
      },
    });

    res.status(200).json({ success: true, message: "Clerk role updated" });
  } catch (error) {
    console.error("❌ Clerk error:", JSON.stringify(error, null, 2));
    res.status(500).json({ message: "Failed to update Clerk metadata", error: error?.message });
  }
}
