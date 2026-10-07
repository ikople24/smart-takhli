import { describe, it, expect } from "vitest";
import {
  validateFlushingInput,
  canModifyFlushingLog,
  summarizeFlushing,
  bangkokDayRange,
  MAX_PHOTOS_PER_SLOT,
} from "../flushing";

const PHOTO = "https://res.cloudinary.com/demo/image/upload/v1/a.jpg";

const valid = () => ({
  flushedAt: "2026-10-06T03:00:00.000Z",
  lat: 15.2605,
  lng: 100.3555,
  locationName: "  หัวดับเพลิงหน้าตลาด  ",
  durationMin: "15",
  turbidityBeforeNtu: "25.5",
  turbidityAfterNtu: "",
  result: "clear",
  photosBefore: [PHOTO],
  photosAfter: [],
  note: " ",
});

describe("validateFlushingInput", () => {
  it("ข้อมูลครบ → ok และแปลงชนิดข้อมูล", () => {
    const r = validateFlushingInput(valid());
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({
      flushedAt: new Date("2026-10-06T03:00:00.000Z"),
      location: { type: "Point", coordinates: [100.3555, 15.2605] },
      locationName: "หัวดับเพลิงหน้าตลาด",
      durationMin: 15,
      turbidityBeforeNtu: 25.5,
      turbidityAfterNtu: null,
      result: "clear",
      photosBefore: [PHOTO],
      photosAfter: [],
      note: "",
    });
  });

  it("ไม่มีพิกัด → error ที่ location", () => {
    const r = validateFlushingInput({ ...valid(), lat: "", lng: null });
    expect(r.ok).toBe(false);
    expect(r.errors.location).toBeTruthy();
  });

  it("พิกัดนอกช่วง → error", () => {
    expect(validateFlushingInput({ ...valid(), lat: 91 }).errors.location).toBeTruthy();
    expect(validateFlushingInput({ ...valid(), lng: -181 }).errors.location).toBeTruthy();
  });

  it("ชื่อจุดว่าง/ยาวเกิน → error", () => {
    expect(validateFlushingInput({ ...valid(), locationName: "  " }).errors.locationName).toBeTruthy();
    expect(
      validateFlushingInput({ ...valid(), locationName: "ก".repeat(201) }).errors.locationName
    ).toBeTruthy();
  });

  it("ระยะเวลาต้องเป็นจำนวนเต็ม 1–600", () => {
    expect(validateFlushingInput({ ...valid(), durationMin: "" }).errors.durationMin).toBeTruthy();
    expect(validateFlushingInput({ ...valid(), durationMin: 0 }).errors.durationMin).toBeTruthy();
    expect(validateFlushingInput({ ...valid(), durationMin: 601 }).errors.durationMin).toBeTruthy();
    expect(validateFlushingInput({ ...valid(), durationMin: 2.5 }).errors.durationMin).toBeTruthy();
  });

  it("NTU ไม่บังคับ แต่ถ้าใส่ต้อง 0–1000", () => {
    expect(validateFlushingInput({ ...valid(), turbidityBeforeNtu: null }).ok).toBe(true);
    expect(
      validateFlushingInput({ ...valid(), turbidityBeforeNtu: -1 }).errors.turbidityBeforeNtu
    ).toBeTruthy();
    expect(
      validateFlushingInput({ ...valid(), turbidityAfterNtu: "abc" }).errors.turbidityAfterNtu
    ).toBeTruthy();
  });

  it("ผลต้องเป็น clear หรือ still_turbid", () => {
    expect(validateFlushingInput({ ...valid(), result: "" }).errors.result).toBeTruthy();
    expect(validateFlushingInput({ ...valid(), result: "x" }).errors.result).toBeTruthy();
    expect(validateFlushingInput({ ...valid(), result: "still_turbid" }).ok).toBe(true);
  });

  it("ต้องมีรูปอย่างน้อย 1 รูป", () => {
    const r = validateFlushingInput({ ...valid(), photosBefore: [], photosAfter: [] });
    expect(r.errors.photos).toBeTruthy();
    expect(validateFlushingInput({ ...valid(), photosBefore: [], photosAfter: [PHOTO] }).ok).toBe(true);
  });

  it("รูปเกินช่องละ 3 → error", () => {
    const many = Array(MAX_PHOTOS_PER_SLOT + 1).fill(PHOTO);
    expect(validateFlushingInput({ ...valid(), photosAfter: many }).errors.photos).toBeTruthy();
  });

  it("URL รูปต้องเป็น Cloudinary https เท่านั้น", () => {
    expect(
      validateFlushingInput({ ...valid(), photosBefore: ["https://evil.example/a.jpg"] }).errors.photos
    ).toBeTruthy();
    expect(
      validateFlushingInput({ ...valid(), photosBefore: ["javascript:alert(1)"] }).errors.photos
    ).toBeTruthy();
  });

  it("วันเวลาไม่ถูกต้อง/อนาคตเกิน 1 ชม. → error", () => {
    const now = new Date("2026-10-06T05:00:00.000Z");
    expect(validateFlushingInput({ ...valid(), flushedAt: "x" }, now).errors.flushedAt).toBeTruthy();
    expect(
      validateFlushingInput({ ...valid(), flushedAt: "2026-10-06T07:00:00.000Z" }, now).errors.flushedAt
    ).toBeTruthy();
  });

  it("หมายเหตุยาวเกิน 1000 → error", () => {
    expect(validateFlushingInput({ ...valid(), note: "ก".repeat(1001) }).errors.note).toBeTruthy();
  });
});

