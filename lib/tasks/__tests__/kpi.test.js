// เทสต์ KPI strip หน้าจอ 1 — คำนวณจาก derived list (README § KPI strip / State)
import { describe, it, expect, beforeAll } from "vitest";
import { computeKpi } from "../kpi";

beforeAll(() => {
  process.env.TZ = "UTC";
});

const NOW = new Date("2026-08-31T05:00:00Z"); // 31 ส.ค. 12:00 ไทย

const open = (over = {}) => ({ isCompleted: false, isOverdue: false, isDueSoon: false, needsCoordination: false, isBlocked: false, completedAt: null, resolutionDays: null, completedLate: null, ...over });
const done = (over = {}) => ({ isCompleted: true, isOverdue: false, isDueSoon: false, needsCoordination: false, isBlocked: false, ...over });

describe("computeKpi", () => {
  it("นับงานเปิด/เสร็จ/เกิน/ใกล้ครบ/ประสาน/รอวัสดุ และอัตราเสร็จ", () => {
    const k = computeKpi(
      [
        open({ isOverdue: true }),
        open({ isDueSoon: true, needsCoordination: true }),
        open({ isBlocked: true }),
        done({ completedAt: "2026-08-10T03:00:00Z", resolutionDays: 3, completedLate: false }),
      ],
      { now: NOW }
    );
    expect(k).toMatchObject({ total: 4, completed: 1, pending: 3, inProgress: 3, overdue: 1, dueSoon: 1, coordinating: 1, blocked: 1, siteIssue: 0, completionRate: 25 });
  });
  it("พบปัญหาหน้างาน: blocked นับรวม · siteIssue แยกนับ · งานปิดแล้วไม่นับ", () => {
    const k = computeKpi([open({ isBlocked: true }), open({ isBlocked: true, isSiteIssue: true }), done({ isSiteIssue: true })], { now: NOW });
    expect(k).toMatchObject({ blocked: 2, siteIssue: 1 });
  });

  it("เสร็จเดือนนี้นับตามเดือนไทย — 31 ส.ค. 17:30Z คือ 1 ก.ย. ไทย ไม่นับ", () => {
    const k = computeKpi(
      [
        done({ completedAt: "2026-08-01T03:00:00Z", resolutionDays: 1, completedLate: false }),
        done({ completedAt: "2026-08-31T17:30:00Z", resolutionDays: 1, completedLate: false }),
        done({ completedAt: "2026-07-31T17:30:00Z", resolutionDays: 1, completedLate: false }), // = 1 ส.ค. ไทย
      ],
      { now: NOW }
    );
    expect(k.completedThisMonth).toBe(2);
  });

  it("เสร็จตามกำหนด (%) นับเฉพาะงานที่รู้ว่าเสร็จช้า/ทัน; เฉลี่ยวันต่อเรื่องปัดเป็นจำนวนเต็ม", () => {
    const k = computeKpi(
      [
        done({ completedAt: "2026-08-02T03:00:00Z", resolutionDays: 2, completedLate: false }),
        done({ completedAt: "2026-08-03T03:00:00Z", resolutionDays: 5, completedLate: false }),
        done({ completedAt: "2026-08-04T03:00:00Z", resolutionDays: 9, completedLate: true }),
        done({ completedAt: null, resolutionDays: null, completedLate: null }), // ปิดด้วย status ไม่รู้เวลา
      ],
      { now: NOW }
    );
    expect(k.onTimeRate).toBe(67);
    expect(k.avgResolutionDays).toBe(5);
    expect(k.completed).toBe(4);
  });

  it("ไม่มีงาน → ศูนย์ทั้งหมด, อัตรา/เฉลี่ยเป็น null, satisfaction null (รอ PR #145)", () => {
    expect(computeKpi([], { now: NOW })).toEqual({
      total: 0,
      completed: 0,
      pending: 0,
      inProgress: 0,
      overdue: 0,
      dueSoon: 0,
      coordinating: 0,
      blocked: 0,
      siteIssue: 0,
      completedThisMonth: 0,
      completionRate: 0,
      onTimeRate: null,
      avgResolutionDays: null,
      claimedWithin24hRate: null,
      claimedCount: 0,
      satisfaction: null,
    });
  });

  const H = 3600e3;
  it("รับเรื่องภายใน 24 ชม.: นับ claimMs ≤ 24 ชม. พอดี · ไม่นับผู้ประสาน / ไม่รู้เวลาแจ้ง", () => {
    const k = computeKpi(
      [
        open({ claimMs: 0 }),
        open({ claimMs: 24 * H }),
        done({ claimMs: 25 * H, completedAt: "2026-08-10T03:00:00Z", completedLate: false }),
        open({ claimMs: 24.5 * H, claimHours: 24 }), // ชม.ปัดเศษแสดง 24 แต่เกินจริง → ช้า
        open({ claimMs: 1 * H, role: "coordinator" }),
        open({ claimMs: null }),
      ],
      { now: NOW }
    );
    expect(k.claimedCount).toBe(4);
    expect(k.claimedWithin24hRate).toBe(50);
  });

  it("เกณฑ์ชั่วโมงตาม settings.unclaimedAlertHours ถ้าส่งมา", () => {
    const k = computeKpi([open({ claimMs: 30 * H }), open({ claimMs: 50 * H })], { now: NOW, settings: { unclaimedAlertHours: 48 } });
    expect(k.claimedWithin24hRate).toBe(50);
  });
});
