// หลายแถว → เล่มพิมพ์ทั้งเล่ม (ใบปก + หมวด + ลำดับหน้า) · pure ไม่แตะ DB
import { buildSheet, type PrintSheet, type PrintTxnRow } from "./buildSheet";
import { changeTypeLabel, changeTypeRank, docTypeLabel, docTypeRank, periodLabel } from "./labels";

export interface PrintCoverRow {
  docType: string;
  docTypeLabel: string;
  rawStatus: string;
  changeType: string;
  changeTypeLabel: string;
  taxRelevant: boolean;
  count: number;
  keyed: number;
  pendingKey: number;
}

export interface PrintTotals {
  all: number;
  taxRelevant: number;
  nonTaxRelevant: number;
  sheets: number;
}

export interface PrintSection {
  docType: string;
  docTypeLabel: string;
  changeType: string;
  changeTypeLabel: string;
  count: number;
  sheets: PrintSheet[];
}

export interface PrintBookData {
  period: string;
  periodLabel: string;
  cover: { rows: PrintCoverRow[]; totals: PrintTotals };
  sections: PrintSection[];
}

// key ของ Map เป็น JSON ของ tuple — กันกรณี rawStatus ไทยมีอักขระคั่นปนมา
const groupKey = (a: string, b: string): string => JSON.stringify([a, b]);
const splitKey = (key: string): [string, string] => JSON.parse(key) as [string, string];

/** เรียงแผ่นในหมวด: วันที่ → เลขโฉนด → recordKey (ผลคงที่ พิมพ์ซ้ำได้เหมือนเดิม) */
function compareRows(a: PrintTxnRow, b: PrintTxnRow): number {
  const ta = new Date(a.txnDate).getTime();
  const tb = new Date(b.txnDate).getTime();
  if (ta !== tb) return ta - tb;
  const da = a.deedNo ?? "";
  const db = b.deedNo ?? "";
  if (da !== db) return da < db ? -1 : 1;
  const ka = a.recordKey ?? "";
  const kb = b.recordKey ?? "";
  return ka === kb ? 0 : ka < kb ? -1 : 1;
}

function isPendingKey(row: PrintTxnRow): boolean {
  if (!row.taxRelevant) return false;
  return row.ltaxStatus !== "keyed" && row.ltaxStatus !== "skipped";
}

export function buildBook(rows: PrintTxnRow[], opts: { period: string }): PrintBookData {
  // ---- ใบปก: 1 แถวต่อ (docType × rawStatus) ----
  const coverMap = new Map<string, PrintCoverRow>();
  for (const r of rows) {
    const key = groupKey(r.docType, r.rawStatus);
    const cur = coverMap.get(key);
    if (cur) {
      cur.count += 1;
      if (r.ltaxStatus === "keyed") cur.keyed += 1;
      if (isPendingKey(r)) cur.pendingKey += 1;
      continue;
    }
    coverMap.set(key, {
      docType: r.docType,
      docTypeLabel: docTypeLabel(r.docType),
      rawStatus: r.rawStatus || "-",
      changeType: r.changeType,
      changeTypeLabel: changeTypeLabel(r.changeType),
      taxRelevant: r.taxRelevant,
      count: 1,
      keyed: r.ltaxStatus === "keyed" ? 1 : 0,
      pendingKey: isPendingKey(r) ? 1 : 0,
    });
  }
  const coverRows = [...coverMap.values()].sort((a, b) =>
    docTypeRank(a.docType) - docTypeRank(b.docType) ||
    changeTypeRank(a.changeType) - changeTypeRank(b.changeType) ||
    (a.rawStatus === b.rawStatus ? 0 : a.rawStatus < b.rawStatus ? -1 : 1)
  );

  // ---- หมวด/แผ่นงาน: เฉพาะรายการที่กระทบภาษี ----
  const groups = new Map<string, PrintTxnRow[]>();
  for (const r of rows) {
    if (!r.taxRelevant) continue;
    const key = groupKey(r.docType, r.changeType);
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }

  const orderedKeys = [...groups.keys()].sort((a, b) => {
    const [ad, ac] = splitKey(a);
    const [bd, bc] = splitKey(b);
    return docTypeRank(ad) - docTypeRank(bd) || changeTypeRank(ac) - changeTypeRank(bc);
  });

  let sheetNo = 0;
  const sections: PrintSection[] = orderedKeys.map((key) => {
    const [docType, changeType] = splitKey(key);
    const list = [...groups.get(key)!].sort(compareRows);
    const sheets = list.map((r, i) =>
      buildSheet(r, { seqInSection: i + 1, sectionTotal: list.length, sheetNo: ++sheetNo })
    );
    return {
      docType,
      docTypeLabel: docTypeLabel(docType),
      changeType,
      changeTypeLabel: changeTypeLabel(changeType),
      count: sheets.length,
      sheets,
    };
  });

  const taxRelevant = rows.filter((r) => r.taxRelevant).length;
  return {
    period: opts.period,
    periodLabel: periodLabel(opts.period),
    cover: {
      rows: coverRows,
      totals: {
        all: rows.length,
        taxRelevant,
        nonTaxRelevant: rows.length - taxRelevant,
        sheets: sheetNo,
      },
    },
    sections,
  };
}
