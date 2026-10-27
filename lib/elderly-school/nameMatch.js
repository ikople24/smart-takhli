// จับคู่แถวในชีตที่ "ไม่มีเลขบัตร" กับผู้เรียนเดิมในระบบด้วยชื่อ-นามสกุล
// ใช้ตอนนำเข้าปีใหม่ที่เจ้าหน้าที่ไม่ได้ใส่เลขบัตรมา — คนเดิมจับคู่ได้, คนใหม่ยังต้องมีเลขบัตร (ข้ามแถวพร้อมบอกเหตุผล)
// ไม่มี DB — API ส่งรายชื่อผู้เรียนทั้งหมด ({ _id, citizenId, fullName }) เข้ามา

// คำนำหน้าที่ตัดออกตอนเทียบแบบหลวม (ยาวก่อนสั้น เพื่อไม่ให้ "นาง" ตัด "นางสาว" ครึ่งเดียว)
const PREFIXES = ["นางสาว", "น.ส.", "นส.", "นาง", "นาย", "ด.ญ.", "ด.ช."];

/** เทียบแบบเข้ม: ตัดช่องว่างทั้งหมด ("นาง กมลวรรณ  วรรณสิทธิ์" = "นางกมลวรรณวรรณสิทธิ์") */
export function nameKey(name) {
  return String(name ?? "")
    .normalize("NFC")
    .replace(/\s+/g, "");
}

/** เทียบแบบหลวม: ตัดคำนำหน้าทั่วไปออกด้วย (ยศ/ตำแหน่งอื่นไม่ตัด) */
export function looseNameKey(name) {
  let k = nameKey(name);
  for (const p of PREFIXES) {
    if (k.startsWith(p) && k.length > p.length) {
      k = k.slice(p.length);
      break;
    }
  }
  return k;
}

function indexBy(people, keyFn) {
  const map = new Map();
  for (const p of people || []) {
    if (!p?.citizenId || !p?.fullName) continue;
    const k = keyFn(p.fullName);
    if (!k) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(p);
  }
  return map;
}

/**
 * existingPeople = [{ _id, citizenId, fullName }]
 * คืนฟังก์ชัน match(fullName) →
 *   { status: "exact" | "loose", person }  — เจอคนเดียว
 *   { status: "ambiguous", count }          — ชื่อตรงหลายคน (ต้องใส่เลขบัตร)
 *   { status: "none" }                      — ไม่พบ (น่าจะเป็นผู้เรียนใหม่)
 */
export function buildNameMatcher(existingPeople) {
  const exact = indexBy(existingPeople, nameKey);
  const loose = indexBy(existingPeople, looseNameKey);
  return function match(fullName) {
    const e = exact.get(nameKey(fullName)) || [];
    if (e.length === 1) return { status: "exact", person: e[0] };
    if (e.length > 1) return { status: "ambiguous", count: e.length };
    const l = loose.get(looseNameKey(fullName)) || [];
    if (l.length === 1) return { status: "loose", person: l[0] };
    if (l.length > 1) return { status: "ambiguous", count: l.length };
    return { status: "none" };
  };
}

/**
 * เติมเลขบัตรให้แถวที่ parse แล้วแต่ไม่มีเลขบัตร (parsed.needsNameMatch) — แก้ entries ในที่
 * จับคู่ได้ → ใส่ citizenId/ชื่อเดิมในระบบ + คำเตือนให้ตรวจ; ไม่ได้ → เปลี่ยนเป็นแถวที่ข้ามพร้อมเหตุผล
 * คืนจำนวน { matched, unmatched }
 */
export function resolveMissingCitizenIds(entries, existingPeople) {
  const match = buildNameMatcher(existingPeople);
  let matched = 0;
  let unmatched = 0;
  for (const entry of entries || []) {
    const parsed = entry?.parsed;
    if (!parsed || parsed.skip || !parsed.needsNameMatch) continue;
    const sheetName = parsed.person.fullName;
    const m = match(sheetName);
    if (m.status === "exact" || m.status === "loose") {
      matched++;
      parsed.person.citizenId = m.person.citizenId;
      // คงชื่อในระบบไว้ (ชื่อในชีตอาจต่างแค่คำนำหน้า/ช่องว่าง)
      parsed.person.fullName = m.person.fullName;
      parsed.needsNameMatch = false;
      parsed.matchedByName = m.status;
      parsed.issues = [
        ...(parsed.issues || []),
        m.status === "exact"
          ? "ไม่มีเลขบัตร — จับคู่กับผู้เรียนเดิมจากชื่อ"
          : `ไม่มีเลขบัตร — จับคู่จากชื่อโดยไม่นับคำนำหน้า (ในระบบ: ${m.person.fullName}) ตรวจว่าเป็นคนเดียวกัน`,
      ];
    } else {
      unmatched++;
      entry.parsed = {
        skip: true,
        reason: m.status === "ambiguous" ? "ambiguous name" : "missing citizenId (new person)",
        reasonTh:
          m.status === "ambiguous"
            ? `ไม่มีเลขบัตร และชื่อนี้ตรงกับผู้เรียนเดิม ${m.count} คน — ใส่เลขบัตรเพื่อระบุตัว`
            : "ไม่มีเลขบัตร และไม่พบชื่อนี้ในระบบ (ผู้เรียนใหม่ต้องมีเลขบัตร)",
        fullName: sheetName,
        citizenId: null,
      };
    }
  }
  return { matched, unmatched };
}
