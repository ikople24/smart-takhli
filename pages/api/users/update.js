import axios from "axios";
import { requireAuth } from "@/lib/requireAuth";
import { backendAuthHeaders } from "@/lib/backendAuthHeaders";

export default async function handler(req, res) {
  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const auth = await requireAuth(req, res, ["admin", "superadmin"]);
  if (!auth) return;

  try {
    const appId = req.headers['x-app-id'] || process.env.NEXT_PUBLIC_APP_ID;
    const headers = await backendAuthHeaders(req);
    if (!headers.Authorization) {
      return res.status(401).json({ success: false, message: "Missing session for backend" });
    }

    // Debug: ดูข้อมูลที่ส่งไป backend
    console.log("🔍 UPDATE API - Sending to backend:", {
      body: req.body,
      assignedTask: req.body.assignedTask,
      assignedTaskType: typeof req.body.assignedTask,
      hasAuthToken: !!headers.Authorization,
      assignedTaskLength: req.body.assignedTask?.length,
      assignedTaskSplit: typeof req.body.assignedTask === 'string' ? req.body.assignedTask?.split(", ") : req.body.assignedTask
    });

    const response = await axios.put(
      `${process.env.BACKEND_API_URL}/api/users/update`,
      req.body,
      {
        headers: {
          'x-app-id': appId,
          'Authorization': headers.Authorization,
          'Content-Type': 'application/json'
        },
      }
    );

    // Debug: ดูผลลัพธ์จาก backend
    console.log("✅ UPDATE API - Backend response:", {
      success: response.data.success,
      assignedTask: response.data.user?.assignedTask,
      action: "replaced",
      status: response.status,
      assignedTaskType: typeof response.data.user?.assignedTask,
      assignedTaskLength: response.data.user?.assignedTask?.length,
      assignedTaskSplit: typeof response.data.user?.assignedTask === 'string' ? response.data.user?.assignedTask?.split(", ") : response.data.user?.assignedTask
    });

    return res.status(200).json(response.data);
  } catch (e) {
    console.error("❌ UPDATE API - Failed to update user:", e.response?.data || e.message);
    console.error("❌ UPDATE API - Error details:", {
      status: e.response?.status,
      statusText: e.response?.statusText,
      data: e.response?.data,
      message: e.message
    });
    return res.status(500).json({ success: false, message: e.message });
  }
} 