describe("canModifyFlushingLog", () => {
  const log = { createdByClerkId: "u1", createdAt: new Date("2026-10-01T17:30:00.000Z") }; // บันทึก 2 ต.ค. เวลาไทย
  const owner = { userId: "u1", isSuperAdmin: false };

  it("superadmin แก้ได้เสมอ", () => {
    expect(
      canModifyFlushingLog(log, { userId: "x", isSuperAdmin: true }, new Date("2027-01-01T00:00:00Z"))
    ).toBe(true);
  });

  it("ไม่ใช่เจ้าของ → ไม่ได้", () => {
    expect(
      canModifyFlushingLog(log, { userId: "u2", isSuperAdmin: false }, new Date("2026-10-02T03:00:00Z"))
    ).toBe(false);
  });

  it("เจ้าของ ภายใน 7 วันตามปฏิทินไทย → ได้ / วันที่ 8 → ไม่ได้", () => {
    // 9 ต.ค. ไทย = 7 วันหลัง 2 ต.ค.
    expect(canModifyFlushingLog(log, owner, new Date("2026-10-09T16:59:00Z"))).toBe(true);
    // 10 ต.ค. 00:00 ไทย
    expect(canModifyFlushingLog(log, owner, new Date("2026-10-09T17:00:00Z"))).toBe(false);
  });
});

describe("summarizeFlushing", () => {
  it("นับตามผล", () => {
    expect(
      summarizeFlushing([{ result: "clear" }, { result: "still_turbid" }, { result: "clear" }])
    ).toEqual({ total: 3, clear: 2, stillTurbid: 1 });
    expect(summarizeFlushing([])).toEqual({ total: 0, clear: 0, stillTurbid: 0 });
  });
});

describe("bangkokDayRange", () => {
  it("แปลงช่วงวันไทยเป็นขอบ UTC (to รวมทั้งวัน)", () => {
    const r = bangkokDayRange("2026-10-01", "2026-10-06");
    expect(r.start.toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-10-06T17:00:00.000Z");
  });

  it("รูปแบบผิด → null", () => {
    expect(bangkokDayRange("2026-1-1", "2026-10-06")).toBeNull();
    expect(bangkokDayRange("2026-10-06", "2026-10-01")).toBeNull();
  });
});
