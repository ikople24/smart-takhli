// lib/flood-relief/kpi.ts
// ตัวเลข 5 ช่องบนหัวแดชบอร์ด — คำนวณฝั่ง server (logic ล้วน)

import { isBeforeDispatch, isClosedStatus } from "./status";

type DateLike = Date | string | number | null | undefined;
type Req = { status?: string | null; urgency?: string | null; createdAt?: DateLike; onSiteAt?: DateLike; doneAt?: DateLike };
type Team = { status?: string | null; active?: boolean };

const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" });
const ms = (v: DateLike) => (v || v === 0 ? new Date(v).getTime() : NaN);

export type FloodKpi = {
  criticalPending: number;
  newUnassigned: number;
  inProgress: number;
  doneToday: number;
  /** เฉลี่ยนาทีจากรับเรื่องถึงทีมถึงจุด ของคำขอที่เสร็จวันนี้ · ไม่มีข้อมูล = null */
  avgMinutesToSite: number | null;
  teamsBusy: number;
  teamsTotal: number;
};

export function computeKpi(requests: readonly Req[], teams: readonly Team[], now: Date = new Date()): FloodKpi {
  const today = ymd.format(now);
  let criticalPending = 0;
  let newUnassigned = 0;
  let inProgress = 0;
  let doneToday = 0;
  const toSite: number[] = [];

  for (const r of requests) {
    if (!isClosedStatus(r.status) && r.urgency === "critical" && isBeforeDispatch(r.status)) criticalPending++;
    if (r.status === "received") newUnassigned++;
    if (r.status === "dispatched" || r.status === "on_site") inProgress++;
    if (r.status === "done" && r.doneAt != null && r.doneAt !== "" && ymd.format(new Date(r.doneAt)) === today) {
      doneToday++;
      const d = ms(r.onSiteAt) - ms(r.createdAt);
      if (Number.isFinite(d) && d >= 0) toSite.push(d / 60000);
    }
  }

  const activeTeams = teams.filter((t) => t.active !== false);
  return {
    criticalPending,
    newUnassigned,
    inProgress,
    doneToday,
    avgMinutesToSite: toSite.length ? Math.round(toSite.reduce((a, b) => a + b, 0) / toSite.length) : null,
    teamsBusy: activeTeams.filter((t) => t.status === "busy").length,
    teamsTotal: activeTeams.length,
  };
}
