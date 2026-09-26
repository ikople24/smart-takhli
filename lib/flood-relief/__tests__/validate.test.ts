import { describe, it, expect } from "vitest";
import { validateRequestInput } from "../validate";

const base = { type: "drain", lat: 15.2539, lng: 100.3511, phone: "081-234-4421" };

describe("validateRequestInput", () => {
  it("กรอกแค่ 3 อย่างก็ผ่าน และเติมความเร่งด่วนตามประเภท", () => {
    const r = validateRequestInput(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.urgency).toBe("urgent");
    expect(r.value.phone).toBe("0812344421");
    expect(r.value.point).toEqual({ lat: 15.2539, lng: 100.3511 });
    expect(r.value.peopleCount).toBeNull();
    expect(r.value.accuracyM).toBeNull();
    expect(r.value.images).toEqual([]);
  });

  it("อพยพผู้ป่วยที่ไม่ส่งความเร่งด่วนมา = ด่วนมาก", () => {
    const r = validateRequestInput({ ...base, type: "evac" });
    expect(r.ok && r.value.urgency).toBe("critical");
  });

  it("บอกช่องที่ขาดครบทุกช่อง", () => {
    const r = validateRequestInput({});
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(["location", "phone", "type"]);
  });

  it("ประเภท/พิกัด/เบอร์ผิดรูปแบบ = ไม่ผ่าน", () => {
    expect(validateRequestInput({ ...base, type: "boat" }).ok).toBe(false);
    expect(validateRequestInput({ ...base, lat: "x" }).ok).toBe(false);
    expect(validateRequestInput({ ...base, phone: "123" }).ok).toBe(false);
    expect(validateRequestInput(null).ok).toBe(false);
  });

  it("ช่องไม่บังคับที่ผิดรูปแบบถูกทิ้ง ไม่ปฏิเสธคำขอ", () => {
    const r = validateRequestInput({
      ...base,
      urgency: "panic",
      peopleCount: "-2",
      accuracyM: "abc",
      images: ["https://evil.example/x.jpg", "https://res.cloudinary.com/demo/image/upload/a.jpg", 5],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.urgency).toBe("urgent");
    expect(r.value.peopleCount).toBeNull();
    expect(r.value.accuracyM).toBeNull();
    expect(r.value.images).toEqual(["https://res.cloudinary.com/demo/image/upload/a.jpg"]);
  });

  it("ตัดข้อความยาวเกินและช่องว่าง", () => {
    const r = validateRequestInput({ ...base, landmark: "  " + "ก".repeat(500), peopleCount: 4, accuracyM: 12.6 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.landmark.length).toBe(200);
    expect(r.value.peopleCount).toBe(4);
    expect(r.value.accuracyM).toBe(13);
  });
});
