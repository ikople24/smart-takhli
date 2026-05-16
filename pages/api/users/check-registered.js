import { users as clerkUsers } from "@clerk/clerk-sdk-node";

// API ตรวจสอบว่า user ลงทะเบียนในระบบหรือยัง
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { clerkId } = req.query;

    if (!clerkId) {
      return res.status(400).json({ 
        success: false, 
        registered: false,
        message: "clerkId is required" 
      });
    }

    // Get the Clerk user to get their image URL
    let clerkUser = null;
    try {
      clerkUser = await clerkUsers.getUser(clerkId);
    } catch (e) {
      console.warn("Could not get Clerk user:", e.message);
    }

    // Get all users from MongoDB
    const allUsersResponse = await fetch(
      `${process.env.BACKEND_API_URL}/api/users/all-basic`,
      {
        headers: {
          'x-app-id': process.env.NEXT_PUBLIC_APP_ID,
        },
      }
    );

    if (!allUsersResponse.ok) {
      return res.status(200).json({ 
        success: false, 
        registered: false,
        message: "Could not fetch users from backend"
      });
    }

    const data = await allUsersResponse.json();
    const users = data.users || data || [];
    
    // Try to find user by multiple methods
    const foundUser = users.find(u => {
      // Method 1: Match by clerkId field (if exists in DB)
      if (u.clerkId === clerkId) return true;
      
      // Method 2: Match by profile URL (Clerk image URL pattern)
      if (u.profileUrl && clerkUser?.imageUrl) {
        // Both URLs are from Clerk
        if (u.profileUrl.includes('clerk.') && clerkUser.imageUrl.includes('clerk.')) {
          // Compare the image identifiers
          return u.profileUrl === clerkUser.imageUrl;
        }
      }
      
      // Method 3: Match by name
      if (clerkUser) {
        const clerkFullName = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim();
        if (u.name && clerkFullName && u.name.toLowerCase() === clerkFullName.toLowerCase()) {
          return true;
        }
      }
      
      return false;
    });

    console.log(`🔍 Check registered: clerkId=${clerkId}, found=${!!foundUser}, name=${foundUser?.name || 'N/A'}`);

    return res.status(200).json({ 
      success: true, 
      registered: !!foundUser,
      user: foundUser || null
    });

  } catch (e) {
    console.error("❌ Failed to check user registration:", e.message);
    return res.status(500).json({ 
      success: false, 
      registered: false,
      message: e.message 
    });
  }
}

