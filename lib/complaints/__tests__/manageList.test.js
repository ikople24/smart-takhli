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
