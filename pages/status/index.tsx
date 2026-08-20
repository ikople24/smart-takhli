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
import { filterComplaints, normalizeSearch } from "@/lib/citizen/status/searchComplaints";
import { Search, X } from "lucide-react";

const ACTIVE = "อยู่ระหว่างดำเนินการ";
const DONE = "ดำเนินการเสร็จสิ้น";
const PAGE_SIZE = 20; // ต่อ 1 คิวรีเสมอ — กดดูเพิ่มเติมจึงจะขอชุดถัดไป
// ค้นหา: API สาธารณะไม่มีพารามิเตอร์ค้นหา จึงโหลด "ดัชนีค้นหา" ของแท็บนั้นครั้งเดียว
// ตอนผู้ใช้เริ่มพิมพ์ (ไม่ใช่ตอนเปิดหน้า) แล้วกรองในเครื่อง
const SEARCH_INDEX_LIMIT = 500;

// ดูได้ทีละสถานะเท่านั้น — ยอด "ทั้งหมด" เป็นแค่ตัวเลขแจ้งให้ทราบ ไม่ดึงลิสต์รวม
// (เจ้าของสั่ง 2026-08-20: การดึงลิสต์รวมทำให้หน้าโหลดนานโดยไม่จำเป็น)
type FilterKey = "active" | "done";
const FILTER_STATUS: Record<FilterKey, string> = { active: ACTIVE, done: DONE };

