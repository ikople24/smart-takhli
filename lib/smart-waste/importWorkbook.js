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

function mapHeaderRow(headerRow, sheetName) {
  const columns = [];
  for (let index = 1; index < headerRow.length; index += 1) {
    const raw = String(headerRow[index] ?? '').trim();
    // คอลัมน์ว่างท้ายตารางและคอลัมน์ Total ไม่ใช่ประเภทขยะ
    if (!raw || raw === 'Total') continue;
    const typeKey = HEADER_TO_TYPE_KEY.get(raw);
    if (!typeKey) {
      throw new Error(
        `importWorkbook: ชีต "${sheetName}" มีหัวคอลัมน์ที่ไม่รู้จัก "${raw}" — ` +
          'เพิ่มประเภทนี้ใน wasteTypesSeed.js หรือ LEGACY_HEADER_ALIASES ก่อนนำเข้า'
      );
    }
    columns.push({ index, typeKey, group: TYPE_BY_KEY.get(typeKey).group });
  }
  return columns;
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
    const columns = mapHeaderRow(rows[0] || [], sheetName);
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
    monthChecks.push({
      sheetName,
      hasTotalRow: Boolean(totalRow),
      ok: Boolean(totalRow) && diffs.length === 0,
      diffs,
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
