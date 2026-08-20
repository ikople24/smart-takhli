// รายงานความยาวท่อประปา — สรุปตามชนิด/ถนน/ปี/สถานะ (หน้าลูกของ /admin/smart-water)
import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import PermissionGuard from "@/components/PermissionGuard";
import { DashboardHeader } from "@/components/ui/adminTheme";
import { pipeStatusLabel } from '@/lib/smart-water/labels';

const GROUPS = [
  { key: "material", label: "ชนิด/ขนาดท่อ" },
  { key: "road", label: "ถนน" },
  { key: "year", label: "ปีที่วาง" },
  { key: "status", label: "สถานะ" },
];

function labelOf(g) {
  if (g.code) {
    const unit = g.unit === "inch" ? '"' : ` ${g.unit}`;
    return `${g.material} Ø${g.diameterValue}${unit}  (${g.code})`;
  }
  if (g.roadName !== undefined) return g.roadName || "ไม่ระบุถนน";
  if (g.installedYear !== undefined)
    return g.installedYear ? `พ.ศ. ${g.installedYear}` : "ไม่ระบุปี";
  if (g.status !== undefined) return pipeStatusLabel(g.status);
  return "-";
}

export default function SmartWaterReportPage() {
  const [groupBy, setGroupBy] = useState("material");
  const [includeAbandoned, setIncludeAbandoned] = useState(false);
  const [rows, setRows] = useState([]);
  const [totalM, setTotalM] = useState(0);
  const [totalKm, setTotalKm] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch(
      `/api/smart-water/reports/length?groupBy=${groupBy}&includeAbandoned=${includeAbandoned}`
    )
      .then(async (r) => {
        // อ่าน body เสมอ — endpoint คืน { success:false, message } ที่เป็นภาษาไทยและมีประโยชน์กว่าข้อความรวม
        const d = await r.json().catch(() => null);
        if (!r.ok || !d?.success) {
          throw new Error(d?.message || 'โหลดรายงานไม่สำเร็จ');
        }
        return d;
      })
      .then((d) => {
        if (cancelled) return;
        setRows(d.rows);
        setTotalM(d.grandTotalM);
        setTotalKm(d.grandTotalKm);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('[smart-water/report]', e);
        // ข้อความจากเซิร์ฟเวอร์เป็นไทยอยู่แล้ว ส่วน error ของเบราว์เซอร์ (Failed to fetch) เป็นอังกฤษ
        setError(
          e instanceof TypeError
            ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'
            : e.message || 'โหลดรายงานไม่สำเร็จ'
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupBy, includeAbandoned]);

  return (
    <PermissionGuard requiredPath="/admin/smart-water">
      <Head>
        <title>รายงานความยาวท่อ | Smart Takhli</title>
      </Head>
      <div className="mx-auto max-w-4xl p-6">
        <DashboardHeader
          icon="🚰"
          title="รายงานความยาวท่อประปา"
          subtitle="เทศบาลเมืองตาคลี · กองการประปา"
          right={
            <Link
              href="/admin/smart-water"
              className="rounded-md border px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              ← กลับไปแผนที่
            </Link>
          }
        />

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {GROUPS.map((g) => (
              <button
                key={g.key}
                onClick={() => setGroupBy(g.key)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  groupBy === g.key
                    ? "bg-white font-medium text-teal-700 shadow-sm"
                    : "text-slate-600"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={includeAbandoned}
              onChange={(e) => setIncludeAbandoned(e.target.checked)}
            />
            รวมท่อที่ยกเลิกใช้งาน
          </label>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        {loading && <div className="py-8 text-center text-slate-400">กำลังโหลด...</div>}

        {!loading && !error && (
          <>
            <div className="mb-3 rounded-lg bg-teal-50 p-4">
              <div className="text-xs text-teal-700">
                {includeAbandoned
                  ? 'ความยาวรวมทั้งหมด (รวมท่อที่ยกเลิกใช้งาน)'
                  : 'ความยาวรวม (ไม่รวมท่อที่ยกเลิกใช้งาน)'}
              </div>
              <div className="text-2xl font-semibold text-teal-800">
                {totalM.toLocaleString('th-TH', { maximumFractionDigits: 2 })} ม.
                <span className="ml-2 text-base font-normal">
                  (
                  {totalKm.toLocaleString('th-TH', {
                    minimumFractionDigits: 3,
                    maximumFractionDigits: 3,
                  })}{' '}
                  กม.)
                </span>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2">รายการ</th>
                  <th className="py-2 text-right">จำนวนเส้น</th>
                  <th className="py-2 text-right">ความยาว (ม.)</th>
                  <th className="py-2 text-right">กม.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 text-slate-800">{labelOf(r.group)}</td>
                    <td className="py-2 text-right text-slate-600">{r.count}</td>
                    <td className="py-2 text-right font-medium text-slate-800">
                      {r.totalM.toLocaleString("th-TH", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 text-right text-slate-500">
                      {r.totalKm.toLocaleString('th-TH', {
                        minimumFractionDigits: 3,
                        maximumFractionDigits: 3,
                      })}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      ไม่มีข้อมูลท่อตามเงื่อนไขนี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <p className="mt-4 text-xs text-slate-400">
              หมายเหตุ: ความยาวคำนวณจากระยะราบบนแผนที่ (UTM zone 47N)
              ไม่รวมความยาวส่วนเพิ่มจากข้องอและความลึกของท่อ
              ท่อจริงมักยาวกว่าค่านี้ประมาณ 2–5%
              แผนที่แสดงท่อที่ยกเลิกใช้งานแบบจาง แต่รายงานนี้ไม่นับรวมจนกว่าจะติ๊กช่องด้านบน
            </p>
          </>
        )}
      </div>
    </PermissionGuard>
  );
}
