import { readFile } from "node:fs/promises";
import formidable from "formidable";
import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "./_auth";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10-ingest");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  const form = formidable({ maxFileSize: 100 * 1024 * 1024 });
  let fields, files;
  try { [fields, files] = await form.parse(req); }
  catch { return res.status(400).json({ error: "อัปโหลดไฟล์ไม่สำเร็จ" }); }

  const file = Array.isArray(files.file) ? files.file[0] : files.file;
  if (!file) return res.status(400).json({ error: "ไม่พบไฟล์ (field name ต้องเป็น 'file')" });
  const period = Array.isArray(fields.period) ? fields.period[0] : fields.period;
  if (!period) return res.status(400).json({ error: "ต้องระบุ period เช่น 2569-01" });

  try {
    const buffer = await readFile(file.filepath);
    await dbConnect();
    const { ingestZip } = await import("@/lib/m10-ingest/ingest");
    const result = await ingestZip(buffer, { period });
    return res.status(200).json(result);
  } catch (e) {
    console.error("m10 ingest error", e);
    return res.status(500).json({ error: e?.message || "ingest ล้มเหลว" });
  }
}
