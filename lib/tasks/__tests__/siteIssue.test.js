// เทสต์ "พบปัญหาหน้างาน" (มติประชุม 2026-11) — เหตุผลมาตรฐาน + ตรวจข้อมูลที่เจ้าหน้าที่ส่ง
import { describe, it, expect } from "vitest";
import { SITE_ISSUE_REASONS, siteIssueLabelOf, validateSiteIssue, siteIssueSummary } from "../siteIssue";

describe("SITE_ISSUE_REASONS", () => {
  it("5 เหตุผล code ไม่ซ้ำ + frozen", () => {
    expect(SITE_ISSUE_REASONS.map((r) => r.code)).toEqual(["private_property", "not_our_duty", "wrong_location", "need_owner_consent", "other"]);
    expect(Object.isFrozen(SITE_ISSUE_REASONS)).toBe(true);
    expect(Object.isFrozen(SITE_ISSUE_REASONS[0])).toBe(true);
    expect(siteIssueLabelOf("private_property")).toBe("อยู่ในพื้นที่ส่วนบุคคล");
    expect(siteIssueLabelOf("nope")).toBeNull();
    expect(siteIssueLabelOf(undefined)).toBeNull();
  });
});

describe("validateSiteIssue", () => {
  it("ผ่าน: trim note, คืน label", () => {
    expect(validateSiteIssue({ reasonCode: " private_property ", note: "  ต้นมะม่วงอยู่ในบ้าน  " })).toEqual({
      ok: true,
      reasonCode: "private_property",
      label: "อยู่ในพื้นที่ส่วนบุคคล",
      note: "ต้นมะม่วงอยู่ในบ้าน",
      images: [],
    });
  });
  it("ไม่มี/ไม่รู้จัก reasonCode → ไม่ผ่าน", () => {
    expect(validateSiteIssue({}).ok).toBe(false);
    expect(validateSiteIssue({ reasonCode: "x" })).toMatchObject({ ok: false });
    expect(validateSiteIssue().ok).toBe(false);
  });
  it("'other' ต้องมี note", () => {
    expect(validateSiteIssue({ reasonCode: "other", note: "   " })).toMatchObject({ ok: false });
    expect(validateSiteIssue({ reasonCode: "other", note: "ถนนเอกชน" })).toMatchObject({ ok: true, note: "ถนนเอกชน" });
  });
  it("note ตัดที่ 500 ตัวอักษร", () => {
    const r = validateSiteIssue({ reasonCode: "not_our_duty", note: "ก".repeat(700) });
    expect(r.note).toHaveLength(500);
  });
  it("images: https เท่านั้น ไม่ซ้ำ สูงสุด 5", () => {
    const imgs = ["http://a/1.jpg", "https://a/1.jpg", "https://a/1.jpg", 42, null, ...[2, 3, 4, 5, 6, 7].map((i) => `https://a/${i}.jpg`)];
    const r = validateSiteIssue({ reasonCode: "wrong_location", images: imgs });
    expect(r.images).toEqual(["https://a/1.jpg", "https://a/2.jpg", "https://a/3.jpg", "https://a/4.jpg", "https://a/5.jpg"]);
    expect(validateSiteIssue({ reasonCode: "wrong_location", images: "https://a" }).images).toEqual([]);
  });
});

describe("siteIssueSummary", () => {
  it("label — note · note ว่าง = label", () => {
    expect(siteIssueSummary("อยู่ในพื้นที่ส่วนบุคคล", "ในรั้วบ้าน")).toBe("อยู่ในพื้นที่ส่วนบุคคล — ในรั้วบ้าน");
    expect(siteIssueSummary("อยู่ในพื้นที่ส่วนบุคคล", " ")).toBe("อยู่ในพื้นที่ส่วนบุคคล");
  });
});
