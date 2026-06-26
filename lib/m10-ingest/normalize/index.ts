import { type NormalizeOutcome, type RawRow, type DocType, NormalizeError } from "../types";
import { trimAll } from "./trim";
import { classifyStatus } from "./changeType";
import { initialReviewStatus } from "./review";
import { parseArea } from "./area";
import { buildOwner } from "./owner";
import { parcelRecordKey, ns3aRecordKey } from "./ravang";
import { parseThaiDate } from "./date";
import { parseCurrency } from "./currency";

// ชื่อคอลัมน์ (หลัง trim) ต่อ docType — จาก spec §2.1
const MAP: Record<DocType, {
  status: string; date: string; amount: string; deed?: string;
  title: string; name: string; surname: string; id: string;
  rai?: string; ngan?: string; wa?: string; sub?: string;
}> = {
  PARCEL: { status: "สถานะดำเนินการ", date: "วันที่", amount: "REG_AMT", deed: "โฉนด",
    title: "คำนำหน้า", name: "ชื่อ", surname: "นามสกุล", id: "13 หลัก",
    rai: "ไร่", ngan: "งาน", wa: "วา", sub: "เศษ" },
  NS3A: { status: "สถานะ", date: "วันที่", amount: "REG_AMT", deed: "เลขที่นส3ก",
    title: "คำนำหน้า", name: "ชื่อ", surname: "นามสกุล", id: "OWN_PERS_ID",
    rai: "ไร่", ngan: "งาน", wa: "วา", sub: "เศษ" },
  CONSTRUCTION: { status: "สถานะ", date: "วันที่", amount: "REG_AMT",
    title: "คำนำหน้า", name: "ชื่อ", surname: "นามสกุล", id: "13 หลัก" },
};

function buildRecordKey(docType: DocType, raw: Record<string, string>): string | null {
  const g = (k: string) => raw[k] ?? "";
  if (docType === "PARCEL") {
    const utm1 = g("UTM_MAP1"), utm2 = g("UTM_MAP2"), utm3 = g("UTM_MAP3"),
          utm4 = g("UTM_MAP4"), scale = g("UTM_SCALE"), land = g("ที่ดิน");
    if (!utm1 || !utm2 || !utm3 || !utm4 || !scale || !land) {
      throw new NormalizeError("missing_key", `PARCEL key incomplete: UTM_MAP1="${utm1}" UTM_MAP2="${utm2}" UTM_MAP3="${utm3}" UTM_MAP4="${utm4}" UTM_SCALE="${scale}" ที่ดิน="${land}"`);
    }
    return parcelRecordKey({ utm1, utm2, utm3, utm4, scale }, land);
  }
  if (docType === "NS3A") {
    return ns3aRecordKey({ a1: g("UTM_AIRMAP1"), a2: g("UTM_AIRMAP2"), a3: g("UTM_AIRMAP3"), scale: g("UTM_SCALE") }, g("ล.ที่ดิน"));
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
