import { users as clerkUsers } from "@clerk/clerk-sdk-node";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    // Get users from MongoDB (backend API) - PRIMARY SOURCE
    const backendResponse = await fetch(`${process.env.BACKEND_API_URL}/api/users/all-basic`, {
      headers: {
        'x-app-id': process.env.NEXT_PUBLIC_APP_ID,
      },
    });
    const backendData = await backendResponse.json();
    const dbUsers = backendData.users || backendData || [];
    console.log(`📦 Fetched ${dbUsers.length} users from MongoDB`);

    // Get Clerk users to match clerkId
    let clerkUserMap = {};
    try {
      const clerkUserListResponse = await clerkUsers.getUserList({ limit: 100 });
      const clerkUserList = Array.isArray(clerkUserListResponse) 
        ? clerkUserListResponse 
        : (clerkUserListResponse.data || clerkUserListResponse);
      
      clerkUserList.forEach(cu => {
        clerkUserMap[cu.id] = {
          clerkId: cu.id,
          role: cu.publicMetadata?.role,
          allowedPages: cu.publicMetadata?.allowedPages || [],
          imageUrl: cu.imageUrl,
          firstName: cu.firstName,
          lastName: cu.lastName,
        };
      });
      console.log(`👥 Fetched ${clerkUserList.length} users from Clerk`);
    } catch (clerkError) {
      console.warn("⚠️ Could not fetch Clerk users:", clerkError.message);
    }

    // Build users list from MongoDB and match with Clerk
    const usersWithPermissions = dbUsers.map(dbUser => {
      let matchedClerk = null;
      
      // Method 1: Use clerkId from MongoDB if available
      if (dbUser.clerkId && clerkUserMap[dbUser.clerkId]) {
        matchedClerk = clerkUserMap[dbUser.clerkId];
      }
      
      // Method 2: Match by profile URL pattern
      if (!matchedClerk && dbUser.profileUrl) {
        matchedClerk = Object.values(clerkUserMap).find(cu => {
          if (!cu.imageUrl || !dbUser.profileUrl) return false;
          
          // Extract image identifier from URLs for comparison
          const extractImgId = (url) => {
            // Match patterns like img_xxx or oauth_xxx/img_xxx
            const match = url.match(/img_([a-zA-Z0-9]+)/);
            return match ? match[1] : null;
          };
          
          const dbImgId = extractImgId(dbUser.profileUrl);
          const clerkImgId = extractImgId(cu.imageUrl);
          
          if (dbImgId && clerkImgId && dbImgId === clerkImgId) return true;
          
          // Direct URL comparison
          return cu.imageUrl === dbUser.profileUrl;
        });
      }
      
      // Method 3: Match by name
      if (!matchedClerk) {
        matchedClerk = Object.values(clerkUserMap).find(cu => {
          const clerkFullName = `${cu.firstName || ''} ${cu.lastName || ''}`.trim();
          return dbUser.name && clerkFullName && 
                 dbUser.name.toLowerCase() === clerkFullName.toLowerCase();
        });
      }
      
      return {
        _id: dbUser._id,
        clerkId: dbUser.clerkId || matchedClerk?.clerkId || null,
        name: dbUser.name || 'Unknown',
        position: dbUser.position || '',
        department: dbUser.department || '',
        phone: dbUser.phone || '',
        profileImage: matchedClerk?.imageUrl || dbUser.profileUrl || dbUser.profileImage,
        profileUrl: dbUser.profileUrl,
        role: matchedClerk?.role || dbUser.role || 'admin',
        allowedPages: dbUser.allowedPages || matchedClerk?.allowedPages || [],
        assignedTask: dbUser.assignedTask || '',
      };
    });

    console.log(`✅ Returning ${usersWithPermissions.length} users`);

    return res.status(200).json({ 
      success: true, 
      users: usersWithPermissions 
    });
  } catch (e) {
    console.error("❌ Failed to get users:", e.message);
    return res.status(500).json({ 
      success: false, 
      message: e.message,
      users: [] 
    });
  }
}

