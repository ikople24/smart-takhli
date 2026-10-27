// components/elderly-school/useElderlyData.js
// hook ดึงข้อมูลของแท็บต่าง ๆ — API เดิมทั้งหมดใน pages/api/elderly-school/*
import { useCallback, useEffect, useMemo, useState } from "react";
import { sessionStatuses, bangkokTodayISO } from "@/lib/elderly-school/followUp";

export async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || "เกิดข้อผิดพลาด");
  }
  return json;
}

export function postJson(url, body, method = "POST") {
  return fetchJson(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// แคชผล GET ระดับโมดูล — สลับแท็บแล้วแสดงข้อมูลเดิมทันที แล้วค่อยดึงใหม่เบื้องหลัง (stale-while-revalidate)
// แท็บถูก remount ทุกครั้งที่เปลี่ยน (key ใน ElderlySchoolModule) จึงต้องแคชนอก component
const responseCache = new Map();

function useApi(url) {
  const [data, setData] = useState(() => (url ? responseCache.get(url) ?? null : null));
  const [loading, setLoading] = useState(Boolean(url) && !responseCache.has(url));
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!url) return undefined;
    let alive = true;
    const cached = responseCache.get(url);
    if (cached) setData(cached);
    setLoading(!cached);
    setError("");
    fetchJson(url)
      .then((json) => {
        // ข้อมูลไม่เปลี่ยน → คง reference เดิม ไม่ให้ฟอร์มที่ sync จาก data (ตั้งค่าวันเรียน/กรอกผลวัด) ถูกรีเซ็ตกลางการพิมพ์
        if (cached && JSON.stringify(cached) === JSON.stringify(json)) return;
        responseCache.set(url, json);
        if (alive) setData(json);
      })
      .catch((e) => {
        if (alive) {
          setData(null);
          setError(e?.message || "โหลดข้อมูลไม่สำเร็จ");
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [url, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload };
}

/** สรุปสุขภาพ + รายคน (visit = "latest" หรือเลขครั้ง 1–16) */
export function useDashboard(yearBE, visit = "latest") {
  const qs = new URLSearchParams({ yearBE: String(yearBE), visit: String(visit), includePeople: "1" });
  return useApi(yearBE ? `/api/elderly-school/dashboard?${qs.toString()}` : null);
}

/** รายชื่อผู้เรียนทั้งปี (ทุกคนที่มี visit ในปีนั้น) */
export function useRoster(yearBE) {
  const api = useApi(yearBE ? `/api/elderly-school/cards?yearBE=${encodeURIComponent(String(yearBE))}` : null);
  const people = useMemo(() => (Array.isArray(api.data?.people) ? api.data.people : []), [api.data]);
  return { ...api, people };
}

/** ตารางวันเรียน + สถานะรายครั้ง */
export function useSchedule(yearBE) {
  const api = useApi(yearBE ? `/api/elderly-school/schedule?yearBE=${encodeURIComponent(String(yearBE))}` : null);
  const sessions = useMemo(
    () => (Array.isArray(api.data?.schedule?.sessions) ? api.data.schedule.sessions : []),
    [api.data]
  );
  const statuses = useMemo(() => sessionStatuses(sessions, bangkokTodayISO()), [sessions]);
  return { ...api, sessions, statuses };
}

/**
 * รวมรายชื่อทั้งปี (roster) กับผลวัดล่าสุดจาก dashboard
 * คนที่ยังไม่มีผลวัด → metrics = null
 */
export function mergeRoster(roster, dashboardPeople, mentalHealthOthers, attendanceByPerson) {
  const byId = new Map((dashboardPeople || []).map((p) => [String(p.personId), p]));
  const mhOthers = new Map((mentalHealthOthers || []).map((m) => [String(m.personId), m]));
  const att = new Map((attendanceByPerson || []).map((a) => [String(a.personId), a]));
  // follow = ข้อมูลรวมสำหรับ needsCloseFollowUp/followUpFlags (ผลวัดล่าสุด + 2Q + ขาดเรียนติดกัน)
  const withMh = (row) => {
    const mh = row.metrics?.mentalHealth || mhOthers.get(row.personId) || null;
    const a = att.get(row.personId) || null;
    const missedStreak = a?.missedStreak ?? row.metrics?.missedStreak ?? 0;
    return {
      ...row,
      mh,
      attended: a?.attended ?? row.metrics?.attendedCount ?? 0,
      missedStreak,
      follow: { ...(row.metrics || {}), mentalHealth: mh, missedStreak },
    };
  };
  const rows = (roster || []).map((r) =>
    withMh({
      personId: String(r.personId),
      fullName: r.fullName || "",
      citizenId: r.citizenId || "",
      metrics: byId.get(String(r.personId)) || null,
    })
  );
  // คนที่มีใน dashboard แต่ไม่อยู่ใน roster (ไม่ควรเกิด) — กันตกหล่น
  for (const p of dashboardPeople || []) {
    if (!rows.some((r) => r.personId === String(p.personId))) {
      rows.push(withMh({ personId: String(p.personId), fullName: p.fullName || "", citizenId: "", metrics: p }));
    }
  }
  rows.sort((a, b) => a.fullName.localeCompare(b.fullName, "th"));
  return rows;
}
