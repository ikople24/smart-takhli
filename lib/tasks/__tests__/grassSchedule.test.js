// เทสต์ตารางคิวตัดหญ้า — ทำความสะอาดค่า + ตัดสินว่าเรื่องไหนแสดงลิงก์ (logic ล้วน)
import { describe, it, expect } from "vitest";
import { EMPTY_GRASS_SCHEDULE, grassSchedulePatch, grassScheduleFor, isHttpsUrl, normalizeGrassSchedule } from "../grassSchedule";
import { COMPLAINT_STATUS } from "../status";

const URL_OK = "https://res.cloudinary.com/demo/image/upload/v1/grass-queue.png";
const settings = { grassSchedule: { url: URL_OK, fileName: "คิวตัดหญ้า.png", updatedAt: "2026-11-10T03:00:00.000Z" } };

describe("isHttpsUrl", () => {
  it("รับเฉพาะ https ที่ parse ได้", () => {
    expect(isHttpsUrl(URL_OK)).toBe(true);
    expect(isHttpsUrl("http://example.com/a.png")).toBe(false);
    expect(isHttpsUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpsUrl("data:image/png;base64,AAAA")).toBe(false);
    expect(isHttpsUrl("https://")).toBe(false);
    expect(isHttpsUrl(42)).toBe(false);
    expect(isHttpsUrl(`https://x.com/${"a".repeat(2100)}`)).toBe(false);
  });
});

describe("normalizeGrassSchedule", () => {
  it("ค่าว่าง/เพี้ยน → ไม่มีตาราง", () => {
    expect(normalizeGrassSchedule(null)).toEqual(EMPTY_GRASS_SCHEDULE);
    expect(normalizeGrassSchedule("x")).toEqual(EMPTY_GRASS_SCHEDULE);
    expect(normalizeGrassSchedule({ url: "http://a.com/x.pdf", fileName: "x.pdf" })).toEqual(EMPTY_GRASS_SCHEDULE);
  });
  it("https → เก็บ url/fileName และ updatedAt เป็น ISO", () => {
    const s = normalizeGrassSchedule({ url: ` ${URL_OK} `, fileName: " คิว.png ", updatedAt: new Date("2026-11-10T03:00:00Z") });
    expect(s).toEqual({ url: URL_OK, fileName: "คิว.png", updatedAt: "2026-11-10T03:00:00.000Z" });
  });
  it("updatedAt เพี้ยน → null · ชื่อไฟล์ยาวถูกตัด", () => {
    const s = normalizeGrassSchedule({ url: URL_OK, fileName: "ก".repeat(500), updatedAt: "not-a-date" });
    expect(s.updatedAt).toBeNull();
    expect(s.fileName).toHaveLength(200);
  });
});

describe("grassSchedulePatch — updatedAt ประทับฝั่ง server", () => {
  const now = new Date("2026-11-11T05:00:00Z");
  it("ไม่เชื่อ updatedAt จาก client", () => {
    expect(grassSchedulePatch({ url: URL_OK, fileName: "a.png", updatedAt: "2000-01-01" }, now)).toEqual({
      url: URL_OK,
      fileName: "a.png",
      updatedAt: now.toISOString(),
    });
  });
  it("url ว่าง = ลบตาราง (ค่าว่างทั้งชุด)", () => {
    expect(grassSchedulePatch({ url: "" }, now)).toEqual(EMPTY_GRASS_SCHEDULE);
    expect(grassSchedulePatch(null, now)).toEqual(EMPTY_GRASS_SCHEDULE);
  });
});

describe("grassScheduleFor — แสดงเฉพาะเรื่องตัดหญ้าที่ยังไม่ปิด", () => {
  const grass = { problems: ["หญ้ารก"], status: COMPLAINT_STATUS.IN_PROGRESS };
  it("เรื่องตัดหญ้าเปิดอยู่ + มีตาราง → url", () => {
    expect(grassScheduleFor(grass, settings)).toBe(URL_OK);
    expect(grassScheduleFor({ detail: "วัชพืชขึ้นริมทาง", status: "รอการตรวจสอบ" }, settings)).toBe(URL_OK);
    expect(grassScheduleFor({ workType: "grass", detail: "x", status: COMPLAINT_STATUS.COORDINATING }, settings)).toBe(URL_OK);
  });
  it("ปิดแล้ว / ไม่ใช่งานตัดหญ้า / ไม่มีตาราง → null", () => {
    expect(grassScheduleFor({ ...grass, status: COMPLAINT_STATUS.DONE }, settings)).toBeNull();
    expect(grassScheduleFor({ problems: ["ไฟดับ"], status: COMPLAINT_STATUS.IN_PROGRESS }, settings)).toBeNull();
    expect(grassScheduleFor(grass, {})).toBeNull();
    expect(grassScheduleFor(grass, null)).toBeNull();
    expect(grassScheduleFor(null, settings)).toBeNull();
  });
  it("ชนิดงานที่เจ้าหน้าที่ตั้งเองชนะการเดาจากข้อความ", () => {
    expect(grassScheduleFor({ workType: "tree", detail: "หญ้ารก", status: COMPLAINT_STATUS.IN_PROGRESS }, settings)).toBeNull();
  });
});
