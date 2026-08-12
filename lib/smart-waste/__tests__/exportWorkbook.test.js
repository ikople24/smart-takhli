import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { buildExportWorkbook } from '../exportWorkbook';
import { WASTE_TYPES_SEED } from '../wasteTypesSeed';

const TYPES = WASTE_TYPES_SEED.map((type) => ({
  key: type.key,
  label: type.label,
  group: type.group,
  order: type.order,
  isHighlighted: Boolean(type.isHighlighted),
}));

function sheetRows(workbook, sheetName) {
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    blankrows: false,
    defval: '',
  });
}

const RECORDS = [
  {
    recordDate: '2025-10-01',
    entries: [
      { typeKey: 'plastic_pet', group: 'plastic', kg: 45 },
      { typeKey: 'food_waste_compost', group: 'foodWaste', kg: 237 },
      { typeKey: 'plastic_soft_bag', group: 'plastic', kg: 223 },
    ],
    totalKg: 505,
  },
  {
    recordDate: '2025-10-02',
    entries: [{ typeKey: 'plastic_pet', group: 'plastic', kg: 93 }],
    totalKg: 93,
  },
];

describe('buildExportWorkbook', () => {
  const workbook = buildExportWorkbook({ fiscalYear: 2569, types: TYPES, records: RECORDS });

  it('มี 14 ชีต เรียง รวม → รวมละเอียด → 12 เดือน เหมือนไฟล์ต้นฉบับ', () => {
    expect(workbook.SheetNames).toHaveLength(14);
    expect(workbook.SheetNames[0]).toBe('รวม');
    expect(workbook.SheetNames[1]).toBe('รวมละเอียด');
    expect(workbook.SheetNames[2]).toBe('ต.ค.68');
    expect(workbook.SheetNames[13]).toBe('ก.ย.69');
  });

  it('ชีตรายเดือนมีแถวครบทุกวัน + แถวรวม + แถวเฉลี่ย', () => {
    const rows = sheetRows(workbook, 'ต.ค.68');
    expect(rows[0][0]).toBe('วันที่');
    expect(rows[0][1]).toBe('กระดาษรวม'); // คอลัมน์เรียงตาม order
    expect(rows[1][0]).toBe(1);
    expect(rows[31][0]).toBe(31); // ต.ค. มี 31 วัน
    expect(rows[32][0]).toBe('รวม');
    expect(rows[33][0]).toBe(''); // แถวเฉลี่ยต่อวัน ไม่มีป้ายชื่อ เหมือนไฟล์เดิม
  });

  it('ช่องที่ไม่มีข้อมูลเว้นว่าง ไม่ใส่ 0 (ให้หน้าตาตรงไฟล์เดิม)', () => {
    const rows = sheetRows(workbook, 'ต.ค.68');
    const petColumn = TYPES.findIndex((t) => t.key === 'plastic_pet') + 1;
    expect(rows[1][petColumn]).toBe(45); // วันที่ 1 มีข้อมูล
    expect(rows[3][petColumn]).toBe(''); // วันที่ 3 ไม่มี
  });

  it('แถวรวมของเดือนตรงกับผลบวกรายวัน', () => {
    const rows = sheetRows(workbook, 'ต.ค.68');
    const petColumn = TYPES.findIndex((t) => t.key === 'plastic_pet') + 1;
    const totalColumn = TYPES.length + 1;
    expect(rows[32][petColumn]).toBe(138);
    expect(rows[32][totalColumn]).toBe(598);
  });

  it('ชีต "รวม" มี 8 กลุ่มเรียงตามลำดับเดิม + คอลัมน์ SUM/Avg.', () => {
    const rows = sheetRows(workbook, 'รวม');
    expect(rows[0][0]).toBe('');
    expect(rows[0][1]).toBe('ต.ค. 68');
    expect(rows[0][13]).toBe('SUM');
    expect(rows[0][14]).toBe('Avg.');
    expect(rows.slice(1, 9).map((row) => row[0])).toEqual([
      'กระดาษ', 'พลาสติก', 'อะลูมิเนียม', 'เหล็ก',
      'โลหะผสม', 'แก้ว', 'เศษอาหาร', 'นุ่น',
    ]);
    expect(rows[2][1]).toBe(361); // พลาสติก ต.ค. = 45 + 223 + 93
    expect(rows[2][13]).toBe(361); // SUM ทั้งปี
  });

  it('มีแถว รวม / เฉลี่ยต่อวัน / เฉพาะ<label> / Recheck ต่อท้าย', () => {
    const rows = sheetRows(workbook, 'รวม');
    const labels = rows.map((row) => row[0]);
    expect(labels).toContain('รวม');
    expect(labels).toContain('เฉลี่ยต่อวัน');
    expect(labels).toContain('เฉพาะถุงอ่อน'); // มาจากธง isHighlighted
    expect(labels).toContain('Recheck');
  });

  it('แถว "เฉพาะ" ขึ้นตามธง isHighlighted ไม่ hardcode ถุงอ่อน', () => {
    const custom = buildExportWorkbook({
      fiscalYear: 2569,
      types: TYPES.map((type) => ({
        ...type,
        isHighlighted: type.key === 'plastic_pet',
      })),
      records: RECORDS,
    });
    const labels = sheetRows(custom, 'รวม').map((row) => row[0]);
    expect(labels).toContain('เฉพาะขวดพลาสติก PET');
    expect(labels).not.toContain('เฉพาะถุงอ่อน');
  });

  it('ชีต "รวมละเอียด" มี 24 ประเภท + แถวรวม', () => {
    const rows = sheetRows(workbook, 'รวมละเอียด');
    expect(rows[0][0]).toBe('ประเภทขยะ');
    expect(rows).toHaveLength(26); // header + 24 ประเภท + รวม
    expect(rows[1][0]).toBe('กระดาษรวม');
    expect(rows[25][0]).toBe('รวม');
  });

  it('ปีงบที่ไม่มีข้อมูลเลยยังได้ไฟล์โครงครบ 14 ชีต ไม่ throw', () => {
    const empty = buildExportWorkbook({ fiscalYear: 2570, types: TYPES, records: [] });
    expect(empty.SheetNames).toHaveLength(14);
    const rows = sheetRows(empty, 'รวม');
    expect(rows[1][13]).toBe(0); // SUM ของกระดาษ = 0
  });
});
