// เทสต์ logic กองงานรอรับ (README หน้าจอ 2) — คอลัมน์ kanban, ปุ่มตามความสัมพันธ์กับกอง, alert bar, ป้ายบริบท
import { describe, it, expect } from "vitest";
import { normalizeTaskSettings } from "../settings";
import { POOL_GROUP_BY, poolAction, groupPool, staleSummary, dangerHint, possibleAgencyFor } from "../pool";

const settings = normalizeTaskSettings({ unclaimedWarnDays: 3, unclaimedAlertDays: 4 });

const item = (over) => ({
  _id: over._id ?? over.code,
  code: over.code,
  title: over.title ?? `เรื่อง ${over.code}`,
  category: "",
  community: "",
  department: null,
  daysUnclaimed: 0,
  isStale: false,
  isUrgent: false,
  agingTone: "neutral",
  ...over,
});

const items = [
  item({ code: "A", category: "ไฟส่องสว่าง", community: "ตลาดสด", department: "กองช่าง", daysUnclaimed: 6, isStale: true, agingTone: "overdue" }),
  item({ code: "B", category: "ถนน/ทางเท้า", community: "รจนา", department: "กองช่าง", daysUnclaimed: 1 }),
  item({ code: "C", category: "ขยะมูลฝอย", community: "สามล", department: "กองสาธารณสุขและสิ่งแวดล้อม", daysUnclaimed: 4, agingTone: "due" }),
  item({ code: "D", category: "อื่นๆ", community: "มาลัย", department: null, daysUnclaimed: 2 }),
  item({ code: "E", category: "อื่นๆ", community: "ตลาดสด", department: null, daysUnclaimed: 9, isStale: true, isUrgent: true, agingTone: "overdue" }),
];

describe("poolAction — ปุ่มบนการ์ดตามความสัมพันธ์ระหว่างเรื่องกับกองของเจ้าหน้าที่", () => {
  it("กองเดียวกัน → claim, กองอื่น → not_yours, ยังไม่ระบุกอง → choose_org", () => {
    expect(poolAction(items[0], { officerDepartment: "กองช่าง" })).toBe("claim");
    expect(poolAction(items[2], { officerDepartment: "กองช่าง" })).toBe("not_yours");
    expect(poolAction(items[3], { officerDepartment: "กองช่าง" })).toBe("choose_org");
  });
  it("เจ้าหน้าที่ไม่ระบุกอง / superadmin → รับได้ทุกเรื่องที่ระบุกองแล้ว", () => {
    expect(poolAction(items[2], { officerDepartment: null })).toBe("claim");
    expect(poolAction(items[2], { officerDepartment: "กองคลัง", isSuperAdmin: true })).toBe("claim");
    expect(poolAction(items[3], { officerDepartment: null })).toBe("choose_org");
  });
});

describe("groupPool — ตามกอง", () => {
  const cols = groupPool(items, "organization", { officerDepartment: "กองสาธารณสุขและสิ่งแวดล้อม", settings });

  it("กองของตัวเองมาก่อน → กองอื่นตามจำนวน → 'ยังไม่ระบุกอง' ท้ายสุดเสมอ (dashed)", () => {
    expect(cols.map((c) => c.key)).toEqual(["กองสาธารณสุขและสิ่งแวดล้อม", "กองช่าง", "__unassigned__"]);
    expect(cols[0].isOwn).toBe(true);
    expect(cols[2].isUnassigned).toBe(true);
    expect(cols[2].label).toBe("ยังไม่ระบุกอง");
  });
  it("หัวคอลัมน์: ชื่อย่อ, จำนวน, ค้างนานสุด + โทน; การ์ดเรียง ด่วน → ค้างนาน → อายุมากก่อน", () => {
    expect(cols[0]).toMatchObject({ label: "กองสาธารณสุขฯ", count: 1, maxDays: 4, maxDaysTone: "due" });
    expect(cols[1]).toMatchObject({ label: "กองช่าง", count: 2, maxDays: 6, maxDaysTone: "overdue" });
    expect(cols[1].items.map((i) => i.code)).toEqual(["A", "B"]);
    expect(cols[2].items.map((i) => i.code)).toEqual(["E", "D"]);
    expect(cols[2].maxDaysTone).toBe("overdue");
  });
  it("กองของตัวเองไม่มีเรื่อง → ยังมีคอลัมน์ว่าง (บอกว่าเคลียร์แล้ว); ไม่มีกอง → ไม่มีคอลัมน์พิเศษ", () => {
    const c = groupPool(items, "organization", { officerDepartment: "กองการประปา", settings });
    expect(c[0]).toMatchObject({ key: "กองการประปา", count: 0, isOwn: true, maxDays: null, maxDaysTone: "neutral" });
    expect(groupPool(items, "organization", { officerDepartment: null, settings }).map((c) => c.key)).toEqual(["กองช่าง", "กองสาธารณสุขและสิ่งแวดล้อม", "__unassigned__"]);
  });
});

