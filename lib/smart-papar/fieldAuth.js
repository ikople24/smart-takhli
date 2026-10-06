// สิทธิ์เจ้าหน้าที่ภาคสนามแบบไม่ต้องล็อกอิน — ใส่รหัส (env FLUSHING_FIELD_PIN) ครั้งเดียวแล้วจำเครื่อง
// token = base64url(payload) + "." + HMAC — กุญแจ HMAC ผูกกับ PIN ด้วย จึง "เปลี่ยน PIN = ทุกเครื่องหลุดหมด"
// ใช้ได้ฝั่งเซิร์ฟเวอร์เท่านั้น (node:crypto) · ห้ามเขียน PIN ลงโค้ด — repo นี้เป็น public
import crypto from "node:crypto";

export const FIELD_COOKIE = "sp_field";
export const FIELD_TOKEN_MAX_AGE_SEC = 180 * 24 * 60 * 60;

function hmacKey({ serverSecret, pin }) {
  return crypto.createHash("sha256").update(`smart-papar-field|${serverSecret}|${pin}`).digest();
}

function sign(data, key) {
  return crypto.createHmac("sha256", hmacKey(key)).update(data).digest("base64url");
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export function signFieldToken({ name, deviceId }, key, now = new Date()) {
  const payload = { name, deviceId, iat: Math.floor(now.getTime() / 1000) };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data, key)}`;
}

// คืน { name, deviceId, iat } หรือ null
export function verifyFieldToken(token, key, now = new Date()) {
  if (!key?.serverSecret || !key?.pin || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  if (!safeEqual(sig, sign(data, key))) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof payload?.name !== "string" || typeof payload?.iat !== "number") return null;
  if (Math.floor(now.getTime() / 1000) - payload.iat > FIELD_TOKEN_MAX_AGE_SEC) return null;
  return { name: payload.name, deviceId: String(payload.deviceId || ""), iat: payload.iat };
}

export function pinMatches(input, pin) {
  if (!pin || typeof input !== "string") return false;
  return safeEqual(input.trim(), String(pin));
}

export function validateFieldName(name) {
  if (typeof name !== "string") return null;
  const n = name.trim();
  return n.length >= 2 && n.length <= 60 ? n : null;
}

// นับการใส่รหัสผิดต่อ key (IP) — ผิดครบ max ภายใน windowMs → ล็อกจนครบ windowMs นับจากครั้งแรก
// เก็บในหน่วยความจำ (Railway รัน instance เดียว) — รีสตาร์ทแล้วตัวนับหาย ยอมรับได้
export function createAttemptLimiter({ max, windowMs }) {
  const hits = new Map(); // key -> { count, since }
  const current = (key, now) => {
    const h = hits.get(key);
    if (!h || now - h.since > windowMs) return null;
    return h;
  };
  return {
    isLocked(key, now = Date.now()) {
      const h = current(key, now);
      return Boolean(h && h.count >= max);
    },
    fail(key, now = Date.now()) {
      const h = current(key, now);
      if (h) h.count += 1;
      else hits.set(key, { count: 1, since: now });
      if (hits.size > 5000) hits.clear(); // กันหน่วยความจำบวมจากการยิงหลาย IP
    },
    succeed(key) {
      hits.delete(key);
    },
  };
}

// อ่านค่าคอนฟิกจาก env — serverSecret ใช้ CLERK_SECRET_KEY (มีอยู่แล้วทุกดีพลอย ไม่ public)
export function fieldKeyFromEnv(env = process.env) {
  return { serverSecret: env.CLERK_SECRET_KEY || "", pin: (env.FLUSHING_FIELD_PIN || "").trim() };
}

export function readFieldSession(req, env = process.env) {
  return verifyFieldToken(req.cookies?.[FIELD_COOKIE], fieldKeyFromEnv(env));
}
