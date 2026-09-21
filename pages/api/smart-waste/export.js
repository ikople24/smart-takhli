import * as XLSX from "xlsx";
import dbConnect from "@/lib/dbConnect";
import WasteDaily from "@/models/smart-waste/WasteDaily";
import WasteType from "@/models/smart-waste/WasteType";
import { buildExportWorkbook } from "@/lib/smart-waste/exportWorkbook";
import { fiscalYearRange } from "@/lib/smart-waste/fiscalYear";
import { requireWasteAdmin } from "./_auth";

export default async function handler(req, res) {
  const auth = await requireWasteAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ message: auth.message });
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const fiscalYear = Number(req.query.fiscalYear);
  if (!Number.isInteger(fiscalYear) || fiscalYear < 2500 || fiscalYear > 2600) {
    return res.status(400).json({ message: "ต้องระบุ fiscalYear เป็นปี พ.ศ." });
  }

  try {
    await dbConnect();
    const { start, end } = fiscalYearRange(fiscalYear);
    const [records, types] = await Promise.all([
      WasteDaily.find({ recordDate: { $gte: start, $lte: end } })
        .sort({ recordDate: 1 })
        .lean(),
      // เอาทุกประเภทรวมที่ปิดใช้งานแล้ว — ปีเก่าอาจมีข้อมูลของประเภทที่เลิกใช้ไปแล้ว
      // _id เป็น tiebreaker: ถ้า order ซ้ำกันแล้วไม่มีตัวตัดสิน ลำดับคอลัมน์ในไฟล์
      // ที่ส่งออกจะสลับไปมาระหว่างการดาวน์โหลดแต่ละครั้ง
      WasteType.find().sort({ order: 1, _id: 1 }).lean(),
    ]);

    return sendWorkbook(res, fiscalYear, types, records);
  } catch (error) {
    console.error("[smart-waste/export]", error);
    return res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
  }
}

function sendWorkbook(res, fiscalYear, types, records) {
  const workbook = buildExportWorkbook({ fiscalYear, types, records });
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const filename = `ขยะรีไซเคิลและขยะเปียก-${fiscalYear}.xlsx`;
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  // ชื่อไฟล์เป็นภาษาไทย → ต้องใช้ filename* (RFC 5987) ไม่งั้นเบราว์เซอร์ได้ชื่อเพี้ยน
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="smart-waste-${fiscalYear}.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`
  );
  return res.status(200).send(buffer);
}
