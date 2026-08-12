// อ่านไฟล์ Excel รูปแบบเดิม (ปีละ 1 ไฟล์) → records รายวัน + ผลตรวจยอด
// เป็นฟังก์ชัน pure: รับ workbook ที่ parse แล้ว ไม่แตะไฟล์ระบบและไม่แตะ Mongo
// จึงทดสอบได้ตรง ๆ ด้วย vitest

import * as XLSX from 'xlsx';
import { computeTotals, round2 } from './aggregate';
import { parseSheetName } from './fiscalYear';
import { LEGACY_HEADER_ALIASES, WASTE_TYPES_SEED } from './wasteTypesSeed';

// ชีตสรุปในไฟล์ต้นฉบับ — ไม่ใช่ชีตรายเดือน
const SUMMARY_SHEET_NAMES = new Set(['รวม', 'รวมละเอียด']);
const TOTAL_ROW_LABEL = 'รวม';

const TYPE_BY_KEY = new Map(WASTE_TYPES_SEED.map((type) => [type.key, type]));

// หัวคอลัมน์ (ตามที่เขียนในไฟล์) → typeKey
const HEADER_TO_TYPE_KEY = new Map([
  ...WASTE_TYPES_SEED.map((type) => [type.label, type.key]),
  ...Object.entries(LEGACY_HEADER_ALIASES),
]);

// รับ rows ทั้งชีต ไม่ใช่แค่แถวหัว เพราะต้องดูด้วยว่าคอลัมน์ที่หัวว่าง "ว่างจริง" ไหม
function mapHeaderRow(rows, sheetName) {
  const headerRow = rows[0] || [];
  const columns = [];
  let totalColumnIndex = -1;

  for (let index = 1; index < headerRow.length; index += 1) {
    const raw = String(headerRow[index] ?? '').trim();

    if (raw === 'Total') {
      totalColumnIndex = index;
      continue;
    }

    if (!raw) {
      // ไฟล์จริงมีคอลัมน์ว่างต่อท้าย Total — ข้ามได้ แต่ต้องว่างจริงเท่านั้น
      // ถ้ามีตัวเลขอยู่แปลว่าหัวคอลัมน์หาย การข้ามไปเงียบ ๆ = ยอดหายทั้งปี
      // โดย verification ยังขึ้นเขียว เพราะมันตรวจเฉพาะคอลัมน์ที่ map ได้
      const hasData = rows
        .slice(1)
        .some((row) => Number(row?.[index]) > 0);
      if (hasData) {
        throw new Error(
          `importWorkbook: ชีต "${sheetName}" คอลัมน์ที่ ${index + 1} มีตัวเลขอยู่แต่หัวคอลัมน์ว่าง — ` +
            'เติมชื่อประเภทในไฟล์ต้นฉบับก่อนนำเข้า'
        );
      }
      continue;
    }

    const typeKey = HEADER_TO_TYPE_KEY.get(raw);
    if (!typeKey) {
      throw new Error(
        `importWorkbook: ชีต "${sheetName}" มีหัวคอลัมน์ที่ไม่รู้จัก "${raw}" — ` +
          'เพิ่มประเภทนี้ใน wasteTypesSeed.js หรือ LEGACY_HEADER_ALIASES ก่อนนำเข้า'
      );
    }
    columns.push({ index, typeKey, group: TYPE_BY_KEY.get(typeKey).group });
  }

  return { columns, totalColumnIndex };
}

export function importWorkbook(workbook) {
  const monthSheetNames = workbook.SheetNames.filter(
    (name) => !SUMMARY_SHEET_NAMES.has(name)
  );
  if (monthSheetNames.length === 0) {
    throw new Error('importWorkbook: ไม่พบชีตรายเดือนในไฟล์');
  }

  const fiscalYears = new Set();
  const records = [];
  const monthChecks = [];

  for (const sheetName of monthSheetNames) {
    const { year, month, fiscalYear } = parseSheetName(sheetName);
    fiscalYears.add(fiscalYear);

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      blankrows: false,
      defval: '',
    });
    const { columns, totalColumnIndex } = mapHeaderRow(rows, sheetName);
    const daysInMonth = new Date(year, month, 0).getDate();

    // ยอดที่เราบวกได้เอง เอาไว้เทียบกับแถว "รวม" ของชีต
    const readTotals = new Map();

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const day = Number(row[0]);
      // ตัดแถว "รวม", แถวเฉลี่ยท้ายชีต และวันที่ไม่มีอยู่จริงในเดือนนั้นออกพร้อมกัน
      if (!Number.isInteger(day) || day < 1 || day > daysInMonth) continue;

      const entries = [];
      for (const column of columns) {
        const kg = Number(row[column.index]);
        if (!Number.isFinite(kg) || kg <= 0) continue;
        entries.push({ typeKey: column.typeKey, group: column.group, kg: round2(kg) });
        readTotals.set(column.typeKey, round2((readTotals.get(column.typeKey) || 0) + kg));
      }

      // วันที่ไม่มีการบันทึกเลย → ไม่สร้างเอกสารเปล่า
      if (entries.length === 0) continue;

      const { groupTotals, totalKg } = computeTotals(entries);
      records.push({
        recordDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        fiscalYear,
        entries,
        groupTotals,
        totalKg,
      });
    }

    // ตรวจยอด: เทียบรายคอลัมน์กับแถว "รวม" ในชีตต้นฉบับ
    const totalRow = rows.find((row) => String(row[0]).trim() === TOTAL_ROW_LABEL);
    const diffs = [];
    for (const column of columns) {
      const expected = round2(Number(totalRow?.[column.index]) || 0);
      const actual = round2(readTotals.get(column.typeKey) || 0);
      if (expected !== actual) {
        diffs.push({ typeKey: column.typeKey, expected, actual });
      }
    }

    // เทียบยอดรวมทั้งเดือนกับเซลล์ Total ของแถว "รวม" อีกชั้น —
    // ด่านนี้จับ "คอลัมน์หายไปหนึ่งคอลัมน์" ได้ทุกกรณี ไม่ว่าจะหายด้วยสาเหตุอะไร
    let totalMismatch = null;
    if (totalRow && totalColumnIndex >= 0) {
      const expectedTotal = round2(Number(totalRow[totalColumnIndex]) || 0);
      const actualTotal = round2(
        [...readTotals.values()].reduce((sum, value) => sum + value, 0)
      );
      if (expectedTotal !== actualTotal) {
        totalMismatch = { expected: expectedTotal, actual: actualTotal };
      }
    }

    monthChecks.push({
      sheetName,
      hasTotalRow: Boolean(totalRow),
      ok: Boolean(totalRow) && diffs.length === 0 && !totalMismatch,
      diffs,
      totalMismatch,
    });
  }

  if (fiscalYears.size !== 1) {
    throw new Error(
      `importWorkbook: ไฟล์เดียวต้องเป็นปีงบเดียว แต่พบ ${[...fiscalYears].join(', ')}`
    );
  }

  return {
    fiscalYear: [...fiscalYears][0],
    records,
    verification: {
      ok: monthChecks.every((check) => check.ok),
      months: monthChecks,
      totalKg: round2(records.reduce((sum, record) => sum + record.totalKg, 0)),
      recordCount: records.length,
    },
  };
}
