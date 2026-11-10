// lib/complaints/__tests__/manageList.test.js
import { describe, it, expect } from "vitest";
import {
  matchesComplaintSearch,
  rowState,
  buildAssignmentIndex,
  STATUS_DONE,
  STATUS_IN_PROGRESS,
  STATUS_PENDING_FILTER,
  staleInfo,
  ageLabel,
  STALE_DAYS,
  filterComplaints,
  sortComplaints,
  countActiveFilters,
  SORT_OPTIONS,
} from "../manageList";

const base = {
  _id: "c1",
  complaintId: "TKC-700036",
  detail: "ถนนเป็นหลุมลึกหน้าโรงเรียน",
  category: "ถนน / ทางเท้า",
  community: "ชุมชนหัวเขา",
  fullName: "สมศรี",
  problems: ["หลุมบ่อ"],
};

describe("matchesComplaintSearch", () => {
  it("คำค้นว่าง → ผ่านทุกเรื่อง", () => {
    expect(matchesComplaintSearch(base, "")).toBe(true);
    expect(matchesComplaintSearch(base, "   ")).toBe(true);
  });
  it("ค้นเลขคำร้องได้ทั้งแบบมี/ไม่มี prefix", () => {
    expect(matchesComplaintSearch(base, "700036")).toBe(true);
    expect(matchesComplaintSearch(base, "tkc-700036")).toBe(true);
    expect(matchesComplaintSearch(base, "TKC 700036")).toBe(true);
  });
  it("ค้นรายละเอียด/หมวด/ชุมชน/ชื่อ/ประเภทย่อย", () => {
    expect(matchesComplaintSearch(base, "หลุมลึก")).toBe(true);
    expect(matchesComplaintSearch(base, "ทางเท้า")).toBe(true);
    expect(matchesComplaintSearch(base, "หัวเขา")).toBe(true);
    expect(matchesComplaintSearch(base, "สมศรี")).toBe(true);
    expect(matchesComplaintSearch(base, "หลุมบ่อ")).toBe(true);
  });
  it("ไม่ตรง → false", () => {
    expect(matchesComplaintSearch(base, "ประปา")).toBe(false);
  });
});

describe("rowState", () => {
  it("เสร็จสิ้น → done เสมอ", () => {
    expect(rowState({ status: STATUS_DONE }, false)).toBe("done");
    expect(rowState({ status: STATUS_DONE }, true)).toBe("done");
  });
  it("ยังไม่มีผู้รับ → pending", () => {
    expect(rowState({ status: STATUS_IN_PROGRESS }, false)).toBe("pending");
  });
  it("มีผู้รับแล้ว → progress", () => {
    expect(rowState({ status: STATUS_IN_PROGRESS }, true)).toBe("progress");
  });
});

describe("buildAssignmentIndex", () => {
  it("map ด้วย complaintId เป็น string และเก็บตัวแรกที่เจอ", () => {
    const idx = buildAssignmentIndex([
      { _id: "a1", complaintId: "c1" },
      { _id: "a2", complaintId: "c1" },
      { _id: "a3", complaintId: "c2" },
    ]);
    expect(idx.get("c1")._id).toBe("a1");
    expect(idx.get("c2")._id).toBe("a3");
    expect(idx.has("c9")).toBe(false);
  });
  it("รับค่าที่ไม่ใช่ array ได้", () => {
    expect(buildAssignmentIndex(null).size).toBe(0);
  });
});

const NOW = new Date("2026-11-10T12:00:00+07:00");
const daysAgo = (d) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