describe("groupPool — ตามประเภทเรื่อง / ตามความเร่งด่วน", () => {
  it("ประเภท: เรียงจำนวนมากก่อน แล้วชื่อ", () => {
    const cols = groupPool(items, "category", { settings });
    expect(cols.map((c) => [c.key, c.count])).toEqual([
      ["อื่นๆ", 2],
      ["ขยะมูลฝอย", 1],
      ["ถนน/ทางเท้า", 1],
      ["ไฟส่องสว่าง", 1],
    ]);
  });
  it("ความเร่งด่วน: 4 คอลัมน์คงที่แม้ว่าง (ด่วนมาก / ค้างเกินเกณฑ์ / ใกล้เกณฑ์ / ใหม่)", () => {
    const cols = groupPool(items, "priority", { settings });
    expect(cols.map((c) => [c.key, c.count])).toEqual([
      ["urgent", 1],
      ["stale", 1],
      ["warn", 1],
      ["fresh", 2],
    ]);
    expect(cols[1].label).toBe("ค้างเกิน 4 วัน");
    expect(cols[2].label).toBe("ค้าง 3–4 วัน");
    expect(cols[0].items[0].code).toBe("E");
    expect(cols[1].items[0].code).toBe("A");
  });
  it("POOL_GROUP_BY เหมือน my-tasks และค่าแปลกปลอม → organization", () => {
    expect(POOL_GROUP_BY).toEqual(["organization", "category", "priority"]);
    expect(groupPool(items, "nope", { settings })[0].key).toBe("กองช่าง");
  });
});

describe("staleSummary — alert bar สีแดง", () => {
  it("นับเรื่องค้างเกินเกณฑ์, ค้างนานสุด + ชุมชน, และจำนวนด่วน", () => {
    expect(staleSummary(items)).toEqual({ count: 2, maxDays: 9, community: "ตลาดสด", urgentCount: 1 });
  });
  it("ไม่มีเรื่องค้าง → count 0", () => {
    expect(staleSummary([items[1]])).toEqual({ count: 0, maxDays: null, community: "", urgentCount: 0 });
  });
});

describe("dangerHint / possibleAgencyFor — ป้ายบริบทจากข้อความที่ประชาชนพิมพ์", () => {
  it("คำที่บ่งชี้อันตราย → true", () => {
    expect(dangerHint("สายไฟขาดห้อยลงมาหน้าบ้าน")).toBe(true);
    expect(dangerHint("ต้นไม้ล้มขวางถนน")).toBe(true);
    expect(dangerHint("โคมไฟดับ 3 จุด")).toBe(false);
    expect(dangerHint("")).toBe(false);
  });
  it("งานของการไฟฟ้าส่วนภูมิภาค (สายไฟ/เสาไฟฟ้า/หม้อแปลง/ไฟฟ้าดับ) → กฟภ.; โคมไฟส่องสว่างเป็นของเทศบาล → null", () => {
    expect(possibleAgencyFor("ไฟส่องสว่าง", "กิ่งไม้พาดสายไฟแรงสูง")).toBe("กฟภ.");
    expect(possibleAgencyFor("อื่นๆ", "หม้อแปลงระเบิด ไฟฟ้าดับทั้งซอย")).toBe("กฟภ.");
    expect(possibleAgencyFor("ไฟส่องสว่าง", "โคมไฟดับหน้าตลาด 3 จุด")).toBeNull();
    expect(possibleAgencyFor("ถนน/ทางเท้า", "หลุมบนถนน")).toBeNull();
  });
});

describe("groupPool — activeDepartments: กองที่มีงานกำลังดำเนินการต้องมีคอลัมน์เสมอ (แม้ไม่มีเรื่องค้างรับ)", () => {
  it("กองสาธารณสุขฯ ไม่มีเรื่องค้างแต่มีงานที่รับไปแล้ว → คอลัมน์ว่างโผล่ (นับ 0) ก่อน 'ยังไม่ระบุกอง'", () => {
    const onlyChang = [item({ code: "A", category: "ถนน/ทางเท้า", department: "กองช่าง", daysUnclaimed: 6, isStale: true, agingTone: "overdue" })];
    const cols = groupPool(onlyChang, "organization", {
      officerDepartment: null,
      settings,
      activeDepartments: ["กองสาธารณสุขและสิ่งแวดล้อม", "กองช่าง"],
    });
    expect(cols.map((c) => [c.key, c.count])).toEqual([
      ["กองช่าง", 1],
      ["กองสาธารณสุขและสิ่งแวดล้อม", 0],
      ["__unassigned__", 0],
    ]);
    expect(cols[1]).toMatchObject({ label: "กองสาธารณสุขฯ", maxDays: null, maxDaysTone: "neutral", isUnassigned: false });
  });
  it("ไม่ส่ง activeDepartments → พฤติกรรมเดิม (เฉพาะกองที่มีเรื่อง + กองตัวเอง + ยังไม่ระบุกอง)", () => {
    const onlyChang = [item({ code: "A", department: "กองช่าง", daysUnclaimed: 1 })];
    expect(groupPool(onlyChang, "organization", { settings }).map((c) => c.key)).toEqual(["กองช่าง", "__unassigned__"]);
  });
});
