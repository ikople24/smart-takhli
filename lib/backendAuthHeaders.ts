import { getAuth } from "@clerk/nextjs/server";
import type { NextApiRequest } from "next";

/**
 * Headers สำหรับเรียก express-docker-server (BACKEND_API_URL)
 * ส่ง Bearer จาก client ถ้ามี ไม่เช่นนั้นใช้ session token จาก Clerk (getToken)
 */
export async function backendAuthHeaders(req: NextApiRequest): Promise<Record<string, string>> {
  const appId = process.env.NEXT_PUBLIC_APP_ID || "";
  const headers: Record<string, string> = {
    "x-app-id": appId,
  };

  const raw =
    (typeof req.headers.authorization === "string" && req.headers.authorization) ||
    (Array.isArray(req.headers.authorization) && req.headers.authorization[0]) ||
    (typeof req.headers.Authorization === "string" && req.headers.Authorization) ||
    (Array.isArray(req.headers.Authorization) && req.headers.Authorization[0]) ||
    "";

  if (raw) {
    headers.Authorization = raw.startsWith("Bearer ") ? raw : `Bearer ${raw}`;
    return headers;
  }

  const { getToken } = getAuth(req);
  const token = await getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}
