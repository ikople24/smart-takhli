// เทสต์กฎสิทธิ์ของโมดูลงาน: ใครเป็น "หัวหน้ากอง", ใครมอบหมาย/โอนงานได้, ใครทำได้แค่ "ขอโอน"
import { describe, it, expect } from "vitest";
import { HEAD_POSITION_RE, isDepartmentHead, headsOf, taskPermissions } from "../roles";

const user = (over = {}) => ({ _id: over._id ?? "u", clerkId: over.clerkId ?? "c", name: "x", department: "กองช่าง", position: "นายช่างโยธา", isActive: true, ...over });

describe("isDepartmentHead — ติ๊กจาก superadmin มาก่อน, ตำแหน่งเป็น fallback", () => {
  it("isDepartmentHead === true → หัวหน้า แม้ตำแหน่งไม่บอก", () => {
    expect(isDepartmentHead(user({ isDepartmentHead: true, position: "พนักงานจ้าง" }))).toBe(true);
  });
  it("ตำแหน่งที่เข้าเกณฑ์ (ผู้อำนวยการ/หัวหน้า/ผอ./ปลัด) → หัวหน้า", () => {
    expect(isDepartmentHead(user({ position: "ผู้อำนวยการกองช่าง" }))).toBe(true);
    expect(isDepartmentHead(user({ position: "หัวหน้าฝ่ายโยธา" }))).toBe(true);
    expect(isDepartmentHead(user({ position: "ผอ.กองคลัง" }))).toBe(true);
    expect(isDepartmentHead(user({ position: "รองปลัดเทศบาล" }))).toBe(true);
    expect(HEAD_POSITION_RE.test("ผู้ดูแลระบบ")).toBe(false);
  });
  it("ติ๊ก false ชนะตำแหน่ง (superadmin ยกเลิกสิทธิ์หัวหน้าได้), ไม่มีข้อมูล → false", () => {
    expect(isDepartmentHead(user({ isDepartmentHead: false, position: "ผู้อำนวยการกองช่าง" }))).toBe(false);
    expect(isDepartmentHead(user({ position: "นายช่างโยธา" }))).toBe(false);
    expect(isDepartmentHead(null)).toBe(false);
  });
});

describe("headsOf — หัวหน้าของกองที่ระบุ (ทน alias ชื่อกอง, ตัดคนถูกระงับ/archive)", () => {
  const users = [
    user({ _id: "1", clerkId: "c1", department: "กองช่าง", position: "ผู้อำนวยการกองช่าง" }),
    user({ _id: "2", clerkId: "c2", department: "ช่าง", isDepartmentHead: true }),
    user({ _id: "3", clerkId: "c3", department: "กองช่าง", position: "ผอ.", isActive: false }),
    user({ _id: "4", clerkId: "c4", department: "กองช่าง", isDepartmentHead: true, isArchived: true }),
    user({ _id: "5", clerkId: "c5", department: "กองสาธารณสุขฯ", isDepartmentHead: true }),
    user({ _id: "6", clerkId: "c6", department: "กองช่าง" }),
  ];
  it("คืนเฉพาะหัวหน้าที่ยังใช้งานได้ของกองนั้น", () => {
    expect(headsOf(users, "กองช่าง").map((u) => u._id)).toEqual(["1", "2"]);
    expect(headsOf(users, "กองสาธารณสุขและสิ่งแวดล้อม").map((u) => u._id)).toEqual(["5"]);
    expect(headsOf(users, "กองคลัง")).toEqual([]);
  });
  it("ไม่ระบุกอง → หัวหน้าทุกกอง", () => {
    expect(headsOf(users, null).map((u) => u._id)).toEqual(["1", "2", "5"]);
  });
});

describe("taskPermissions — มอบหมาย/โอน/ขอโอน", () => {
  const head = user({ position: "ผู้อำนวยการกองช่าง" });
  const officer = user({ position: "นายช่างโยธา" });

  it("superadmin ทำได้ทุกอย่างทุกกอง", () => {
    expect(taskPermissions({ isSuperAdmin: true, user: officer, taskDepartment: "กองคลัง", isOwner: false })).toEqual({ isHead: false, canAssign: true, canTransfer: true, canRequestTransfer: false });
  });
  it("หัวหน้ากอง: มอบหมายได้, โอนได้เฉพาะงานในกองตัวเอง (หรืองานที่ยังไม่ระบุกอง)", () => {
    expect(taskPermissions({ isSuperAdmin: false, user: head, taskDepartment: "กองช่าง", isOwner: false })).toMatchObject({ isHead: true, canAssign: true, canTransfer: true, canRequestTransfer: false });
    expect(taskPermissions({ isSuperAdmin: false, user: head, taskDepartment: null, isOwner: false }).canTransfer).toBe(true);
    expect(taskPermissions({ isSuperAdmin: false, user: head, taskDepartment: "กองคลัง", isOwner: false }).canTransfer).toBe(false);
  });
  it("admin ธรรมดา: โอนไม่ได้ มอบหมายไม่ได้ — ถ้าเป็นเจ้าของงานได้แค่ 'ขอโอน'", () => {
    expect(taskPermissions({ isSuperAdmin: false, user: officer, taskDepartment: "กองช่าง", isOwner: true })).toEqual({ isHead: false, canAssign: false, canTransfer: false, canRequestTransfer: true });
    expect(taskPermissions({ isSuperAdmin: false, user: officer, taskDepartment: "กองช่าง", isOwner: false }).canRequestTransfer).toBe(false);
  });
  it("หัวหน้าที่โปรไฟล์ไม่ระบุกอง → โอนได้ทุกกอง (ไม่รู้กองก็ห้ามไม่ได้)", () => {
    expect(taskPermissions({ isSuperAdmin: false, user: user({ position: "ปลัดเทศบาล", department: "" }), taskDepartment: "กองคลัง", isOwner: false }).canTransfer).toBe(true);
  });
});