describe("staleInfo — เกณฑ์เดียวกับ OverdueComplaintsAlert", () => {
  it("เกณฑ์: กำลังดำเนินการ 3 วัน / รอมอบหมาย 7 วัน", () => {
    expect(STALE_DAYS).toEqual({ progress: 3, pending: 7 });
  });
  it("กำลังดำเนินการ เกิน 3 วัน → ค้าง", () => {
    expect(staleInfo({ status: STATUS_IN_PROGRESS, updatedAt: daysAgo(3.5) }, true, NOW)).toEqual({ isStale: true, days: 3 });
    expect(staleInfo({ status: STATUS_IN_PROGRESS, updatedAt: daysAgo(2) }, true, NOW)).toEqual({ isStale: false, days: 2 });
  });
  it("รอมอบหมาย เกิน 7 วัน → ค้าง", () => {
    expect(staleInfo({ status: STATUS_IN_PROGRESS, updatedAt: daysAgo(8) }, false, NOW).isStale).toBe(true);
    expect(staleInfo({ status: STATUS_IN_PROGRESS, updatedAt: daysAgo(6) }, false, NOW).isStale).toBe(false);
  });
  it("ขอบเขต: ดำเนินการ+มีผู้รับ อายุ 3 วันพอดี → ยังไม่ค้าง", () => {
    expect(staleInfo({ status: STATUS_IN_PROGRESS, updatedAt: daysAgo(3) }, true, NOW)).toEqual({ isStale: false, days: 3 });
  });
  it("เสร็จสิ้นแล้ว ไม่นับว่าค้าง", () => {
    expect(staleInfo({ status: STATUS_DONE, updatedAt: daysAgo(30) }, true, NOW)).toEqual({ isStale: false, days: 30 });
  });
  it("วันที่ใช้ไม่ได้ → days null, ไม่ค้าง", () => {
    expect(staleInfo({ status: STATUS_IN_PROGRESS, updatedAt: "x" }, true, NOW)).toEqual({ isStale: false, days: null });
  });
});

describe("ageLabel", () => {
  it("ค้าง → 'ไม่อัปเดต N วัน'", () => {
    expect(ageLabel({ status: STATUS_IN_PROGRESS, updatedAt: daysAgo(9) }, true, NOW)).toBe("ไม่อัปเดต 9 วัน");
  });
  it("ไม่ค้าง → อัปเดตวันนี้ / เมื่อวาน / N วันที่แล้ว", () => {
    expect(ageLabel({ status: STATUS_IN_PROGRESS, updatedAt: daysAgo(0.2) }, true, NOW)).toBe("อัปเดตวันนี้");
    expect(ageLabel({ status: STATUS_IN_PROGRESS, updatedAt: daysAgo(1.2) }, true, NOW)).toBe("อัปเดตเมื่อวาน");
    expect(ageLabel({ status: STATUS_DONE, updatedAt: daysAgo(5) }, true, NOW)).toBe("อัปเดต 5 วันที่แล้ว");
  });
  it("ไม่มีวันที่ → '—'", () => {
    expect(ageLabel({ status: STATUS_DONE }, true, NOW)).toBe("—");
  });
});

const list = [
  { _id: "c1", complaintId: "TKC-1", status: STATUS_IN_PROGRESS, category: "ไฟฟ้า", detail: "ไฟดับ", updatedAt: daysAgo(1), createdAt: daysAgo(10) },
  { _id: "c2", complaintId: "TKC-2", status: STATUS_IN_PROGRESS, category: "ถนน", detail: "หลุม", updatedAt: daysAgo(5), createdAt: daysAgo(6) },
  { _id: "c3", complaintId: "TKC-3", status: STATUS_DONE, category: "ประปา", detail: "ท่อแตก", updatedAt: daysAgo(2), createdAt: daysAgo(20) },
];
const idx = buildAssignmentIndex([
  { _id: "a2", complaintId: "c2", userId: "u1" },
  { _id: "a3", complaintId: "c3", userId: "u2" },
]);
const ids = (xs) => xs.map((x) => x._id);

