// ฟังก์ชันคำนวณตัวเลขสรุปสำหรับ panel ดีไซน์ใหม่ — pure ไม่มี side effect ทดสอบได้
// รับข้อมูลที่ fetch มาแล้วจาก /api/smart-light/{groups,poles}

// จำนวนวันเต็มจาก lastSurveyedAt ถึงตอนนี้; null ถ้าไม่มี/ไม่ถูกต้อง
export function daysSince(dateLike, now = Date.now()) {
  if (!dateLike) return null;
  const t = new Date(dateLike).getTime();
  if (Number.isNaN(t)) return null;
  const diff = now - t;
  return diff < 0 ? 0 : Math.floor(diff / 86400000);
}

// สรุปภาพรวมจาก groups (byStatus): total/normal/problem/unknown/pct
export function healthSummary(groups) {
  const acc = { total: 0, normal: 0, damaged: 0, off: 0, unknown: 0 };
  for (const g of groups || []) {
    const bs = g.byStatus || {};
    acc.total += g.total || 0;
    acc.normal += bs.normal || 0;
    acc.damaged += bs.damaged || 0;
    acc.off += bs.off || 0;
    acc.unknown += bs.unknown || 0;
  }
  const problem = acc.damaged + acc.off;
  const pct = acc.total ? Math.round((acc.normal / acc.total) * 100) : 0;
  return { total: acc.total, normal: acc.normal, problem, unknown: acc.unknown, pct };
}

// เสาค้างสำรวจนานสุด n ต้น: ยังไม่เคยสำรวจมาก่อน แล้วเรียงวันมาก→น้อย
export function overduePoles(poles, n, now = Date.now()) {
  const withDays = (poles || []).map((p) => ({ ...p, days: daysSince(p.lastSurveyedAt, now) }));
  withDays.sort((a, b) => {
    if (a.days === null && b.days === null) return 0;
    if (a.days === null) return -1;
    if (b.days === null) return 1;
    return b.days - a.days;
  });
  return withDays.slice(0, n).map((p) => ({
    ...p,
    daysLabel: p.days === null ? "ยังไม่เคยสำรวจ" : `${p.days} วันก่อน`,
  }));
}

// ความหนาแน่นปัญหารายกลุ่ม เรียง ratio มาก→น้อย (problem = damaged+off)
export function groupHeat(groups) {
  return (groups || [])
    .map((g) => {
      const bs = g.byStatus || {};
      const problem = (bs.damaged || 0) + (bs.off || 0);
      const total = g.total || 0;
      return { name: g.group, total, problem, ratio: total ? problem / total : 0, centroid: g.centroid || null };
    })
    .sort((a, b) => b.ratio - a.ratio);
}
