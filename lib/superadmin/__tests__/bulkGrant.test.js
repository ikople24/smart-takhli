import { describe, it, expect } from "vitest";
import { planBulkGrant } from "@/lib/superadmin/bulkGrant";

const APP = "smart-takhli";
const doc = (id, appId, pages) => ({ _id: id, appId, allowedPages: pages });

describe("planBulkGrant", () => {
  it("user แอปนี้ + allowedPages ไม่ว่าง → apply", () => {
    const { applyIds, skippedDefault, crossApp, notFound } = planBulkGrant(
      [doc("a", APP, ["/admin/dashboard"])],
      ["a"],
      APP
    );
    expect(applyIds).toEqual(["a"]);
    expect(skippedDefault).toEqual([]);
    expect(crossApp).toEqual([]);
    expect(notFound).toEqual([]);
  });

  it("allowedPages ว่าง → ข้าม (ใช้ default อยู่ — เติม 1 หน้าจะทำ default ทั้งชุดหาย)", () => {
    const plan = planBulkGrant([doc("a", APP, [])], ["a"], APP);
    expect(plan.applyIds).toEqual([]);
    expect(plan.skippedDefault).toEqual(["a"]);
  });

  it("allowedPages ไม่ใช่ array (doc เก่า) → นับเป็นข้าม ไม่พัง", () => {
    const plan = planBulkGrant([{ _id: "a", appId: APP }], ["a"], APP);
    expect(plan.skippedDefault).toEqual(["a"]);
  });

  it("user ต่างแอป → crossApp (endpoint จะตอบ 400)", () => {
    const plan = planBulkGrant([doc("a", "app_b", ["/x"])], ["a"], APP);
    expect(plan.crossApp).toEqual(["a"]);
  });

  it("appId ว่างก็นับเป็น crossApp (ยังไม่ได้รับอนุมัติเข้าแอป)", () => {
    const plan = planBulkGrant([doc("a", "", ["/x"])], ["a"], APP);
    expect(plan.crossApp).toEqual(["a"]);
  });

  it("id ที่หา doc ไม่เจอ → notFound", () => {
    const plan = planBulkGrant([], ["ghost"], APP);
    expect(plan.notFound).toEqual(["ghost"]);
  });

  it("เทียบ _id แบบ string (รองรับ ObjectId)", () => {
    const oid = { toString: () => "aaa" };
    const plan = planBulkGrant([doc(oid, APP, ["/x"])], ["aaa"], APP);
    expect(plan.applyIds).toEqual(["aaa"]);
  });
});
