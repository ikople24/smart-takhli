// แท็บ "บัตร QR" — สร้างและพิมพ์บัตรสมาชิก (แบบเดียวกับ /admin/elderly-cards)
// QR ฝังลิงก์ /recycle/m/<publicToken> → เจ้าหน้าที่ (ล็อกอิน) สแกนแล้วเปิดหน้ากรอกน้ำหนัก
// สมาชิกสแกนเองเห็นยอดคงเหลือ/ประวัติของตัวเอง
import { useCallback, useEffect, useMemo, useState } from "react";
import { COMMUNITIES } from "@/lib/takhliCommunities";
import { makeMemberCardUrl, recycleFetch } from "@/lib/recycle/client";

export default function MemberCardsPanel() {
  const [community, setCommunity] = useState("");
  const [members, setMembers] = useState([]);
  const [qrMap, setQrMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const origin = useMemo(
    () => (typeof window !== "undefined" ? process.env.NEXT_PUBLIC_SITE_ORIGIN || window.location.origin : ""),
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ community, active: "true", limit: "1000" });
      const json = await recycleFetch(`/members?${qs.toString()}`);
      setMembers(json.members);
      setQrMap({});
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [community]);

  useEffect(() => {
    load();
  }, [load]);

  const generateAll = async () => {
    if (!origin) return;
    setLoading(true);
    setError("");
    try {
      const QRCode = (await import("qrcode")).default;
      const entries = await Promise.all(
        members
          .filter((m) => m.publicToken)
          .map(async (m) => [m.code, await QRCode.toDataURL(makeMemberCardUrl(origin, m.publicToken), { margin: 1, width: 220 })])
      );
      setQrMap(Object.fromEntries(entries));
    } catch (e) {
      setError(e?.message || "สร้าง QR ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-white ring-1 ring-gray-200/60 shadow-sm p-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 print:hidden">
        <div>
          <p className="text-base font-semibold text-gray-900">พิมพ์บัตรสมาชิก QR</p>
          <p className="text-xs text-gray-500 mt-1">เจ้าหน้าที่ (ล็อกอิน) สแกน → กรอกน้ำหนัก • สมาชิกสแกนเอง → ดูยอดคงเหลือและประวัติ</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="card-community">
            ชุมชน
          </label>
          <select
            id="card-community"
            value={community}
            onChange={(e) => setCommunity(e.target.value)}
            className="h-11 px-3 text-sm rounded-xl border border-gray-200 bg-white"
          >
            <option value="">ทุกชุมชน</option>
            {COMMUNITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={generateAll}
            disabled={loading || members.length === 0}
            className="h-11 px-4 text-sm rounded-xl bg-emerald-700 text-white font-semibold hover:bg-emerald-800 disabled:opacity-50"
          >
            {loading ? "กำลังสร้าง..." : "สร้าง QR ทั้งหมด"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={loading || Object.keys(qrMap).length === 0}
            className="h-11 px-4 text-sm rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            พิมพ์
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-3xl bg-amber-50/80 ring-1 ring-amber-200 p-4 text-sm text-amber-800 print:hidden" role="alert">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 print:grid-cols-3">
        {members.map((m) => {
          const qr = qrMap[m.code];
          return (
            <div key={m._id} className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-3 break-inside-avoid flex flex-col items-center">
              <p className="text-xs font-bold text-emerald-800 text-center">บัตรสมาชิก • พระสังข์หอบทอง</p>
              <div className="mt-2 w-full aspect-square rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden">
                {qr ? (
                  <img src={qr} alt={`QR ${m.code}`} className="w-full h-full object-contain" />
                ) : (
                  <span className="text-[11px] text-gray-500 text-center px-2">กด “สร้าง QR ทั้งหมด”</span>
                )}
              </div>
              <p className="mt-2 text-base font-semibold text-gray-900 text-center line-clamp-2">{m.fullName}</p>
              <p className="text-base font-mono tracking-widest text-gray-600">{m.code}</p>
            </div>
          );
        })}
        {!loading && members.length === 0 && (
          <div className="col-span-full py-8 text-center text-sm text-gray-500">ยังไม่มีสมาชิก</div>
        )}
      </div>
    </div>
  );
}
