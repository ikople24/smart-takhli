import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "../_auth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });
  const b = req.body || {};
  if (!b.parcelCode || typeof b.parcelCode !== "string" || !b.parcelCode.trim()) {
    return res.status(400).json({ error: "ต้องระบุรหัสแปลง (parcelCode)" });
  }
  await dbConnect();
  const { applyBasemapEdit } = await import("@/lib/m10-ingest/repository/index");
  const by = auth.name || auth.userId;
  try {
    await applyBasemapEdit({
      parcelCode: b.parcelCode.trim(),
      deedNo: b.deedNo ?? null, landNo: b.landNo ?? null, survey: b.survey ?? null,
      zoneId: b.zoneId ?? null, blockId: b.blockId ?? null, lot: b.lot ?? null, landType: b.landType ?? null,
      area: b.area ?? null, geometry: b.geometry ?? undefined,
      kind: b.kind === "new" ? "new" : "edit", by,
    });
    return res.status(200).json({ ok: true, parcelCode: b.parcelCode.trim() });
  } catch (e) {
    const msg = e?.message || "บันทึกไม่สำเร็จ";
    const isGeom = /รูปแปลง|geo|loop|edges|S2|coordinates|Polygon/i.test(msg);
    return res.status(isGeom ? 422 : 500).json({ error: msg });
  }
}
