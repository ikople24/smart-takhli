// lib/complaints/__tests__/manageList.test.js
import { describe, it, expect } from "vitest";
import {
  matchesComplaintSearch,
  rowState,
  buildAssignmentIndex,
  STATUS_DONE,
  STATUS_IN_PROGRESS,
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

import { staleInfo, ageLabel, STALE_DAYS } from "../manageList";

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
