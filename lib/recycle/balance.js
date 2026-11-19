// ยอดคงเหลือ + ตรวจรายการแลกของ (pure functions — ใช้ทั้ง API และหน้าเว็บ)
import { roundKg } from "./validate";

export const MAX_QTY_PER_ITEM = 999;

/** ยอดน้ำหนักคงเหลือที่แลกได้ = ฝากทั้งหมด - ตัดยอดแล้ว */
export function getBalanceKg(member) {
  return roundKg((Number(member?.totalKg) || 0) - (Number(member?.redeemedKg) || 0));
}

/**
 * input: [{ rewardId, qty }] หรือ { [rewardId]: qty }
 * rewards: array ของ RecycleReward (ต้องมี _id, name, kgCost, unit, stock, isActive)
 * คืน { items, totalKg, errors } — items มี snapshot ชื่อ/ราคา ณ ตอนแลก
 */
export function buildRedemptionItems(input, rewards) {
  const errors = [];
  const byId = new Map((rewards || []).map((r) => [String(r._id), r]));
  const pairs = Array.isArray(input) ? input.map((it) => [it?.rewardId, it?.qty]) : Object.entries(input || {});

  const qtyById = new Map();
  for (const [rawId, rawQty] of pairs) {
    const qty = Number(rawQty);
    if (!rawQty || qty === 0) continue;
    if (!Number.isInteger(qty) || qty < 0 || qty > MAX_QTY_PER_ITEM) {
      errors.push("จำนวนของรางวัลไม่ถูกต้อง");
      continue;
    }
    const id = String(rawId);
    qtyById.set(id, (qtyById.get(id) || 0) + qty);
  }

  const items = [];
  for (const [id, qty] of qtyById) {
    const r = byId.get(id);
    if (!r) {
      errors.push("ไม่พบของรางวัลที่เลือก");
      continue;
    }
    if (r.isActive === false) {
      errors.push(`${r.name} ปิดการแลกแล้ว`);
      continue;
    }
    if (typeof r.stock === "number" && r.stock < qty) {
      errors.push(`${r.name} เหลือ ${r.stock} ${r.unit || "ชิ้น"}`);
      continue;
    }
    items.push({
      rewardId: r._id,
      name: r.name,
      unit: r.unit || "ชิ้น",
      kgCost: roundKg(r.kgCost),
      qty,
      subtotalKg: roundKg(r.kgCost * qty),
    });
  }

  const totalKg = roundKg(items.reduce((s, it) => s + it.subtotalKg, 0));
  if (!errors.length && items.length === 0) errors.push("กรุณาเลือกของที่จะแลกอย่างน้อย 1 รายการ");
  return { items, totalKg, errors };
}

/** ตรวจข้อมูลของรางวัล — คืน { data, errors } */
export function normalizeRewardInput(body) {
  const errors = [];
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const kgCost = roundKg(body?.kgCost);
  const unit = typeof body?.unit === "string" && body.unit.trim() ? body.unit.trim() : "ชิ้น";
  const stockRaw = body?.stock;
  const stock = stockRaw === "" || stockRaw === null || stockRaw === undefined ? null : Number(stockRaw);
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const sortOrder = Number(body?.sortOrder) || 0;

  if (!name) errors.push("กรุณากรอกชื่อของรางวัล");
  if (!Number.isFinite(kgCost) || kgCost <= 0) errors.push("น้ำหนักที่ใช้แลกต้องมากกว่า 0");
  if (stock !== null && (!Number.isInteger(stock) || stock < 0)) errors.push("จำนวนคงเหลือต้องเป็นจำนวนเต็ม (เว้นว่าง = ไม่จำกัด)");

  const data = { name, kgCost, unit, stock, description, sortOrder };
  if (typeof body?.isActive === "boolean") data.isActive = body.isActive;
  return { data, errors };
}

/**
 * ความคืบหน้าไปยังของรางวัล (ใช้ทำแถบ "อีก X กก. แลก Y ได้")
 * rewards: [{ name, kgCost, unit, stock }] — ตัดของหมดออก
 * คืน { next, goal, allAffordable }
 *  - next = ของที่ถูกที่สุดที่ยังแลกไม่ได้ (null ถ้าแลกได้ทุกชิ้น)
 *  - goal = ของที่แพงที่สุด (เป้าหมายใหญ่) ถ้าต่างจาก next
 *  แต่ละตัวมี { name, kgCost, unit, missingKg, pct }
 */
export function getRewardProgress(balanceKg, rewards) {
  const avail = (rewards || [])
    .filter((r) => r && r.kgCost > 0 && !(typeof r.stock === "number" && r.stock <= 0))
    .sort((a, b) => a.kgCost - b.kgCost);
  const wrap = (r) =>
    r && {
      name: r.name,
      unit: r.unit || "ชิ้น",
      kgCost: roundKg(r.kgCost),
      missingKg: Math.max(0, roundKg(r.kgCost - balanceKg)),
      pct: Math.max(0, Math.min(100, Math.round((balanceKg / r.kgCost) * 100))),
    };
  const nextRaw = avail.find((r) => r.kgCost > balanceKg + 0.001) || null;
  const goalRaw = avail.length ? avail[avail.length - 1] : null;
  return {
    next: wrap(nextRaw),
    goal: goalRaw && goalRaw !== nextRaw ? wrap(goalRaw) : null,
    allAffordable: avail.length > 0 && !nextRaw,
  };
}
