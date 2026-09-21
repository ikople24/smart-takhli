import { describe, it, expect } from "vitest";
import { matchesComplaintQuery, filterComplaints, normalizeSearch } from "../searchComplaints";

const row = {
  complaintId: "TKC-690016",
  category: "ไฟส่องสว่าง",
  community: "ชุมชนรจนา",
  detail: "ไฟดับหน้าปากซอย ตั้งแต่เมื่อคืน",
  problems: ["ไฟไม่ติด"],
};

describe("normalizeSearch — ตัดช่องว่าง/ขีดและพิมพ์เล็กใหญ่", () => {
  it("ทำให้รูปแบบเลขที่คำร้องต่าง ๆ เทียบกันได้", () => {
    expect(normalizeSearch("TKC-690016")).toBe("tkc690016");
    expect(normalizeSearch("tkc 690016")).toBe("tkc690016");
    expect(normalizeSearch(null)).toBe("");
  });
});

describe("matchesComplaintQuery — ค้นได้ทุกช่องที่การ์ดแสดง", () => {
  it("เลขที่คำร้องพิมพ์แบบไหนก็เจอ", () => {
    expect(matchesComplaintQuery(row, "TKC-690016")).toBe(true);
    expect(matchesComplaintQuery(row, "tkc690016")).toBe(true);
    expect(matchesComplaintQuery(row, "690016")).toBe(true);
  });
  it("ค้นด้วยหมวด/ชุมชน/หัวข้อปัญหา/รายละเอียด", () => {
    expect(matchesComplaintQuery(row, "ไฟส่องสว่าง")).toBe(true);
    expect(matchesComplaintQuery(row, "รจนา")).toBe(true);
    expect(matchesComplaintQuery(row, "ไฟไม่ติด")).toBe(true);
    expect(matchesComplaintQuery(row, "ปากซอย")).toBe(true);
  });
  it("คนพิมพ์เว้นวรรคไม่เหมือนต้นฉบับก็ยังเจอ", () => {
    expect(matchesComplaintQuery(row, "ไฟ ดับ")).toBe(true);
  });
  it("คำที่ไม่มีอยู่จริง → ไม่เจอ", () => {
    expect(matchesComplaintQuery(row, "น้ำประปา")).toBe(false);
  });
  it("คำค้นว่าง = ไม่กรอง", () => {
    expect(matchesComplaintQuery(row, "")).toBe(true);
    expect(matchesComplaintQuery(row, "   ")).toBe(true);
  });
  it("เอกสารที่ฟิลด์หายไม่พัง", () => {
    expect(matchesComplaintQuery({}, "อะไรก็ได้")).toBe(false);
    expect(matchesComplaintQuery(null, "อะไรก็ได้")).toBe(false);
  });
});

describe("filterComplaints", () => {
  const rows = [row, { complaintId: "TKC-690017", category: "น้ำประปา", community: "ชุมชนตลาด", problems: [] }];
  it("คืนเฉพาะแถวที่ตรง", () => {
    expect(filterComplaints(rows, "น้ำ").map((r) => r.complaintId)).toEqual(["TKC-690017"]);
  });
  it("คำค้นว่างคืนทั้งชุดเดิม", () => {
    expect(filterComplaints(rows, "")).toHaveLength(2);
  });
  it("อินพุตไม่ใช่ array → คืน []", () => {
    expect(filterComplaints(null, "x")).toEqual([]);
  });
});
