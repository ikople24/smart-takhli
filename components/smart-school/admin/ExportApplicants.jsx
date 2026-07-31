import { useState } from 'react';
import { SCHOLARSHIP_LEVELS, levelBucket, bucketInfo } from '@/lib/smart-school/scholarshipLevels';
import { renewalStatus } from '@/lib/smart-school/takhliScholarship';

// ปุ่ม export ผู้สมัคร → CSV ไฟล์เดียว จัดกลุ่มตาม 5 กลุ่มทุน (scholarshipLevels.js)
// รูปแบบ CSV/BOM ยึดแพตเทิร์นเดียวกับ components/complaints/ExportComplaints.js (เปิดใน Excel ไทยไม่เพี้ยน)

// ระดับที่ map bucket ไม่ได้ ไปกองท้ายไฟล์กลุ่มนี้ (จะได้ไม่หายไปเงียบ ๆ)
const UNKNOWN_KEY = '__unknown__';

const RENEWAL_LABEL = { old: 'เก่า', new: 'ใหม่', unknown: 'ไม่ระบุ' };

const HEADERS = [
  'ลำดับจัดสรร',
  'รหัสใบสมัคร',
  'ชื่อ-นามสกุล',
  'เบอร์โทร',
  'โรงเรียน/สถานศึกษา',
  'ชั้นปี',
  'GPA',
  'ที่อยู่',
  'รายได้ครัวเรือน/ปี',
  'สมาชิกครัวเรือน',
  'รายเก่า/ใหม่',
  'สถานะ',
  'เงินทุน',
  'ลิงก์แผนที่',
];

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function mapsLink(location) {
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  if (!location || Number.isNaN(lat) || Number.isNaN(lng)) return '';
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function rowCells(row) {
  return [
    row.scholarshipRank ?? '',
    row.applicationId || '',
    `${row.prefix || ''}${row.name || ''}`.trim(),
    row.phone || '',
    row.schoolName || '',
    row.gradeLevel || '',
    row.gpa ?? '',
    row.address || '',
    row.annualIncome ?? '',
    row.householdMembers ?? '',
    RENEWAL_LABEL[renewalStatus(row).kind] || '',
    row.status || '',
    row.scholarshipAmount ?? '',
    mapsLink(row.location),
  ];
}

// เรียงในกลุ่ม: มีลำดับจัดสรรก่อน (น้อย→มาก) แล้วค่อยตัวที่ยังไม่ให้ลำดับ (เรียงตามชื่อ)
function sortInGroup(a, b) {
  const ra = a.scholarshipRank;
  const rb = b.scholarshipRank;
  if (ra != null && rb != null) return ra - rb;
  if (ra != null) return -1;
  if (rb != null) return 1;
  return `${a.name || ''}`.localeCompare(`${b.name || ''}`, 'th');
}

// จัดกลุ่ม rows → [{ key, label, quota, rows }] เรียงตาม SCHOLARSHIP_LEVELS + ท้ายสุด "ไม่ระบุระดับ"
function groupByBucket(rows) {
  const buckets = {};
  for (const r of rows) {
    const key = levelBucket(r.educationLevel) || UNKNOWN_KEY;
    (buckets[key] = buckets[key] || []).push(r);
  }
  const ordered = SCHOLARSHIP_LEVELS.filter((b) => buckets[b.key]).map((b) => ({
    key: b.key,
    label: b.label,
    quota: b.quota,
    rows: buckets[b.key].sort(sortInGroup),
  }));
  if (buckets[UNKNOWN_KEY]) {
    ordered.push({
      key: UNKNOWN_KEY,
      label: 'ไม่ระบุระดับ',
      quota: null,
      rows: buckets[UNKNOWN_KEY].sort(sortInGroup),
    });
  }
  return ordered;
}

function buildCsv(rows, year) {
  const groups = groupByBucket(rows);
  const lines = [];
  lines.push(csvCell(`แบบสำรวจผู้ขอทุนการศึกษา ปีงบประมาณ ${year || ''} — รวม ${rows.length} คน`));
  lines.push(''); // เว้นบรรทัด

  for (const g of groups) {
    const quotaText = g.quota != null ? ` · โควตา ${g.quota}` : '';
    lines.push(csvCell(`═══ ${g.label} — ${g.rows.length} คน${quotaText} ═══`));
    lines.push(HEADERS.map(csvCell).join(','));
    for (const r of g.rows) {
      lines.push(rowCells(r).map(csvCell).join(','));
    }
    lines.push(''); // คั่นระหว่างกลุ่ม
  }
  return lines.join('\n');
}

function download(csv, filename) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function ExportApplicants({ rows = [], year }) {
  const [busy, setBusy] = useState(false);
  const disabled = busy || rows.length === 0;

  const handleExport = () => {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      const csv = buildCsv(rows, year);
      download(csv, `ผู้ขอทุน_${year || 'ปีปัจจุบัน'}_แยกระดับ.csv`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={disabled}
      title={rows.length === 0 ? 'ไม่มีข้อมูลให้ส่งออก' : `ส่งออก ${rows.length} คน แยกตามระดับ`}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4DEF3] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#57506A] shadow-sm transition hover:bg-[#F6F3FD] disabled:opacity-40"
    >
      {busy ? (
        <span className="loading loading-spinner loading-xs" />
      ) : (
        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      )}
      <span>Export แยกระดับ</span>
      {rows.length > 0 && <span className="text-[11px] font-normal opacity-60">({rows.length})</span>}
    </button>
  );
}
