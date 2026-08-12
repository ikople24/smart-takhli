// สร้าง workbook หน้าตาเหมือนไฟล์ Excel เดิม เพื่อให้ส่งรายงานต่อได้ทันที
//
// ค่าที่เขียนลงชีตเป็น "ตัวเลขนิ่ง" ไม่ใช่สูตร — แหล่งความจริงคือฐานข้อมูล ไม่ใช่ชีต
// และสูตรในไฟล์เดิมคือสาเหตุที่ยอดพังเวลาแทรก/ลบแถว
//
// ความต่างจากไฟล์เดิมที่ตั้งใจ:
// 1. layout ของชีต "รวม" ใช้แบบไฟล์ 2569 (SUM/Avg. ท้ายตาราง) กับทุกปีงบ
//    ไฟล์ 2568 วางคอลัมน์รวมไว้หน้า 12 เดือน — ถ้าทำตามทั้งสองแบบจะเทียบปีต่อปีไม่ได้
// 2. Avg. = SUM ÷ จำนวนวันของปีงบ (กก./วัน) นิยามเดียวทุกแถว
//    ไฟล์เดิมใช้สูตรไม่สม่ำเสมอ (บางแถวหารพัน บางแถวไม่หาร) ซึ่งเทียบกันไม่ได้

import * as XLSX from 'xlsx';
import { round2 } from './aggregate';
import { fiscalMonths } from './fiscalYear';
import { WASTE_GROUPS } from './wasteGroups';

// types: [{ key, label, group, order, isHighlighted }]
// records: [{ recordDate, entries: [{ typeKey, group, kg }], totalKg }]
export function buildExportWorkbook({ fiscalYear, types, records }) {
  const months = fiscalMonths(fiscalYear);
  const sortedTypes = [...types].sort((a, b) => a.order - b.order);

  const recordsByMonth = new Map(months.map((month) => [month.key, []]));
  for (const record of records) {
    const bucket = recordsByMonth.get(record.recordDate.slice(0, 7));
    if (bucket) bucket.push(record);
  }

  // ยอดรายเดือน แยกตามประเภทและตามกลุ่ม — ใช้ทั้งชีต "รวม" และ "รวมละเอียด"
  const typeTotalsByMonth = new Map();
  const groupTotalsByMonth = new Map();
  const monthTotals = new Map();

  for (const month of months) {
    const typeTotals = new Map();
    const groupTotals = new Map();
    let monthTotal = 0;
    for (const record of recordsByMonth.get(month.key)) {
      for (const entry of record.entries) {
        typeTotals.set(entry.typeKey, round2((typeTotals.get(entry.typeKey) || 0) + entry.kg));
        groupTotals.set(entry.group, round2((groupTotals.get(entry.group) || 0) + entry.kg));
        monthTotal = round2(monthTotal + entry.kg);
      }
    }
    typeTotalsByMonth.set(month.key, typeTotals);
    groupTotalsByMonth.set(month.key, groupTotals);
    monthTotals.set(month.key, monthTotal);
  }

  const totalDays = months.reduce((sum, month) => sum + month.daysInMonth, 0);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    buildSummarySheet({ months, sortedTypes, groupTotalsByMonth, typeTotalsByMonth, monthTotals, totalDays }),
    'รวม'
  );
  XLSX.utils.book_append_sheet(
    workbook,
    buildDetailSheet({ months, sortedTypes, typeTotalsByMonth, monthTotals }),
    'รวมละเอียด'
  );
  for (const month of months) {
    XLSX.utils.book_append_sheet(
      workbook,
      buildMonthSheet({
        month,
        sortedTypes,
        monthRecords: recordsByMonth.get(month.key),
        typeTotals: typeTotalsByMonth.get(month.key),
        monthTotal: monthTotals.get(month.key),
      }),
      month.sheetName
    );
  }

  return workbook;
}

