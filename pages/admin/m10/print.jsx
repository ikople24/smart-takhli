// หน้าเล่มพิมพ์ — ไม่ใช้ LayoutAdmin เพราะ sidebar/nav จะติดไปในกระดาษ
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import PrintBook from "@/components/m10/print/PrintBook";

export default function M10PrintPage() {
  const router = useRouter();
  const { period, compact } = router.query;
  const [book, setBook] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const isCompact = compact === "1";

  useEffect(() => {
    if (!router.isReady) return;
    if (!period) { setError("ไม่ได้ระบุงวด (period)"); setLoading(false); return; }
    (async () => {
      setLoading(true); setError("");
      try {
        const res = await fetch(`/api/m10-ingest/print?period=${encodeURIComponent(period)}`);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "โหลดข้อมูลล้มเหลว");
        setBook(d);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [router.isReady, period]);

  function toggleCompact() {
    router.replace({ pathname: router.pathname, query: { period, ...(isCompact ? {} : { compact: "1" }) } });
  }

  return (
    <div className={isCompact ? "m10p-root m10p-compact" : "m10p-root"}>
      <div className="m10p-toolbar">
        <button className="btn btn-primary btn-sm" onClick={() => window.print()} disabled={!book}>
          พิมพ์
        </button>
        <button className="btn btn-sm" onClick={toggleCompact} disabled={!book}>
          {isCompact ? "กลับเป็น 1 รายการ/หน้า" : "ประหยัดกระดาษ (2 รายการ/หน้า)"}
        </button>
        <a className="btn btn-ghost btn-sm" href="/admin/m10?tab=summary">กลับหน้าสรุป</a>
        {book && (
          <span className="m10p-toolbar-info">
            {book.periodLabel} · {book.cover.totals.sheets} แผ่นงาน · {book.sections.length} หมวด
          </span>
        )}
      </div>

      {loading && <p className="m10p-msg">กำลังโหลด…</p>}
      {error && <p className="m10p-msg m10p-error">{error}</p>}
      {book && <PrintBook book={book} />}
    </div>
  );
}
