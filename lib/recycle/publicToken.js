// รหัสสุ่มประจำบัตรสมาชิก — ฝังใน QR: /recycle/m/<publicToken>
// ใช้แทนรหัส PS-xxxx ที่เรียงเลขเดาได้ เพราะหน้าสมาชิกเปิดดูได้โดยไม่ต้องยืนยันตัวตน
// ⚠️ เปลี่ยน token ของสมาชิก = บัตร QR ใบเดิมใช้ไม่ได้ (ใช้เมื่อบัตรหาย/ต้องออกบัตรใหม่เท่านั้น)
import crypto from "crypto";

const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"; // ตัดตัวที่สับสน 0/O/1/l/I
export const PUBLIC_TOKEN_LENGTH = 12; // 55^12 ≈ 7.6e20 — สุ่มเดาไม่ได้ในทางปฏิบัติ

export function generatePublicToken() {
  const bytes = crypto.randomBytes(PUBLIC_TOKEN_LENGTH);
  let out = "";
  for (let i = 0; i < PUBLIC_TOKEN_LENGTH; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function isPublicToken(s) {
  return typeof s === "string" && new RegExp(`^[${ALPHABET}]{${PUBLIC_TOKEN_LENGTH}}$`).test(s);
}

/** ใส่ token ให้สมาชิกที่ยังไม่มี (สมาชิกที่สร้างก่อนมีฟีเจอร์นี้) — คืน array เดิมพร้อม token */
export async function ensurePublicTokens(Model, members) {
  for (const m of members) {
    if (m.publicToken) continue;
    for (let attempt = 0; attempt < 3; attempt++) {
      const token = generatePublicToken();
      try {
        const r = await Model.updateOne(
          { _id: m._id, $or: [{ publicToken: { $exists: false } }, { publicToken: null }, { publicToken: "" }] },
          { $set: { publicToken: token } }
        );
        if (r.modifiedCount === 1) m.publicToken = token;
        else m.publicToken = (await Model.findById(m._id).select("publicToken").lean())?.publicToken;
        break;
      } catch (e) {
        if (e?.code !== 11000) throw e; // ชนกัน (แทบเป็นไปไม่ได้) → สุ่มใหม่
      }
    }
  }
  return members;
}
