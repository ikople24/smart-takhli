import { useEffect } from "react";

const PING_INTERVAL_MS = 60_000;

function getClientId(): string {
  const KEY = "site-client-id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = (crypto.randomUUID?.() ?? String(Date.now() + Math.random()));
    localStorage.setItem(KEY, id);
  }
  return id;
}

// ติดตามการเข้าชม + heartbeat ออนไลน์ (เรียกจาก _app เฉพาะ route สาธารณะ)
export function useSiteTracking(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    // visit: 1 ครั้ง/วัน/แท็บ (sessionStorage)
    const today = new Date().toISOString().slice(0, 10);
    const visitKey = `site-visit-${today}`;
    if (!sessionStorage.getItem(visitKey)) {
      sessionStorage.setItem(visitKey, "1");
      fetch("/api/site-stats/visit", { method: "POST" }).catch(() => {});
    }

    // ping: heartbeat ทุก 60 วิ
    const clientId = getClientId();
    const ping = () =>
      fetch("/api/site-stats/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      }).catch(() => {});
    ping();
    const timer = setInterval(ping, PING_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [enabled]);
}
