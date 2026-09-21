import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { importWorkbook } from '../importWorkbook';

// สร้าง workbook ปลอมที่มีโครงเหมือนไฟล์จริง: header + แถวรายวัน + แถว "รวม"
function makeWorkbook({ sheetName = 'ต.ค.68', headers, rows, totalRow }) {
  const workbook = XLSX.utils.book_new();
  const aoa = [['วันที่', ...headers, 'Total'], ...rows];
  // เซลล์ Total ของแถว "รวม" ต้องเป็นผลรวมจริงของ totalRow เหมือนไฟล์จริง —
  // ปล่อยว่างไว้จะทำให้ด่านเทียบ Total ใหม่ (15A) เห็นเป็นค่าไม่ตรงเองทุกเคส
  if (totalRow) {
    const grandTotal = totalRow.reduce((sum, value) => sum + (Number(value) || 0), 0);
    aoa.push(['รวม', ...totalRow, grandTotal]);
  }
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(aoa), sheetName);
  return workbook;
}

describe('importWorkbook — workbook สังเคราะห์', () => {
  it('อ่านแถวรายวันเป็น record พร้อมยอดกลุ่มที่คำนวณแล้ว', () => {
    const workbook = makeWorkbook({
      headers: ['ขวดพลาสติก PET', 'ปุ๋ย'],
      rows: [
        [1, 45, 237, 282],
        [2, 93, 177, 270],
      ],
      totalRow: [138, 414],
    });

    const result = importWorkbook(workbook);

    expect(result.fiscalYear).toBe(2569);
    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toMatchObject({
      recordDate: '2025-10-01', // ต.ค.68 = ต.ค. พ.ศ. 2568 = ค.ศ. 2025 — ไม่ใช่ 2026
      fiscalYear: 2569,
      totalKg: 282,
    });
    expect(result.records[0].groupTotals.plastic).toBe(45);
    expect(result.records[0].groupTotals.foodWaste).toBe(237);
    expect(result.verification.ok).toBe(true);
  });

  it('รับ alias "สายไฟ" เป็นเปลือกสายไฟ (กลุ่มพลาสติก)', () => {
    const workbook = makeWorkbook({
      headers: ['สายไฟ'],
      rows: [[1, 12, 12]],
      totalRow: [12],
    });

    const result = importWorkbook(workbook);
    expect(result.records[0].entries).toEqual([
      { typeKey: 'plastic_wire_sheath', group: 'plastic', kg: 12 },
    ]);
  });

  it('หัวคอลัมน์ที่ไม่รู้จัก → throw ไม่ข้ามเงียบ', () => {
    const workbook = makeWorkbook({
      headers: ['ทองแดง'],
      rows: [[1, 5, 5]],
      totalRow: [5],
    });
    expect(() => importWorkbook(workbook)).toThrow(/ทองแดง/);
  });

  it('ข้ามวันที่เกินจำนวนวันของเดือน และวันที่ไม่มีข้อมูลเลย', () => {
    const workbook = makeWorkbook({
      sheetName: 'ก.พ.69', // ก.พ. 2026 มี 28 วัน
      headers: ['ปุ๋ย'],
      rows: [
        [1, 10, 10],
        [2, '', ''], // ไม่มีข้อมูล → ไม่สร้าง record
        [29, 99, 99], // ไม่มีอยู่จริง → ข้าม
        [30, 99, 99],
      ],
      totalRow: [10],
    });

    const result = importWorkbook(workbook);
    expect(result.records.map((r) => r.recordDate)).toEqual(['2026-02-01']);
    expect(result.verification.ok).toBe(true);
  });

  it('ยอดที่อ่านได้ไม่ตรงแถว "รวม" → verification.ok = false พร้อมรายละเอียด', () => {
    const workbook = makeWorkbook({
      headers: ['ปุ๋ย'],
      rows: [[1, 10, 10]],
      totalRow: [999],
    });

    const result = importWorkbook(workbook);
    expect(result.verification.ok).toBe(false);
    expect(result.verification.months[0].diffs).toEqual([
      { typeKey: 'food_waste_compost', expected: 999, actual: 10 },
    ]);
  });

  it('ชีตที่ไม่มีแถว "รวม" ให้ตรวจไม่ผ่าน (ไม่เดาว่าถูก)', () => {
    const workbook = makeWorkbook({
      headers: ['ปุ๋ย'],
      rows: [[1, 10, 10]],
      totalRow: null,
    });
    expect(importWorkbook(workbook).verification.ok).toBe(false);
  });

  it('ชีตสรุปถูกข้าม ไม่ถูกตีความเป็นเดือน', () => {
    const workbook = makeWorkbook({
      headers: ['ปุ๋ย'],
      rows: [[1, 10, 10]],
      totalRow: [10],
    });
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([['ประเภทขยะ']]),
      'รวมละเอียด'
    );
    expect(() => importWorkbook(workbook)).not.toThrow();
    expect(importWorkbook(workbook).verification.months).toHaveLength(1);
  });

  it('คอลัมน์หัวว่างแต่มีตัวเลขอยู่ → throw ไม่ข้ามเงียบ', () => {
    const workbook = makeWorkbook({
      headers: ['ปุ๋ย', ''],
      rows: [[1, 10, 500, 510]],
      totalRow: [10, 500],
    });
    expect(() => importWorkbook(workbook)).toThrow(/หัวคอลัมน์ว่าง/);
  });

  it('คอลัมน์หัวว่างที่ไม่มีข้อมูลเลย ข้ามได้ตามปกติ (ไฟล์จริงมีคอลัมน์ท้ายแบบนี้)', () => {
    const workbook = makeWorkbook({
      headers: ['ปุ๋ย', ''],
      rows: [[1, 10, '', 10]],
      totalRow: [10, ''],
    });
    expect(importWorkbook(workbook).verification.ok).toBe(true);
  });

  it('ยอดรวมของเดือนไม่ตรงเซลล์ Total ในแถว "รวม" → verification.ok = false', () => {
    const workbook = makeWorkbook({
      headers: ['ปุ๋ย'],
      rows: [[1, 10, 10]],
      totalRow: [10],
    });
    // แก้เฉพาะเซลล์ Total ของแถว "รวม" ให้เพี้ยน — รายคอลัมน์ยังตรงอยู่
    workbook.Sheets['ต.ค.68'].C3 = { t: 'n', v: 999 };
    expect(importWorkbook(workbook).verification.ok).toBe(false);
    expect(importWorkbook(workbook).verification.months[0].totalMismatch).toEqual({
      expected: 999,
      actual: 10,
    });
  });
});

