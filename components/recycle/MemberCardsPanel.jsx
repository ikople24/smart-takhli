// แท็บ "บัตร QR" — สร้างและพิมพ์บัตรสมาชิก (แบบเดียวกับ /admin/elderly-cards)
// QR ฝังลิงก์ /recycle/m/<publicToken> → เจ้าหน้าที่ (ล็อกอิน) สแกนแล้วเปิดหน้ากรอกน้ำหนัก
// สมาชิกสแกนเองเห็นยอดคงเหลือ/ประวัติของตัวเอง
import { useCallback, useEffect, useMemo, useState } from "react";
import { COMMUNITIES } from "@/lib/takhliCommunities";
import { makeMemberCardUrl, recycleFetch } from "@/lib/recycle/client";
import { DISPLAY, ICON, Icon } from "@/lib/recycle/theme";

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

      <p className="text-xs text-[#51605A] print:hidden">
        ขนาดจริงบัตร 85.6 × 54 มม. (เท่าบัตรประชาชน) — พิมพ์หน้า-หลังคู่กัน ตัดแล้วพับหรือเคลือบประกบ
      </p>
      <div className="flex flex-col gap-4 print:gap-[4mm]">
        {members.map((m) => {
          const qr = qrMap[m.code];
          return (
            <div key={m._id} className="flex flex-wrap gap-3 print:gap-0 break-inside-avoid">
              {/* ด้านหน้า */}
              <div className="card-face isolate relative overflow-hidden rounded-[4mm] bg-[#146C43] text-white flex flex-col" style={{ width: "85.6mm", height: "54mm", padding: "5mm 5.5mm" }}>
                <div className="absolute -z-10 rounded-full bg-[#1B7C4F]" style={{ width: "48mm", height: "48mm", right: "-12mm", bottom: "-16mm" }} />
                <div className="absolute -z-10 rounded-full bg-[#22895A]" style={{ width: "20mm", height: "20mm", right: "14mm", bottom: "11mm" }} />
                <div className="flex items-center gap-[2mm]">
                  <span className="rounded-[2.4mm] bg-white text-[#146C43] flex items-center justify-center" style={{ width: "8mm", height: "8mm" }}>
                    <Icon d={ICON.leaf} size={18} strokeWidth={1.9} />
                  </span>
                  <span>
                    <span className={`${DISPLAY} block font-semibold leading-tight`} style={{ fontSize: "4mm" }}>พระสังข์หอบทอง</span>
                    <span className="block text-[#CFE6D8]" style={{ fontSize: "2.3mm" }}>ธนาคารขยะรีไซเคิล · เทศบาลเมืองตาคลี</span>
                  </span>
                </div>
                <div className="flex-1" />
                <span className="text-[#CFE6D8]" style={{ fontSize: "2.5mm" }}>ชื่อสมาชิก</span>
                <span className={`${DISPLAY} font-semibold leading-tight line-clamp-1`} style={{ fontSize: "5.2mm" }}>{m.fullName}</span>
                <span className={`${DISPLAY} font-medium text-[#F4B740]`} style={{ fontSize: "4.4mm", letterSpacing: "0.6mm" }}>{m.code}</span>
              </div>
              {/* ด้านหลัง */}
              <div className="card-face rounded-[4mm] bg-white border border-[#E4E0D4] flex items-center" style={{ width: "85.6mm", height: "54mm", padding: "4.5mm 5mm", gap: "4.5mm" }}>
                <div className="rounded-[3mm] border-2 border-[#E4E0D4] flex items-center justify-center shrink-0 overflow-hidden" style={{ width: "40mm", height: "40mm" }}>
                  {qr ? (
                    <img src={qr} alt={`QR ${m.code}`} style={{ width: "36mm", height: "36mm" }} />
                  ) : (
                    <span className="text-[11px] text-[#51605A] text-center px-2 print:hidden">กด “สร้าง QR ทั้งหมด”</span>
                  )}
                </div>
                <div className="flex flex-col" style={{ gap: "2mm" }}>
                  <span className={`${DISPLAY} font-semibold text-[#146C43] leading-snug`} style={{ fontSize: "3.6mm" }}>
                    สแกนเพื่อดู
                    <br />
                    ยอดสะสมของคุณ
                  </span>
                  <span className="text-[#51605A] leading-snug" style={{ fontSize: "2.5mm" }}>
                    นำบัตรนี้มาทุกครั้งที่ฝากขยะหรือแลกของ ที่จุดรับของโครงการ
                  </span>
                  <span className={`${DISPLAY} text-[#17251C]`} style={{ fontSize: "3mm", letterSpacing: "0.4mm" }}>{m.code}</span>
                </div>
              </div>
            </div>
          );
        })}
        {!loading && members.length === 0 && <div className="py-8 text-center text-sm text-[#51605A]">ยังไม่มีสมาชิก</div>}
      </div>
      <style jsx>{`
        .card-face {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      `}</style>
    </div>
  );
}
