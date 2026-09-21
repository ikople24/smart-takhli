import { readFile, unlink } from "node:fs/promises";
import formidable from "formidable";
import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "./_auth";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  const form = formidable({ maxFileSize: 100 * 1024 * 1024 });
  let fields, files;
  try { [fields, files] = await form.parse(req); }
  catch { return res.status(400).json({ error: "อัปโหลดไฟล์ไม่สำเร็จ" }); }

  const file = Array.isArray(files.file) ? files.file[0] : files.file;
  if (!file) return res.status(400).json({ error: "ไม่พบไฟล์ (field name ต้องเป็น 'file')" });
  const period = Array.isArray(fields.period) ? fields.period[0] : fields.period;
  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return res.status(400).json({ error: "period ต้องเป็นรูปแบบ พ.ศ.-เดือน เช่น 2569-01" });
  }

  // ไฟล์จากกรมที่ดินส่วนใหญ่ใส่รหัสไว้ — ไม่ log ค่านี้
  const rawPass = Array.isArray(fields.password) ? fields.password[0] : fields.password;
  const password = rawPass ? String(rawPass) : undefined;

  try {
    const buffer = await readFile(file.filepath);
    await dbConnect();
    const { ingestZip } = await import("@/lib/m10-ingest/ingest");
    const result = await ingestZip(buffer, { period, password });
    return res.status(200).json(result);
  } catch (e) {
    // รหัสผิด/ไม่ได้กรอก = ความผิดฝั่งผู้ใช้ ตอบ 400 พร้อมข้อความที่แก้ได้เอง
    if (e?.name === "ZipPasswordError") {
      return res.status(400).json({ error: e.message, reason: e.kind });
    }
    console.error("m10 ingest error", e);
    return res.status(500).json({ error: e?.message || "ingest ล้มเหลว" });
  } finally {
    // ลบไฟล์ tmp ที่ formidable เขียนไว้ (มี PII) — ไม่ค้างบนดิสก์
    await unlink(file.filepath).catch(() => {});
  }
}
