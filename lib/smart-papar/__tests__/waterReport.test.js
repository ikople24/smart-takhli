import { describe, it, expect } from "vitest";
import {
  validateWaterReportInput,
  newWaterTicket,
  formatWaterReportFlex,
  maskPhone,
  WATER_SYMPTOMS,
} from "../waterReport";

const base = {
  symptoms: ["turbid"],
  since: "today",
  lat: 15.2539,
  lng: 100.3511,
  prefix: "นาย",
  fullName: "สมชาย ใจดี",
  phone: "081-234-4421",
  consent: true,
};

describe("validateWaterReportInput", () => {
  it("ข้อมูลครบ → ok + normalize เบอร์/พิกัด", () => {
    const v = validateWaterReportInput({ ...base, lat: "15.2539", addressNote: "  45/2 ข้างวัด " });
    expect(v.ok).toBe(true);
    expect(v.value.phone).toBe("0812344421");
    expect(v.value.point).toEqual({ lat: 15.2539, lng: 100.3511 });
    expect(v.value.addressNote).toBe("45/2 ข้างวัด");
    expect(v.value.photos).toEqual([]);
  });
  it("ต้องเลือกอาการอย่างน้อย 1 · อาการแปลกปลอมถูกตัด · ซ้ำถูกรวม", () => {
    expect(validateWaterReportInput({ ...base, symptoms: [] }).errors.symptoms).toBeTruthy();
    expect(validateWaterReportInput({ ...base, symptoms: ["hack"] }).errors.symptoms).toBeTruthy();
    const v = validateWaterReportInput({ ...base, symptoms: ["turbid", "turbid", "weak", "x"] });
    expect(v.value.symptoms).toEqual(["turbid", "weak"]);
  });
  it("ต้องเลือกว่าเริ่มเมื่อไหร่", () => {
    expect(validateWaterReportInput({ ...base, since: "" }).errors.since).toBeTruthy();
  });
  it("พิกัดต้องมีและอยู่ในช่วง", () => {
    expect(validateWaterReportInput({ ...base, lat: null }).errors.location).toBeTruthy();
    expect(validateWaterReportInput({ ...base, lat: 120 }).errors.location).toBeTruthy();
  });
  it("ชื่อและเบอร์บังคับ เบอร์ต้องเป็นเบอร์ไทย", () => {
    expect(validateWaterReportInput({ ...base, fullName: " " }).errors.fullName).toBeTruthy();
    expect(validateWaterReportInput({ ...base, phone: "12345" }).errors.phone).toBeTruthy();
    expect(validateWaterReportInput({ ...base, phone: "+66812344421" }).value.phone).toBe("0812344421");
  });
  it("ต้องยินยอมการใช้ข้อมูล", () => {
    expect(validateWaterReportInput({ ...base, consent: false }).errors.consent).toBeTruthy();
    expect(validateWaterReportInput({ ...base, consent: "true" }).errors.consent).toBeTruthy();
  });
  it("รูปรับเฉพาะ Cloudinary ไม่เกิน 3", () => {
    const c = (n) => `https://res.cloudinary.com/x/${n}.jpg`;
    const v = validateWaterReportInput({ ...base, photos: [c(1), "https://evil.example/a.jpg", c(2), c(3), c(4)] });
    expect(v.value.photos).toEqual([c(1), c(2), c(3)]);
  });
});

describe("newWaterTicket", () => {
  it("รูปแบบ WR-XXXXXX ไม่มีตัวที่สับสน (0 O 1 I)", () => {
    for (let i = 0; i < 50; i++) expect(newWaterTicket()).toMatch(/^WR-[A-HJ-NP-Z2-9]{6}$/);
  });
  it("ใช้ตัวสุ่มที่ส่งเข้าได้ (เทสได้)", () => {
    expect(newWaterTicket(() => 0)).toBe("WR-AAAAAA");
  });
});

describe("maskPhone", () => {
  it("เหลือ 4 ตัวท้าย", () => {
    expect(maskPhone("0812344421")).toBe("08x-xxx-4421");
    expect(maskPhone("12")).toBe("xxx");
  });
});

describe("formatWaterReportFlex", () => {
  const r = {
    ticket: "WR-ABC234",
    symptoms: ["turbid", "weak"],
    since: "today",
    point: { lat: 15.2539, lng: 100.3511 },
    communityName: "รจนา",
    addressNote: "45/2 ข้างวัด",
    photos: ["https://res.cloudinary.com/x/1.jpg"],
    phone: "0812344421",
    fullName: "สมชาย ใจดี",
    createdAt: new Date("2026-10-16T03:05:00Z"),
  };
  it("altText ไม่มีเบอร์/ชื่อผู้แจ้ง (โผล่ในแจ้งเตือนมือถือ)", () => {
    const m = formatWaterReportFlex(r);
    expect(m.type).toBe("flex");
    expect(m.altText).toContain("WR-ABC234");
    expect(m.altText).toContain(WATER_SYMPTOMS.turbid);
    expect(m.altText).not.toContain("0812344421");
    expect(m.altText).not.toContain("สมชาย");
  });
  it("เบอร์อยู่ในปุ่มโทรเท่านั้น ไม่อยู่ในเนื้อการ์ด", () => {
    const m = formatWaterReportFlex(r);
    const json = JSON.stringify(m.contents);
    expect(json).toContain("tel:0812344421");
    expect(JSON.stringify(m.contents.body)).not.toContain("0812344421");
  });
  it("มีรูป → hero · ไม่มีรูป → ไม่มี hero", () => {
    expect(formatWaterReportFlex(r).contents.hero?.url).toBe(r.photos[0]);
    expect(formatWaterReportFlex({ ...r, photos: [] }).contents.hero).toBeUndefined();
    // รูป Cloudinary จริงต้องถูกย่อ + เป็น JPEG ก่อนส่ง LINE (LINE ไม่รับ WebP, รูปมือถือต้นฉบับหลาย MB)
    const real = "https://res.cloudinary.com/demo/image/upload/v1/water/a.jpg";
    expect(formatWaterReportFlex({ ...r, photos: [real] }).contents.hero.url).toBe(
      "https://res.cloudinary.com/demo/image/upload/c_limit,w_1024,q_auto,f_jpg/v1/water/a.jpg"
    );
  });
  it("ไม่ทราบชุมชน → บอกตรง ๆ", () => {
    expect(JSON.stringify(formatWaterReportFlex({ ...r, communityName: null }).contents.body)).toContain("ไม่ทราบชุมชน");
  });
});
