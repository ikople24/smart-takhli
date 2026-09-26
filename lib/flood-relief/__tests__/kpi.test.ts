import { describe, it, expect } from "vitest";
import { computeKpi } from "../kpi";

const now = new Date("2026-09-26T05:00:00Z"); // 12:00 น.

describe("computeKpi", () => {
  it("นับแต่ละช่องตามนิยาม", () => {
    const reqs = [
      { status: "received", urgency: "critical" },
      { status: "assigning", urgency: "critical" },
      { status: "dispatched", urgency: "critical" },
      { status: "received", urgency: "urgent" },
      { status: "on_site", urgency: "normal" },
      // เสร็จวันนี้ (เวลาไทย): ถึงจุด 30 และ 50 นาที → เฉลี่ย 40
      { status: "done", urgency: "urgent", createdAt: "2026-09-26T01:00:00Z", onSiteAt: "2026-09-26T01:30:00Z", doneAt: "2026-09-26T02:00:00Z" },
      { status: "done", urgency: "urgent", createdAt: "2026-09-26T02:00:00Z", onSiteAt: "2026-09-26T02:50:00Z", doneAt: "2026-09-26T03:00:00Z" },
      // เสร็จเมื่อวานตามเวลาไทย (16:30 UTC ของ 25 = 23:30 น.) ไม่นับ
      { status: "done", urgency: "urgent", createdAt: "2026-09-25T15:00:00Z", onSiteAt: "2026-09-25T16:00:00Z", doneAt: "2026-09-25T16:30:00Z" },
      { status: "cancelled", urgency: "critical" },
    ];
    const teams = [{ status: "busy" }, { status: "idle" }, { status: "busy", active: false }];
    expect(computeKpi(reqs, teams, now)).toEqual({
      criticalPending: 2,
      newUnassigned: 2,
      inProgress: 2,
      doneToday: 2,
      avgMinutesToSite: 40,
      teamsBusy: 1,
      teamsTotal: 2,
    });
  });

  it("ไม่มีข้อมูล = ศูนย์ และเฉลี่ยเป็น null", () => {
    expect(computeKpi([], [], now)).toMatchObject({ doneToday: 0, avgMinutesToSite: null, teamsTotal: 0 });
  });
});
