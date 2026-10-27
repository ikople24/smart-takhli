// เลขบัตรประชาชนตอนนำเข้าชีต — ในระบบเก็บรูปแบบ "1-2345-67890-12-3" แต่ชีตแต่ละปีพิมพ์มาไม่เหมือนกัน
// ("1234567890123", "1,234,567,890,123" จากช่องตัวเลข ฯลฯ) ต้องเทียบด้วยตัวเลขล้วน ไม่งั้นคนเดิมถูกสร้างซ้ำ
// ไม่มี DB — API ส่งรายชื่อผู้เรียนทั้งหมด ({ _id, citizenId, fullName }) เข้ามา
import { buildNameMatcher } from "./nameMatch";

export function citizenDigits(input) {
  return String(input ?? "").replace(/\D/g, "");
}

/** 13 หลัก → "1-2345-67890-12-3" (รูปแบบเดียวกับข้อมูลเดิมในระบบ) · ไม่ครบ 13 หลัก = null */
export function formatCitizenId(input) {
  const d = citizenDigits(input);
  if (d.length !== 13) return null;
  return `${d[0]}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d[12]}`;
}

/** checksum mod-11 ของบัตรประชาชนไทย */
export function isValidCitizenChecksum(input) {
  const d = citizenDigits(input);
  if (d.length !== 13) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(d[12]);
}

function skipEntry(entry, reasonTh, citizenId) {
  const parsed = entry.parsed;
  entry.parsed = {
    skip: true,
    reason: "citizenId",
    reasonTh,
    fullName: parsed.person?.fullName || null,
    citizenId: citizenId || null,
  };
}

/**
 * ทำเลขบัตรของแถวที่ parse แล้วให้เป็นรูปแบบในระบบ — แก้ entries ในที่ (เรียกหลัง resolveMissingCitizenIds)
 * - ตัวเลขตรงกับคนในระบบ → ใช้เลขบัตรตามที่เก็บในระบบ (parsed.isNew = false)
 * - ไม่ครบ 13 หลัก และไม่ใช่คนเดิม → ข้าม (กันสร้างคนใหม่จากเลขที่พิมพ์ผิด/ถูกแปลงเป็นทศนิยม)
 * - ชื่อตรงกับคนเดิมแต่เลขบัตรต่างกัน → ผูกกับคนเดิม แล้วใช้เลขจากชีตล่าสุด (parsed.replacesCitizenId = เลขเดิม) + คำเตือน
 * - นอกนั้น = ผู้เรียนใหม่ (parsed.isNew = true)
 * คืน { existing, created, changed }
 */
export function resolveCitizenIds(entries, existingPeople) {
  const byDigits = new Map();
  for (const p of existingPeople || []) {
    const d = citizenDigits(p?.citizenId);
    if (d) byDigits.set(d, p);
  }
  const matchName = buildNameMatcher(existingPeople);
  let existing = 0;
  let created = 0;
  let changed = 0;

  for (const entry of entries || []) {
    const parsed = entry?.parsed;
    if (!parsed || parsed.skip || !parsed.person?.citizenId) continue;
    const raw = parsed.person.citizenId;
    const digits = citizenDigits(raw);

    const known = byDigits.get(digits);
    if (known) {
      parsed.person.citizenId = known.citizenId;
      parsed.isNew = false;
      existing++;
      continue;
    }

    if (digits.length !== 13) {
      const looksDecimal = /^\d+\.\d+$/.test(String(raw).trim());
      skipEntry(
        entry,
        looksDecimal
          ? `เลขบัตรถูกแปลงเป็นตัวเลขทศนิยม ("${String(raw).trim()}") — ตั้งช่องในชีตเป็นข้อความแล้วพิมพ์ใหม่`
          : `เลขบัตรมี ${digits.length} หลัก (ต้อง 13) — แก้ในชีตแล้วนำเข้าใหม่`,
        raw
      );
      continue;
    }

    // ชื่อตรงคนเดิมแต่เลขบัตรต่าง → ยึดเลขจากชีตล่าสุด (นำเข้าครบ) เลขเดิมเก็บไว้ที่ previousCitizenIds
    // API ต้องเปลี่ยนเลขบัตรของคนเดิมก่อน upsert (parsed.replacesCitizenId) ไม่งั้นได้คนใหม่ซ้ำ
    const m = matchName(parsed.person.fullName);
    if (m.status === "exact" || m.status === "loose") {
      const oldId = m.person.citizenId;
      parsed.person.citizenId = formatCitizenId(digits);
      parsed.person.fullName = m.person.fullName;
      parsed.replacesCitizenId = oldId;
      parsed.existingPersonId = m.person._id;
      parsed.isNew = false;
      parsed.issues = [
        ...(parsed.issues || []),
        `เลขบัตรในชีตต่างจากในระบบ (เดิมลงท้าย ${citizenDigits(oldId).slice(-4)} → ชีตลงท้าย ${digits.slice(-4)}) — ใช้เลขจากชีตนี้แทน (เลขเดิมเก็บไว้ในประวัติ) ตรวจกับบัตรจริง`,
      ];
      existing++;
      changed++;
      continue;
    }

    parsed.person.citizenId = formatCitizenId(digits);
    parsed.isNew = true;
    if (!isValidCitizenChecksum(digits)) {
      parsed.issues = [...(parsed.issues || []), "เลขบัตรอาจพิมพ์ผิด (checksum ไม่ผ่าน) — ตรวจกับบัตรจริง"];
    }
    created++;
  }
  return { existing, created, changed };
}
