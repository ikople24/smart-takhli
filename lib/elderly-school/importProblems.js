// รวมปัญหาของการนำเข้าชีตเป็นรายการเดียว (แถวที่ข้าม + คำเตือนรายแถว + เลขบัตรซ้ำ) และแปลงเป็น CSV
// ไม่มี DB — ใช้ใน pages/api/elderly-school/import.js และปุ่มดาวน์โหลดในแท็บนำเข้าข้อมูล

const MAX_PROBLEMS = 1000;

function last4(id) {
  const d = String(id || "").replace(/\D/g, "");
  return d ? d.slice(-4) : "";
}

/**
 * entries = [{ row, parsed }] — row = เลขแถวในชีต (แถวหัวตาราง = 1), parsed = ผลของ parseSheetRowToPersonAndVisits
 * คืน { problems, skippedRows, warningRows, warnings, truncated }
 */
export function collectProblems(entries) {
  const problems = [];
  const firstRowByCitizen = new Map();
  let skippedRows = 0;
  let warnings = 0;
  const warnRows = new Set();

  for (const { row, parsed } of entries || []) {
    if (!parsed) continue;
    if (parsed.skip) {
      skippedRows++;
      problems.push({
        row,
        level: "skip",
        fullName: parsed.fullName || "",
        citizenLast4: last4(parsed.citizenId),
        message: `ข้ามแถวนี้: ${parsed.reasonTh || "ข้อมูลไม่ครบ"}`,
      });
      continue;
    }
    const citizenId = parsed.person?.citizenId;
    const base = { row, fullName: parsed.person?.fullName || "", citizenLast4: last4(citizenId) };
    const messages = [...(parsed.issues || [])];
    if (citizenId) {
      const prev = firstRowByCitizen.get(citizenId);
      if (prev) messages.push(`เลขบัตรซ้ำกับแถว ${prev} — ใช้ข้อมูลแถวหลังสุดแทน`);
      else firstRowByCitizen.set(citizenId, row);
    }
    for (const message of messages) {
      warnings++;
      warnRows.add(row);
      problems.push({ ...base, level: "warn", message });
    }
  }

  return {
    problems: problems.slice(0, MAX_PROBLEMS),
    truncated: problems.length > MAX_PROBLEMS,
    skippedRows,
    warningRows: warnRows.size,
    warnings,
  };
}

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV (มี BOM ให้ Excel อ่านภาษาไทยถูก) — คอลัมน์: แถว, ระดับ, ชื่อ, เลขบัตร 4 ตัวท้าย, ปัญหา */
export function problemsToCsv(problems) {
  const header = ["แถวในชีต", "ระดับ", "ชื่อ-นามสกุล", "เลขบัตร 4 ตัวท้าย", "ปัญหา"];
  const lines = [header, ...(problems || []).map((p) => [p.row, p.level === "skip" ? "ข้าม" : "เตือน", p.fullName, p.citizenLast4, p.message])];
  return "﻿" + lines.map((l) => l.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
