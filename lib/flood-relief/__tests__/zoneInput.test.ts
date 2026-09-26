import { describe, it, expect } from "vitest";
import { describeZonePatch, parseZoneInput } from "../zoneInput";

const poly = { type: "Polygon", coordinates: [[[100.35, 15.25], [100.36, 15.25], [100.36, 15.26], [100.35, 15.25]]] };

describe("parseZoneInput", () => {
  it("สร้าง: ต้องมีระดับ + รูป · ชื่อไม่บังคับ", () => {
    expect(parseZoneInput({ level: "critical", geometry: poly }, true)).toEqual({
      ok: true,
      value: { level: "critical", geometry: poly },
    });
    expect(parseZoneInput({ geometry: poly }, true)).toMatchObject({ ok: false, error: expect.stringMatching(/ระดับ/) });
    expect(parseZoneInput({ level: "watch" }, true)).toMatchObject({ ok: false });
  });

  it("แก้: ส่งเฉพาะช่องที่เปลี่ยน · ว่างทั้งหมด = error", () => {
    expect(parseZoneInput({ active: false }, false)).toEqual({ ok: true, value: { active: false } });
    expect(parseZoneInput({ name: "  B  " }, false)).toEqual({ ok: true, value: { name: "B" } });
    expect(parseZoneInput({}, false)).toMatchObject({ ok: false });
    expect(parseZoneInput({ level: "flood" }, false)).toMatchObject({ ok: false });
  });

  it("ชื่อยาวเกินตัดเหลือ 20", () => {
    const r = parseZoneInput({ name: "ก".repeat(50), level: "safe", geometry: poly }, true);
    expect(r.ok && r.value.name?.length).toBe(20);
  });
});

describe("describeZonePatch", () => {
  it("สรุปสิ่งที่เปลี่ยนเป็นภาษาไทย", () => {
    expect(describeZonePatch({ level: "critical", geometry: poly, active: false })).toBe(
      "เปลี่ยนระดับเป็น วิกฤต · แก้รูปโซน · ปิดใช้งาน"
    );
  });
});
