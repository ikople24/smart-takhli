// GET /api/smart-papar/field/me — เครื่องนี้ใส่รหัสภาคสนามแล้วหรือยัง (ใช้ตัดสินว่าจะโชว์การ์ดบนหน้าแรกไหม)
// DELETE — ออกจากโหมดเจ้าหน้าที่บนเครื่องนี้ (ลบ cookie)
import { FIELD_COOKIE, readFieldSession } from "@/lib/smart-papar/fieldAuth";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") {
    const session = readFieldSession(req);
    return res
      .status(200)
      .json({ success: true, unlocked: Boolean(session), name: session?.name || "" });
  }
  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", `${FIELD_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
    return res.status(200).json({ success: true });
  }
  res.setHeader("Allow", ["GET", "DELETE"]);
  return res.status(405).json({ success: false, message: "Method not allowed" });
}