// ตรวจกับไฟล์จริง — ตั้ง SMART_WASTE_FIXTURE_DIR ชี้ไปโฟลเดอร์ที่มีไฟล์ 2 ไฟล์นี้
// เช่น: SMART_WASTE_FIXTURE_DIR=~/Downloads npm test
const fixtureDir = process.env.SMART_WASTE_FIXTURE_DIR;
const realFiles = [
  { file: 'ขยะรีไซเคิลและขยะเปียก - 2568.xlsx', fiscalYear: 2568, totalKg: 245509 },
  { file: 'ขยะรีไซเคิลและขยะเปียก - 2569.xlsx', fiscalYear: 2569, totalKg: 42196 },
];

describe.skipIf(!fixtureDir)('importWorkbook — ไฟล์จริง', () => {
  for (const { file, fiscalYear, totalKg } of realFiles) {
    it(`${file} → ปีงบ ${fiscalYear} ยอดรวม ${totalKg} กก. ตรงกับชีต "รวม"`, () => {
      // ⚠️ ห้ามใช้ XLSX.readFile() ที่นี่ — vitest resolve xlsx ไปที่ ESM build (xlsx.mjs)
      // ซึ่งไม่ผูก fs ไว้ในตัว จะได้ error "Cannot access file" ทั้งที่ไฟล์มีอยู่จริง
      // (ตรวจแล้วกับไฟล์จริงในเครื่อง) — อ่าน buffer เองแล้วส่งเข้า XLSX.read แทน
      const buffer = fs.readFileSync(path.join(fixtureDir, file));
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const result = importWorkbook(workbook);

      expect(result.fiscalYear).toBe(fiscalYear);
      expect(result.verification.ok).toBe(true);
      expect(result.verification.totalKg).toBe(totalKg);
    });
  }
});
