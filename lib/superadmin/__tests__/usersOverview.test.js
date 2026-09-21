import { describe, it, expect } from "vitest";
import {
  STATUS,
  isStubDoc,
  computeStatus,
  buildUsersOverview,
  toClerkLite,
} from "@/lib/superadmin/usersOverview";

const APP = "smart-takhli";

// fixture จากเคสจริง 2026-08-27: stub doc ที่แอปพี่น้องสร้างค้างไว้
const STUB_DOC = {
  _id: "6a73fd8e2b588a2d8ed3191a",
  role: "admin",
  allowedPages: [],
  clerkId: "user_34BXrf8OmiiODu8Edj35hMNKNCJ",
  __v: 0,
};

const FULL_DOC = {
  _id: "aaa000000000000000000001",
  clerkId: "user_full",
  name: "สมชาย ใจดี",
  position: "นักวิชาการ",
  department: "กองช่าง",
  role: "admin",
  appId: APP,
  allowedPages: ["/admin/dashboard"],
  createdAt: new Date("2026-01-01"),
};

const clerk = (id, name = "Clerk Name", email = "x@y.com") => ({
  clerkId: id,
  name,
  email,
  imageUrl: "",
  clerkRole: "admin",
  allowedApps: [APP],
  lastSignInAt: 1750000000000,
});

describe("isStubDoc", () => {
  it("stub จริง (ไม่มี name/appId/createdAt/updatedAt + allowedPages empty) → true", () => {
    expect(isStubDoc(STUB_DOC)).toBe(true);
  });
  it("doc ที่มี name → false", () => {
    expect(isStubDoc(FULL_DOC)).toBe(false);
  });
  it("doc ที่มีแค่ appId → false (ไม่ใช่ stub ห้ามลบ)", () => {
    expect(isStubDoc({ clerkId: "x", appId: "app_b" })).toBe(false);
  });
  it("string ว่างนับเป็น 'ไม่มี'", () => {
    expect(isStubDoc({ clerkId: "x", name: "", appId: "" })).toBe(true);
  });
  it("null/undefined → false", () => {
    expect(isStubDoc(null)).toBe(false);
    expect(isStubDoc(undefined)).toBe(false);
  });
  it("doc ที่มี createdAt → false (ไม่ใช่ stub)", () => {
    expect(isStubDoc({ clerkId: "x", createdAt: new Date() })).toBe(false);
  });
  it("doc ที่มี updatedAt → false (ไม่ใช่ stub)", () => {
    expect(isStubDoc({ clerkId: "x", updatedAt: new Date() })).toBe(false);
  });
  it("doc ที่มี allowedPages → false (ไม่ใช่ stub)", () => {
    expect(isStubDoc({ ...STUB_DOC, allowedPages: ["/admin/dashboard"] })).toBe(false);
  });
});

describe("computeStatus", () => {
  it("ไม่มี doc → no_doc", () => {
    expect(computeStatus(null, true, APP)).toBe(STATUS.NO_DOC);
  });
  it("doc ไม่มี name → broken", () => {
    expect(computeStatus(STUB_DOC, true, APP)).toBe(STATUS.BROKEN);
  });
  it("doc มี name แต่ appId ว่าง → no_app", () => {
    expect(computeStatus({ ...FULL_DOC, appId: "" }, true, APP)).toBe(STATUS.NO_APP);
  });
  it("appId ตรงแอปปัจจุบัน → active", () => {
    expect(computeStatus(FULL_DOC, true, APP)).toBe(STATUS.ACTIVE);
  });
  it("appId เป็นของแอปอื่น → other_app", () => {
    expect(computeStatus({ ...FULL_DOC, appId: "app_b" }, true, APP)).toBe(STATUS.OTHER_APP);
  });
  it("clerkId หาใน Clerk ไม่เจอ → orphan (ชนะ broken)", () => {
    expect(computeStatus(STUB_DOC, false, APP)).toBe(STATUS.ORPHAN);
  });
  it("Clerk ล่ม (clerkAvailable=false) → ห้ามตัดสิน orphan", () => {
    expect(computeStatus(STUB_DOC, false, APP, false)).toBe(STATUS.BROKEN);
  });
  it("doc เก่าไม่มี clerkId เลย → ไม่ใช่ orphan ไล่ตามฟิลด์ปกติ", () => {
    expect(computeStatus({ _id: "x", name: "เก่า", appId: APP }, false, APP)).toBe(STATUS.ACTIVE);
  });
  it("name whitespace-only → broken", () => {
    expect(computeStatus({ _id: "x", clerkId: "c", name: "   " }, true, APP)).toBe(STATUS.BROKEN);
  });
});

