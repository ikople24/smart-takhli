// สถานะความขุ่นรายจุด/รายชุมชน — logic ล้วน (เทสต์: __tests__/communityStatus.test.js)
// "ล่าสุด" = บันทึกใหม่สุดของแต่ละจุด: โบซ้ำแล้วใส จุดนั้นนับเป็นใสทันที
// ชุมชนมาจาก geojsonfeatures (22 polygon ของแอปพี่น้อง — อ่านอย่างเดียว) จับคู่ด้วยพิกัดเท่านั้น ห้ามเดาจากชื่อจุด

// จับคู่บันทึกเป็น "จุดเดียวกัน": หัวโบล์จากทะเบียน หรือชื่อจุดถ้าไม่ได้ผูกหัวโบล์
export const pointKeyOf = (l) => (l.flushPointId ? String(l.flushPointId) : `name:${l.locationName || ""}`);

// คืน [{ log: บันทึกล่าสุด, times: จำนวนบันทึกของจุดนี้ }] — ไม่สนลำดับที่ส่งมา
export function latestByPoint(logs) {
  const latest = new Map();
  const counts = new Map();
  for (const l of logs || []) {
    const k = pointKeyOf(l);
    counts.set(k, (counts.get(k) || 0) + 1);
    const cur = latest.get(k);
    if (!cur || new Date(l.flushedAt) > new Date(cur.flushedAt)) latest.set(k, l);
  }
  return [...latest.entries()].map(([k, l]) => ({ log: l, times: counts.get(k) }));
}

// ray casting บนวงแหวนเดียว — พิกัด [lng, lat]
function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(pt, rings) {
  if (!rings?.length || !inRing(pt, rings[0])) return false;
  return !rings.slice(1).some((hole) => inRing(pt, hole)); // อยู่ในรู = ไม่อยู่ในโพลิกอน
}

export function pointInGeometry(pt, geometry) {
  if (!geometry || !Array.isArray(pt)) return false;
  if (geometry.type === "Polygon") return inPolygon(pt, geometry.coordinates);
  if (geometry.type === "MultiPolygon") return geometry.coordinates.some((rings) => inPolygon(pt, rings));
  return false;
}

// Map<ชื่อชุมชน, { turbid, clear, status: "turbid" | "clear" | "none" }>
// turbid = มีอย่างน้อย 1 จุดที่ผลล่าสุดยังขุ่น · clear = มีบันทึกและใสทั้งหมด · none = ไม่มีบันทึกในช่วงนี้
export function communityTurbidStatus(features, latest) {
  const out = new Map();
  for (const f of features || []) {
    let turbid = 0;
    let clear = 0;
    for (const { log } of latest || []) {
      const pt = log.location?.coordinates;
      if (!pointInGeometry(pt, f.geometry)) continue;
      if (log.result === "still_turbid") turbid += 1;
      else if (log.result === "clear") clear += 1;
    }
    out.set(String(f.properties?.name ?? ""), {
      turbid,
      clear,
      status: turbid > 0 ? "turbid" : clear > 0 ? "clear" : "none",
    });
  }
  return out;
}
