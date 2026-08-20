// pages/status/index.tsx
// ลิสต์ติดตามสถานะโฉมใหม่ (เฟส 3) — รวมทุกสถานะ + chips กรอง
// spec: docs/superpowers/specs/2026-08-19-citizen-status-design.md
// ข้อมูล: GET /api/complaints (PDPA/เรื่องลับกรองฝั่ง server) + assignments เดิม
import { useCallback, useEffect, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import CitizenShell from "@/components/citizen/CitizenShell";
import ComplaintCard, { AssignmentLite, ComplaintListItem } from "@/components/citizen/status/ComplaintCard";
import { useMenuStore } from "@/stores/useMenuStore";

const ACTIVE = "อยู่ระหว่างดำเนินการ";
const DONE = "ดำเนินการเสร็จสิ้น";
const PAGE_SIZE = 20;

type FilterKey = "all" | "active" | "done";
const FILTER_STATUS: Record<FilterKey, string | null> = { all: null, active: ACTIVE, done: DONE };

export default function StatusList() {
  const router = useRouter();
  const { menu, fetchMenu, menuLoading } = useMenuStore();
  const [hasFetchedMenu, setHasFetchedMenu] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [items, setItems] = useState<ComplaintListItem[]>([]);
  const [assignments, setAssignments] = useState<Record<string, AssignmentLite>>({});
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<{ active: number; done: number } | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!hasFetchedMenu && menu.length === 0 && !menuLoading) {
      fetchMenu();
      setHasFetchedMenu(true);
    }
  }, [menu.length, fetchMenu, menuLoading, hasFetchedMenu]);

  // filter เริ่มต้นจาก query (?filter=active|done) — ลิงก์จาก Nav ล่าง
  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query.filter;
    if (q === "active" || q === "done") setFilter(q);
  }, [router.isReady, router.query.filter]);

  // จำนวนต่อสถานะ (สำหรับ chips) — คิวรีเบา limit=1 ขอแค่ count
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [a, d] = await Promise.all(
          [ACTIVE, DONE].map((s) =>
            fetch(`/api/complaints?status=${encodeURIComponent(s)}&withCount=true&page=1&limit=1`).then((r) => r.json())
          )
        );
        if (!alive) return;
        setCounts({ active: a?.pagination?.total ?? 0, done: d?.pagination?.total ?? 0 });
      } catch {
        if (alive) setCounts(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // กัน response เก่าทับ: fetch ของ filter ก่อนหน้า (เช่น all ตอน mount) อาจตอบ
  // ช้ากว่า fetch ของ filter จาก query แล้วเขียนทับลิสต์ — ใช้เลขรอบล่าสุดตัดทิ้ง
  const fetchSeq = useRef(0);

  const fetchPage = useCallback(
    async (pageNum: number, currentFilter: FilterKey, append: boolean) => {
      const seq = ++fetchSeq.current;
      const status = FILTER_STATUS[currentFilter];
      const params = new URLSearchParams({
        withCount: "true",
        page: String(pageNum),
        limit: String(PAGE_SIZE),
        sortField: "updatedAt",
        sortOrder: "desc",
      });
      if (status) params.set("status", status);
      const json = await fetch(`/api/complaints?${params}`).then((r) => r.json());
      if (seq !== fetchSeq.current) return; // มี fetch รอบใหม่กว่าแล้ว — ทิ้งผลรอบนี้
      const rows: ComplaintListItem[] = json?.data ?? [];
      setTotal(json?.pagination?.total ?? rows.length);
      setItems((prev) => (append ? [...prev, ...rows] : rows));
      if (rows.length > 0) {
        try {
          const res = await fetch("/api/complaints/assignments/by-complaints", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ complaintIds: rows.map((r) => r._id) }),
          });
          const aj = await res.json();
          const map = aj?.data ?? aj?.assignments ?? {};
          setAssignments((prev) => ({ ...prev, ...map }));
        } catch {
          // ไม่มีข้อมูลมอบหมาย → progress แสดงขั้น 1 ตาม logic
        }
      }
    },
    []
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setPage(1);
    fetchPage(1, filter, false)
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [filter, fetchPage]);

  const loadMore = async () => {
    const next = page + 1;
    setLoadingMore(true);
    try {
      await fetchPage(next, filter, true);
      setPage(next);
    } finally {
      setLoadingMore(false);
    }
  };

  const changeFilter = (f: FilterKey) => {
    setFilter(f);
    const query = f === "all" ? {} : { filter: f };
    router.replace({ pathname: "/status", query }, undefined, { shallow: true });
  };

  const iconFor = (category?: string) => menu.find((m) => m.Prob_name === category)?.Prob_pic;
  const allCount = counts ? counts.active + counts.done : null;

  const chips: { key: FilterKey; label: string; count: number | null }[] = [
    { key: "all", label: "ทั้งหมด", count: allCount },
    { key: "active", label: "กำลังดำเนินการ", count: counts?.active ?? null },
    { key: "done", label: "เสร็จสิ้น", count: counts?.done ?? null },
  ];

  return (
    <>
      <Head>
        <title>ติดตามสถานะ · Smart Takhli</title>
      </Head>
      <CitizenShell>
        <div className="shrink-0 px-4 pb-3 pt-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/")}
              aria-label="กลับหน้าแรก"
              className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-white shadow-[0_2px_8px_rgba(60,40,100,0.06)]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4A4458" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 6-6 6 6 6" />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[17px] font-bold leading-tight">ติดตามสถานะ</div>
              <div className="text-[11px] text-[#9590A8]">เรื่องร้องเรียนที่แจ้งเข้าเทศบาล</div>
            </div>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5">
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => changeFilter(c.key)}
                className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] ${
                  filter === c.key
                    ? "bg-[#7C3AED] font-semibold text-white"
                    : "border border-[#ECEAF2] bg-white text-[#6B6880]"
                }`}
              >
                {c.label}
                {c.count != null ? ` ${c.count}` : ""}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 px-4 pb-6">
          {loading ? (
            <div className="flex flex-col gap-2.5" role="status" aria-label="กำลังโหลดรายการเรื่องร้องเรียน">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[110px] skeleton rounded-[16px] bg-[#E9E4F3]" />
              ))}
              <span className="sr-only">กำลังโหลดรายการเรื่องร้องเรียน</span>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-[16px] bg-white p-6 text-center text-[13px] text-[#9590A8]">
              ยังไม่มีเรื่องร้องเรียนในหมวดนี้
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2.5">
                {items.map((c) => (
                  <ComplaintCard
                    key={c._id}
                    complaint={c}
                    assignment={assignments[c._id] ?? null}
                    iconUrl={iconFor(c.category)}
                  />
                ))}
              </div>
              {items.length < total && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="mt-4 w-full rounded-[14px] bg-white py-3 text-center text-[13px] font-semibold text-[#7C3AED] shadow-[0_4px_12px_rgba(60,40,100,0.04)] disabled:opacity-60"
                >
                  {loadingMore ? "กำลังโหลด…" : `ดูเพิ่มเติม (${items.length}/${total})`}
                </button>
              )}
            </>
          )}
        </div>
      </CitizenShell>
    </>
  );
}