describe("filterComplaints", () => {
  const opts = { assignmentByComplaintId: idx, now: NOW };
  it("ค่า default → ทั้งหมด", () => {
    expect(ids(filterComplaints(list, opts))).toEqual(["c1", "c2", "c3"]);
  });
  it("แท็บรอมอบหมาย = ไม่มี assignment", () => {
    expect(ids(filterComplaints(list, { ...opts, status: STATUS_PENDING_FILTER }))).toEqual(["c1"]);
  });
  it("แท็บสถานะอื่นเทียบ status ตรง ๆ, carryover ไม่กรองสถานะ", () => {
    expect(ids(filterComplaints(list, { ...opts, status: STATUS_DONE }))).toEqual(["c3"]);
    expect(ids(filterComplaints(list, { ...opts, status: "carryover" }))).toEqual(["c1", "c2", "c3"]);
  });
  it("หมวด + คำค้น", () => {
    expect(ids(filterComplaints(list, { ...opts, category: "ถนน" }))).toEqual(["c2"]);
    expect(ids(filterComplaints(list, { ...opts, search: "ท่อ" }))).toEqual(["c3"]);
  });
  it("เฉพาะของฉัน — เทียบ userId แบบ string, ไม่มี userId → ว่าง", () => {
    expect(ids(filterComplaints(list, { ...opts, mineOnly: true, userId: "u1" }))).toEqual(["c2"]);
    expect(ids(filterComplaints(list, { ...opts, mineOnly: true, userId: null }))).toEqual([]);
  });
  it("เฉพาะค้างนาน", () => {
    expect(ids(filterComplaints(list, { ...opts, staleOnly: true }))).toEqual(["c2"]);
  });
});

describe("sortComplaints", () => {
  it("default = อัปเดตล่าสุดก่อน", () => {
    expect(ids(sortComplaints(list))).toEqual(["c1", "c3", "c2"]);
  });
  it("updatedAt-asc = ค้างนานที่สุดก่อน", () => {
    expect(ids(sortComplaints(list, "updatedAt-asc"))).toEqual(["c2", "c3", "c1"]);
  });
  it("createdAt-desc = แจ้งล่าสุดก่อน", () => {
    expect(ids(sortComplaints(list, "createdAt-desc"))).toEqual(["c2", "c1", "c3"]);
  });
  it("category-asc = ก → ฮ (แก้บั๊กเดิมที่กลับด้าน)", () => {
    expect(sortComplaints(list, "category-asc").map((c) => c.category)).toEqual(["ถนน", "ประปา", "ไฟฟ้า"]);
  });
  it("วันที่หายไป/ใช้ไม่ได้ → ไว้ท้ายทั้ง asc และ desc", () => {
    const withBad = [
      { _id: "x1", updatedAt: "ไม่ใช่วันที่" },
      { _id: "c1", updatedAt: daysAgo(1) },
      { _id: "x2" },
      { _id: "c2", updatedAt: daysAgo(5) },
    ];
    expect(ids(sortComplaints(withBad, "updatedAt-asc")).slice(0, 2)).toEqual(["c2", "c1"]);
    expect(ids(sortComplaints(withBad, "updatedAt-asc")).slice(2).sort()).toEqual(["x1", "x2"]);
    expect(ids(sortComplaints(withBad, "updatedAt-desc")).slice(0, 2)).toEqual(["c1", "c2"]);
    expect(ids(sortComplaints(withBad, "updatedAt-desc")).slice(2).sort()).toEqual(["x1", "x2"]);
  });
  it("ไม่แก้ array ต้นฉบับ", () => {
    const copy = [...list];
    sortComplaints(list, "updatedAt-asc");
    expect(list).toEqual(copy);
  });
  it("SORT_OPTIONS ตรงกับค่าที่ sortComplaints รองรับ", () => {
    expect(SORT_OPTIONS.map((o) => o.value)).toEqual(["updatedAt-desc", "updatedAt-asc", "createdAt-desc", "category-asc"]);
  });
});

describe("countActiveFilters", () => {
  const def = { fiscalYear: 2570, defaultFiscalYear: 2570, category: "all", sort: "updatedAt-desc", mineOnly: false, staleOnly: false };
  it("ค่า default → 0", () => {
    expect(countActiveFilters(def)).toBe(0);
  });
  it("นับทีละรายการที่ไม่ใช่ default", () => {
    expect(countActiveFilters({ ...def, fiscalYear: "all", category: "ถนน", mineOnly: true })).toBe(3);
    expect(countActiveFilters({ ...def, sort: "updatedAt-asc", staleOnly: true })).toBe(2);
  });
});