function buildMonthSheet({ month, sortedTypes, monthRecords, typeTotals, monthTotal }) {
  const recordByDay = new Map(
    monthRecords.map((record) => [Number(record.recordDate.slice(8, 10)), record])
  );

  const aoa = [['วันที่', ...sortedTypes.map((type) => type.label), 'Total']];

  for (let day = 1; day <= month.daysInMonth; day += 1) {
    const record = recordByDay.get(day);
    const kgByType = new Map((record?.entries || []).map((entry) => [entry.typeKey, entry.kg]));
    aoa.push([
      day,
      // เว้นว่างเมื่อไม่มีข้อมูล ไม่ใส่ 0 — ให้หน้าตาตรงกับไฟล์เดิม
      ...sortedTypes.map((type) => (kgByType.has(type.key) ? kgByType.get(type.key) : '')),
      record ? record.totalKg : '',
    ]);
  }

  aoa.push([
    'รวม',
    ...sortedTypes.map((type) => typeTotals.get(type.key) || 0),
    monthTotal,
  ]);
  // แถวสุดท้ายของไฟล์เดิม: เฉลี่ยต่อวัน วางในคอลัมน์ Total โดยไม่มีป้ายชื่อแถว
  aoa.push([
    '',
    ...sortedTypes.map(() => ''),
    month.daysInMonth ? round2(monthTotal / month.daysInMonth) : 0,
  ]);

  return XLSX.utils.aoa_to_sheet(aoa);
}

function buildDetailSheet({ months, sortedTypes, typeTotalsByMonth, monthTotals }) {
  const aoa = [['ประเภทขยะ', ...months.map((month) => month.label)]];
  for (const type of sortedTypes) {
    aoa.push([
      type.label,
      ...months.map((month) => typeTotalsByMonth.get(month.key).get(type.key) || 0),
    ]);
  }
  aoa.push(['รวม', ...months.map((month) => monthTotals.get(month.key))]);
  return XLSX.utils.aoa_to_sheet(aoa);
}

function buildSummarySheet({
  months,
  sortedTypes,
  groupTotalsByMonth,
  typeTotalsByMonth,
  monthTotals,
  totalDays,
}) {
  const aoa = [['', ...months.map((month) => month.label), 'SUM', 'Avg.']];

  const withTotals = (label, valuesPerMonth) => {
    const sum = round2(valuesPerMonth.reduce((acc, value) => acc + value, 0));
    return [label, ...valuesPerMonth, sum, totalDays ? round2(sum / totalDays) : 0];
  };

  for (const group of WASTE_GROUPS) {
    aoa.push(
      withTotals(
        group.label,
        months.map((month) => groupTotalsByMonth.get(month.key).get(group.key) || 0)
      )
    );
  }

  const monthValues = months.map((month) => monthTotals.get(month.key));
  aoa.push(withTotals('รวม', monthValues));

  // เฉลี่ยต่อวันของแต่ละเดือน — ไม่ใช่ยอดสะสม จึงไม่ใช้ withTotals
  const dailyAverages = months.map((month) =>
    month.daysInMonth ? round2(monthTotals.get(month.key) / month.daysInMonth) : 0
  );
  aoa.push([
    'เฉลี่ยต่อวัน',
    ...dailyAverages,
    round2(dailyAverages.reduce((acc, value) => acc + value, 0)),
    '',
  ]);

  // แถว "เฉพาะ<ชื่อประเภท>" ต่อประเภทที่ติดธง isHighlighted
  // (ไฟล์เดิมมีแถว "เฉพาะถุงอ่อน" เพราะเจ้าหน้าที่สนใจตัวนี้เป็นพิเศษ —
  //  ทำเป็นธงเพื่อให้ติดประเภทอื่นเพิ่มได้โดยไม่ต้องแก้โค้ด)
  for (const type of sortedTypes.filter((item) => item.isHighlighted)) {
    aoa.push(
      withTotals(
        `เฉพาะ${type.label}`,
        months.map((month) => typeTotalsByMonth.get(month.key).get(type.key) || 0)
      )
    );
  }

  // Recheck = ยอดรวมซ้ำอีกรอบ ใช้ตาเทียบกับแถว "รวม" เหมือนไฟล์เดิม
  aoa.push(['Recheck', ...monthValues, '', '']);

  return XLSX.utils.aoa_to_sheet(aoa);
}
