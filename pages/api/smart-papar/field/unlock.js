// POST /api/smart-papar/field/unlock { pin, name } — เจ้าหน้าที่ภาคสนามใส่รหัสครั้งเดียว แล้วจำเครื่องด้วย cookie 180 วัน
// ไม่ใช้ Clerk · รหัสอยู่ใน env FLUSHING_FIELD_PIN (ไม่ตั้ง = ปิดใช้งาน)
// กันเดารหัส 2 ชั้น: ผิด 5 ครั้ง/IP → ล็อก IP นั้น 15 นาที และผิดรวมทุก IP 30 ครั้ง → ล็อกทั้งระบบ 15 นาที
// (ชั้นรวมมีไว้เพราะ x-forwarded-for ปลอมได้ — สุ่มรหัส 3 หลักครบ 1,000 แบบต้องใช้ ≥ 8 ชม.)
import crypto from "node:crypto";
import {
  FIELD_COOKIE,
  FIELD_TOKEN_MAX_AGE_SEC,
  createAttemptLimiter,
  fieldKeyFromEnv,
  pinMatches,
  signFieldToken,
  validateFieldName,
} from "@/lib/smart-papar/fieldAuth";

const WINDOW_MS = 15 * 60 * 1000;
const limiter = createAttemptLimiter({ max: 5, windowMs: WINDOW_MS });
const globalLimiter = createAttemptLimiter({ max: 30, windowMs: WINDOW_MS });
const GLOBAL = "global";

function clientIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || req.socket?.remoteAddress || "unknown";
}

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const key = fieldKeyFromEnv();
  if (!key.pin || !key.serverSecret) {
    return res.status(503).json({ success: false, message: "ยังไม่เปิดใช้งานการบันทึกภาคสนาม" });
  }

  const ip = clientIp(req);
  if (limiter.isLocked(ip) || globalLimiter.isLocked(GLOBAL)) {
    return res
      .status(429)
      .json({ success: false, message: "ใส่รหัสผิดหลายครั้ง กรุณารอ 15 นาทีแล้วลองใหม่" });
  }

  const { pin, name } = req.body || {};
  const cleanName = validateFieldName(name);
  if (!cleanName) {
    return res.status(400).json({ success: false, message: "กรุณาใส่ชื่อเจ้าหน้าที่ (2–60 ตัวอักษร)" });
  }
  if (!pinMatches(pin, key.pin)) {
    limiter.fail(ip);
    globalLimiter.fail(GLOBAL);
    return res.status(401).json({ success: false, message: "รหัสไม่ถูกต้อง" });
  }
  limiter.succeed(ip);

  const token = signFieldToken({ name: cleanName, deviceId: crypto.randomUUID() }, key);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${FIELD_COOKIE}=${token}; Path=/; Max-Age=${FIELD_TOKEN_MAX_AGE_SEC}; HttpOnly; SameSite=Lax${secure}`
  );
  return res.status(200).json({ success: true, name: cleanName });
}
