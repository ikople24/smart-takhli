// ตรรกะแป้นตัวเลขบนจอ (pure) — ใช้ในหน้ากรอกน้ำหนัก
// key: "0"-"9" | "." | "del" | "clear"
// กติกา: จุดทศนิยมได้ 1 จุด, ทศนิยมไม่เกิน 2 ตำแหน่ง, จำนวนเต็มไม่เกิน 4 หลัก (≤ 9999 กก.)
export function applyKey(current, key) {
  const cur = String(current || "");
  if (key === "clear") return "";
  if (key === "del") return cur.slice(0, -1);
  if (key === ".") {
    if (cur.includes(".")) return cur;
    return cur === "" ? "0." : cur + ".";
  }
  if (!/^\d$/.test(key)) return cur;
  const next = cur === "0" ? key : cur + key;
  const [int, dec] = next.split(".");
  if (dec !== undefined && dec.length > 2) return cur;
  if (int.length > 4) return cur;
  return next;
}
