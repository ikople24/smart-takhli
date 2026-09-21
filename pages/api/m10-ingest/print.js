import dbConnect from "@/lib/dbConnect";
import { requireM10Admin } from "./_auth";
import { logAuditEvent } from "@/lib/auditLogger";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireM10Admin(req, "/admin/m10");
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message });

  const period = String(req.query.period || "");
  if (!/^\d{4}-\d{2}$/.test(period)) {
    return res.status(400).json({ error: "period ต้องเป็นรูปแบบ YYYY-MM เช่น 2569-01" });
  }

  await dbConnect();
  const { listPrintRows } = await import("@/lib/m10-ingest/repository/index");
  const { buildBook } = await import("@/lib/m10-ingest/print/buildBook");

  const { rows, batchCount } = await listPrintRows(period);
  if (batchCount === 0) {
    return res.status(404).json({ error: `ยังไม่มีข้อมูลนำเข้าของงวด ${period}` });
  }

  const book = buildBook(rows, { period });

  // เอกสารชุดนี้พิมพ์เลขบัตร 13 หลักเต็ม — บันทึกทุกครั้งที่มีการเปิด/สั่งพิมพ์
  await logAuditEvent({
    actorClerkId: auth.userId,
    actorName: auth.name || "",
    action: "data_exported",
    resourceType: "system",
    resourceId: `m10-print:${period}`,
    description: `พิมพ์เล่มบัญชีคุมนิติกรรม งวด ${book.periodLabel}`,
    meta: {
      module: "m10-print",
      period,
      sheets: book.cover.totals.sheets,
      rows: book.cover.totals.all,
    },
  });

  return res.status(200).json({
    ...book,
    batchCount,
    printedAt: new Date().toISOString(),
    printedBy: auth.name || "",
  });
}
