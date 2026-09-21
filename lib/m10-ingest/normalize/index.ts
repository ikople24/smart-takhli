import { type NormalizeOutcome, type RawRow, type DocType, NormalizeError } from "../types";
import { trimAll } from "./trim";
import { classifyStatus } from "./changeType";
import { initialReviewStatus } from "./review";
import { parseArea } from "./area";
import { buildOwner } from "./owner";
import { parcelRecordKey, ns3aRecordKey } from "./ravang";
import { parseThaiDate } from "./date";
import { parseCurrency } from "./currency";

// ชื่อคอลัมน์ (หลัง trim) ต่อ docType — ยึดตามไฟล์ดิบที่กรมที่ดินส่งมา (หัวคอลัมน์อังกฤษ)
// ⚠️ ไฟล์งวด 2569-01 ที่นำเข้าครั้งแรกมีคนเปลี่ยนหัวคอลัมน์เป็นไทยด้วยมือก่อนอัปโหลด
// ทำให้โค้ดเดิมผูกกับชื่อไทย แล้วงวด 2569-02 (ไฟล์ดิบ) เข้าไม่ได้เลยทั้งก้อน
// → มาตรฐานคือชื่ออังกฤษเท่านั้น ห้ามกลับไปใช้ชื่อไทย (เจ้าของงานตัดสิน 2026-09-21)
const MAP: Record<DocType, {
  status: string; date: string; amount: string; deed?: string;
  title: string; name: string; surname: string; id: string;
  rai?: string; ngan?: string; wa?: string; sub?: string;
}> = {
  PARCEL: { status: "REG_CODE", date: "REG_DATE", amount: "REG_AMT", deed: "PARCEL_NO",
    title: "OWN_TITLE", name: "OWN_FNAME", surname: "OWN_LNAME", id: "OWN_PERS_ID",
    rai: "RAI", ngan: "NGAN", wa: "WA", sub: "SUBWA" },
  NS3A: { status: "REG_CODE", date: "REG_DATE", amount: "REG_AMT", deed: "NS3A_NO",
    title: "OWN_TITLE", name: "OWN_FNAME", surname: "OWN_LNAME", id: "OWN_PERS_ID",
    rai: "RAI", ngan: "NGAN", wa: "WA", sub: "SUBWA" },
  CONSTRUCTION: { status: "REG_CODE", date: "REG_DATE", amount: "REG_AMT",
    title: "OWN_TITLE", name: "OWN_FNAME", surname: "OWN_LNAME", id: "OWN_PERS_ID" },
};

function buildRecordKey(docType: DocType, raw: Record<string, string>): string | null {
  const g = (k: string) => raw[k] ?? "";
  if (docType === "PARCEL") {
    const utm1 = g("UTM_MAP1"), utm2 = g("UTM_MAP2"), utm3 = g("UTM_MAP3"),
          utm4 = g("UTM_MAP4"), scale = g("UTM_SCALE"), land = g("LAND_NO");
    if (!utm1 || !utm2 || !utm3 || !utm4 || !scale || !land) {
      throw new NormalizeError("missing_key", `PARCEL key incomplete: UTM_MAP1="${utm1}" UTM_MAP2="${utm2}" UTM_MAP3="${utm3}" UTM_MAP4="${utm4}" UTM_SCALE="${scale}" LAND_NO="${land}"`);
    }
    return parcelRecordKey({ utm1, utm2, utm3, utm4, scale }, land);
  }
  if (docType === "NS3A") {
    return ns3aRecordKey({ a1: g("UTM_AIRMAP1"), a2: g("UTM_AIRMAP2"), a3: g("UTM_AIRMAP3"), scale: g("UTM_SCALE") }, g("LAND_NO"));
  }
  return null; // CONSTRUCTION: ไม่มี key แปลง
}

export function normalizeRow(rawRow: RawRow): NormalizeOutcome {
  const raw = trimAll(rawRow.raw);
  const m = MAP[rawRow.docType];
  const g = (k: string) => raw[k] ?? "";
  try {
    const rawStatus = g(m.status);
    const cls = classifyStatus(rawStatus);
    if (!cls) throw new NormalizeError("unknown_status", rawStatus);

    const recordKey = buildRecordKey(rawRow.docType, raw);
    const txnDate = parseThaiDate(g(m.date));
    const regAmount = parseCurrency(g(m.amount));
    const area = m.rai && (raw[m.rai] !== undefined || raw[m.ngan!] !== undefined)
      ? parseArea(g(m.rai), g(m.ngan!), g(m.wa!), g(m.sub!)) : null;
    const owner = buildOwner({ title: g(m.title), name: g(m.name), surname: g(m.surname), id: g(m.id) });

    return {
      ok: true,
      txn: {
        docType: rawRow.docType,
        recordKey,
        deedNo: m.deed ? (g(m.deed) || null) : null,
        rawStatus,
        changeType: cls.changeType,
        taxRelevant: cls.taxRelevant,
        reviewStatus: initialReviewStatus(cls.changeType, recordKey !== null),
        txnDate, regAmount, owner, area, payloadRaw: raw,
      },
    };
  } catch (e) {
    if (e instanceof NormalizeError) return { ok: false, reason: e.reason };
    throw e;
  }
}