describe("buildUsersOverview", () => {
  it("merge doc กับข้อมูล Clerk ด้วย clerkId", () => {
    const rows = buildUsersOverview([clerk("user_full")], [FULL_DOC], APP);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      clerkId: "user_full",
      mongoId: "aaa000000000000000000001",
      name: "สมชาย ใจดี", // ชื่อ Mongo มาก่อน
      email: "x@y.com", // email มาจาก Clerk
      status: STATUS.ACTIVE,
    });
  });
  it("stub doc ใช้ชื่อจาก Clerk เป็น fallback + isStub=true", () => {
    const rows = buildUsersOverview(
      [clerk(STUB_DOC.clerkId, "กองสาธารณสุขฯ")],
      [STUB_DOC],
      APP
    );
    expect(rows[0].name).toBe("กองสาธารณสุขฯ");
    expect(rows[0].status).toBe(STATUS.BROKEN);
    expect(rows[0].isStub).toBe(true);
  });
  it("บัญชี Clerk ที่ไม่มี doc → แถว no_doc", () => {
    const rows = buildUsersOverview([clerk("user_new")], [], APP);
    expect(rows[0].status).toBe(STATUS.NO_DOC);
    expect(rows[0].mongoId).toBe("");
  });
  it("doc ที่ Clerk ไม่รู้จัก → orphan", () => {
    const rows = buildUsersOverview([], [FULL_DOC], APP);
    expect(rows[0].status).toBe(STATUS.ORPHAN);
  });
  it("Clerk ล่ม → ไม่มีแถว no_doc/orphan และตั้ง flag ในผลไม่เกี่ยว (endpoint จัดการ)", () => {
    const rows = buildUsersOverview([], [FULL_DOC], APP, { clerkAvailable: false });
    expect(rows[0].status).toBe(STATUS.ACTIVE);
  });
  it("เรียง: ต้องดำเนินการ (broken/orphan/no_doc/no_app) → active → other_app", () => {
    const rows = buildUsersOverview(
      [clerk("user_full"), clerk(STUB_DOC.clerkId), clerk("user_new"), clerk("user_b")],
      [FULL_DOC, STUB_DOC, { ...FULL_DOC, _id: "bbb000000000000000000002", clerkId: "user_b", name: "แอปอื่น", appId: "app_b" }],
      APP
    );
    const statuses = rows.map((r) => r.status);
    expect(statuses).toEqual([STATUS.BROKEN, STATUS.NO_DOC, STATUS.ACTIVE, STATUS.OTHER_APP]);
  });
  it("name falls back to Clerk email when doc has no name AND clerk name is empty", () => {
    const rows = buildUsersOverview(
      [{ ...clerk(STUB_DOC.clerkId, ""), email: "test@example.com" }],
      [STUB_DOC],
      APP
    );
    expect(rows[0].name).toBe("test@example.com");
  });
  it("ObjectId-like _id: mongoId = toString()", () => {
    const rows = buildUsersOverview(
      [],
      [{ ...FULL_DOC, _id: { toString: () => "cafe0000" } }],
      APP
    );
    expect(rows[0].mongoId).toBe("cafe0000");
  });
  it("clerkBlocksApp: allowedApps [app_b] + APP smart-takhli → true", () => {
    const rows = buildUsersOverview(
      [{ ...clerk("user_full"), allowedApps: ["app_b"], clerkRole: "admin" }],
      [FULL_DOC],
      APP
    );
    expect(rows[0].clerkBlocksApp).toBe(true);
  });
  it("clerkBlocksApp: allowedApps ['*'] → false (wildcard allows all)", () => {
    const rows = buildUsersOverview(
      [{ ...clerk("user_full"), allowedApps: ["*"], clerkRole: "admin" }],
      [FULL_DOC],
      APP
    );
    expect(rows[0].clerkBlocksApp).toBe(false);
  });
  it("clerkBlocksApp: allowedApps [] → false (empty means no Clerk gate)", () => {
    const rows = buildUsersOverview(
      [clerk("user_full")],
      [FULL_DOC],
      APP
    );
    expect(rows[0].clerkBlocksApp).toBe(false);
  });
  it("clerkBlocksApp: superadmin with allowedApps [app_b] → false (superadmin bypass)", () => {
    const rows = buildUsersOverview(
      [{ ...clerk("user_full"), allowedApps: ["app_b"], clerkRole: "superadmin" }],
      [FULL_DOC],
      APP
    );
    expect(rows[0].clerkBlocksApp).toBe(false);
  });
});

describe("toClerkLite", () => {
  it("แปลง Clerk SDK user เป็นรูปแบบภายใน", () => {
    const lite = toClerkLite({
      id: "user_x",
      firstName: "สมหญิง",
      lastName: "ดีงาม",
      imageUrl: "http://img",
      emailAddresses: [{ emailAddress: "a@b.c" }],
      publicMetadata: { role: "admin", allowedApps: ["*"] },
      lastSignInAt: 123,
    });
    expect(lite).toEqual({
      clerkId: "user_x",
      name: "สมหญิง ดีงาม",
      email: "a@b.c",
      imageUrl: "http://img",
      clerkRole: "admin",
      allowedApps: ["*"],
      lastSignInAt: 123,
    });
  });
  it("ฟิลด์หาย → ค่า default ปลอดภัย", () => {
    const lite = toClerkLite({ id: "user_y" });
    expect(lite.name).toBe("");
    expect(lite.email).toBe("");
    expect(lite.allowedApps).toEqual([]);
    expect(lite.lastSignInAt).toBeNull();
  });
});