export default function StatusList() {
  const router = useRouter();
  const { menu, fetchMenu, menuLoading } = useMenuStore();
  const [hasFetchedMenu, setHasFetchedMenu] = useState(false);
  // null = ยังไม่รู้ว่าจะดูสถานะไหน (รอ router พร้อม) — กันยิงคิวรีทิ้งรอบแรก
  const [filter, setFilter] = useState<FilterKey | null>(null);
  const [items, setItems] = useState<ComplaintListItem[]>([]);
  const [assignments, setAssignments] = useState<Record<string, AssignmentLite>>({});
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<{ active: number; done: number } | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // ค้นหา
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState(""); // ค่าหน่วง (debounce) ที่ใช้กรองจริง
  const [searchRows, setSearchRows] = useState<ComplaintListItem[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchCache = useRef<Partial<Record<FilterKey, ComplaintListItem[]>>>({});

  useEffect(() => {
    if (!hasFetchedMenu && menu.length === 0 && !menuLoading) {
      fetchMenu();
      setHasFetchedMenu(true);
    }
  }, [menu.length, fetchMenu, menuLoading, hasFetchedMenu]);

  // filter จาก query (?filter=active|done) — ลิงก์จาก Nav ล่าง; ไม่ระบุ = กำลังดำเนินการ
  // (คนที่เพิ่งส่งเรื่องแล้วกด "ติดตามสถานะ" ต้องการเห็นเรื่องที่ยังไม่เสร็จก่อน)
  useEffect(() => {
    if (!router.isReady) return;
    setFilter(router.query.filter === "done" ? "done" : "active");
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
      const params = new URLSearchParams({
        status: FILTER_STATUS[currentFilter],
        withCount: "true",
        page: String(pageNum),
        limit: String(PAGE_SIZE), // ไม่เกิน 20 เรื่องต่อคิวรีเสมอ
        sortField: "updatedAt",
        sortOrder: "desc",
      });
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
    if (!filter) return; // ยังไม่รู้แท็บ (router ยังไม่พร้อม) — ยังไม่ต้องยิงคิวรี
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

  // หน่วงคำค้น 300ms — ไม่กรอง/ไม่ยิงคิวรีทุกตัวอักษร
  useEffect(() => {
    const t = setTimeout(() => setQuery(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // สลับแท็บแล้วล้างคำค้น — ช่องค้นหามีเฉพาะแท็บเสร็จสิ้น จะได้ไม่ค้างค้นข้ามแท็บ
  useEffect(() => {
    setSearch("");
    setQuery("");
  }, [filter]);

  // โหลดดัชนีค้นหาครั้งเดียว (ตอนเริ่มพิมพ์เท่านั้น) แล้วแคชไว้ — เฉพาะแท็บเสร็จสิ้น
  useEffect(() => {
    if (filter !== "done" || !normalizeSearch(query)) {
      setSearchRows(null);
      return;
    }
    const cached = searchCache.current[filter];
    if (cached) {
      setSearchRows(cached);
      return;
    }
    let alive = true;
    setSearchLoading(true);
    (async () => {
      try {
        const params = new URLSearchParams({
          status: FILTER_STATUS[filter],
          page: "1",
          limit: String(SEARCH_INDEX_LIMIT),
          sortField: "updatedAt",
          sortOrder: "desc",
        });
        const json = await fetch(`/api/complaints?${params}`).then((r) => r.json());
        const rows: ComplaintListItem[] = Array.isArray(json) ? json : (json?.data ?? []);
        searchCache.current[filter] = rows;
        if (alive) setSearchRows(rows);
      } catch {
        if (alive) setSearchRows([]);
      } finally {
        if (alive) setSearchLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [filter, query]);

  // เติมข้อมูลมอบหมายให้การ์ดผลค้นหาที่ยังไม่มี (แสดงขั้นความคืบหน้าให้ถูก)
  useEffect(() => {
    if (!searchRows || searchRows.length === 0) return;
    const shown = filterComplaints(searchRows, query).slice(0, 30);
    const missing = shown.map((r) => r._id).filter((id) => !(id in assignments));
    if (missing.length === 0) return;
    let alive = true;
    (async () => {
      try {
        const aj = await fetch("/api/complaints/assignments/by-complaints", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ complaintIds: missing }),
        }).then((r) => r.json());
        const map = aj?.data ?? aj?.assignments ?? {};
        if (alive) setAssignments((prev) => ({ ...prev, ...map }));
      } catch {
        // ไม่มีข้อมูลมอบหมาย → การ์ดแสดงขั้น 1 ตาม logic เดิม
      }
    })();
    return () => {
      alive = false;
    };
  }, [searchRows, query, assignments]);

  const loadMore = async () => {
    if (!filter) return;
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
    router.replace({ pathname: "/status", query: { filter: f } }, undefined, { shallow: true });
  };

  const iconFor = (category?: string) => menu.find((m) => m.Prob_name === category)?.Prob_pic;
  const allCount = counts ? counts.active + counts.done : null;

  const chips: { key: FilterKey; label: string; count: number | null }[] = [
    { key: "active", label: "กำลังดำเนินการ", count: counts?.active ?? null },
    { key: "done", label: "เสร็จสิ้น", count: counts?.done ?? null },
  ];

  const searching = filter === "done" && normalizeSearch(query).length > 0;
  const results = searching ? filterComplaints(searchRows ?? [], query) : [];
  // ดัชนีค้นหามีเพดาน — ถ้าเรื่องในแท็บมากกว่านั้นต้องบอกผู้ใช้ว่าค้นจากล่าสุดเท่าใด
  const searchCapped = searching && (searchRows?.length ?? 0) >= SEARCH_INDEX_LIMIT;

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
              {/* ยอดรวมเป็นข้อมูลบอกให้ทราบเฉย ๆ — ไม่ใช่ตัวกรอง จึงไม่ต้องดึงลิสต์รวม */}
              <div className="text-[11px] text-[#9590A8]">
                {allCount != null ? `เรื่องร้องเรียนทั้งหมด ${allCount.toLocaleString("th-TH")} เรื่อง` : "เรื่องร้องเรียนที่แจ้งเข้าเทศบาล"}
              </div>
            </div>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5">
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => changeFilter(c.key)}
                className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] transition ${
                  filter === c.key
                    ? "bg-gradient-to-br from-[#7C3AED] to-[#9050F0] font-semibold text-white shadow-[0_6px_14px_rgba(124,58,237,0.30)]"
                    : "bg-white text-[#6B6880] shadow-[0_2px_10px_rgba(124,58,237,0.08)] ring-1 ring-[#E9E3F8]"
                }`}
              >
                {c.label}
                {c.count != null ? ` ${c.count}` : ""}
              </button>
            ))}
          </div>

          {/* ช่องค้นหา — เฉพาะแท็บเสร็จสิ้น (เรื่องเยอะ ต้องมีตัวช่วยหา);
              แท็บกำลังดำเนินการมีไม่กี่เรื่อง กวาดตาเห็นครบอยู่แล้ว
              โหลดชุดค้นหาเมื่อผู้ใช้พิมพ์เท่านั้น หน้าเปิดครั้งแรกจึงยังเบา */}
          {filter === "done" && (
          <div className="relative mt-2.5">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A7A2B6]" />
            <input
              type="text"
              inputMode="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาเลขที่คำร้อง หมวด ชุมชน หรือคำในเรื่อง"
              aria-label="ค้นหาเรื่องร้องเรียน"
              className="w-full rounded-full bg-white py-2.5 pl-9 pr-9 text-[12.5px] text-[#4A4458] shadow-[0_2px_10px_rgba(124,58,237,0.08)] ring-1 ring-[#E9E3F8] outline-none placeholder:text-[#B4B0C0] focus:ring-[#C9B8F0]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="ล้างคำค้นหา"
                className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-[#F4F2F9] text-[#6B6880]"
              >
                <X size={13} />
              </button>
            )}
          </div>
          )}
        </div>

        <div className="flex-1 px-4 pb-6">
          {searching ? (
            searchLoading && searchRows == null ? (
              <div className="flex flex-col gap-2.5" role="status" aria-label="กำลังค้นหา">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-[110px] skeleton rounded-[16px] bg-[#E9E4F3]" />
                ))}
                <span className="sr-only">กำลังค้นหา</span>
              </div>
            ) : results.length === 0 ? (
              <div className="rounded-[16px] bg-white p-6 text-center text-[13px] text-[#9590A8]">
                ไม่พบเรื่องที่ตรงกับ “{query.trim()}” ใน{filter === "done" ? "เรื่องที่เสร็จสิ้น" : "เรื่องที่กำลังดำเนินการ"}
              </div>
            ) : (
              <>
                <div className="mb-2 px-1 text-[11.5px] text-[#9590A8]">
                  พบ {results.length.toLocaleString("th-TH")} เรื่องที่ตรงกับ “{query.trim()}”
                  {searchCapped ? ` (ค้นจาก ${SEARCH_INDEX_LIMIT.toLocaleString("th-TH")} เรื่องล่าสุด)` : ""}
                </div>
                <div className="flex flex-col gap-2.5">
                  {results.slice(0, 30).map((c) => (
                    <ComplaintCard
                      key={c._id}
                      complaint={c}
                      assignment={assignments[c._id] ?? null}
                      iconUrl={iconFor(c.category)}
                    />
                  ))}
                </div>
                {results.length > 30 && (
                  <p className="mt-3 text-center text-[11.5px] text-[#9590A8]">
                    แสดง 30 เรื่องแรก — พิมพ์คำค้นให้เจาะจงขึ้นเพื่อลดผลลัพธ์
                  </p>
                )}
              </>
            )
          ) : loading ? (
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
