// components/smart-waste/admin/SummaryDashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { WASTE_GROUPS } from '@/lib/smart-waste/wasteGroups';
import { FIRST_FISCAL_YEAR } from '@/lib/smart-waste/uiDate';
import {
  StatCard, ghostBtnCls, tableHeadCls, formatKg,
  WASTE_GROUP_COLORS, YEAR_LINE_COLORS,
} from '../wasteTheme';

const kgTip = (value) => `${formatKg(value)} กก.`;

// แท็บสรุปต่อปีงบ — ดึง summary ปีที่เลือก + ปีก่อนหน้า (เส้นเทียบปีต่อปี)
export default function SummaryDashboard({ fiscalYear, refreshTick }) {
  const [summary, setSummary] = useState(null);
  const [prevSummary, setPrevSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const myId = ++reqIdRef.current;
    const load = async () => {
      setLoading(true);
      try {
        const fetchYear = async (year) => {
          const res = await fetch(`/api/smart-waste/summary?fiscalYear=${year}`);
          if (!res.ok) throw new Error((await res.json()).message || 'โหลดสรุปไม่สำเร็จ');
          return res.json();
        };
        const hasPrev = fiscalYear - 1 >= FIRST_FISCAL_YEAR;
        const [current, previous] = await Promise.all([
          fetchYear(fiscalYear),
          hasPrev ? fetchYear(fiscalYear - 1) : Promise.resolve(null),
        ]);
        if (myId !== reqIdRef.current) return;
        setSummary(current);
        setPrevSummary(previous);
      } catch (error) {
        if (myId === reqIdRef.current) {
          Swal.fire({ icon: 'error', title: 'โหลดสรุปไม่สำเร็จ', text: error.message });
        }
      } finally {
        if (myId === reqIdRef.current) setLoading(false);
      }
    };
    load();
  }, [fiscalYear, refreshTick]);

  const stackedData = useMemo(
    () => (summary?.months || []).map((m) => ({ label: m.label, ...m.groupTotals })),
    [summary]
  );
  const compareData = useMemo(
    () => (summary?.months || []).map((m, i) => ({
      label: m.label,
      current: m.totalKg,
      previous: prevSummary?.months?.[i]?.totalKg ?? 0,
    })),
    [summary, prevSummary]
  );
  const donutData = useMemo(
    () => WASTE_GROUPS
      .map((g) => ({ ...g, value: summary?.groupTotals?.[g.key] || 0 }))
      .filter((g) => g.value > 0),
    [summary]
  );
  const latestMonth = useMemo(
    () => [...(summary?.months || [])].reverse().find((m) => m.recordedDays > 0),
    [summary]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }
  if (!summary) return null;

  const exportBtn = (
    <a href={`/api/smart-waste/export?fiscalYear=${fiscalYear}`} className={ghostBtnCls + ' !py-2.5'}>
      ⬇️ ดาวน์โหลด Excel
    </a>
  );

  // ปีที่ยังไม่มีข้อมูล — empty state ไม่ error (สเปกข้อ 11) แต่ export ได้ (ไฟล์โครงเปล่า)
  if (summary.recordedDays === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-[13px] text-[#8A8398]">ยังไม่มีข้อมูลในปีงบ {fiscalYear}</p>
        {exportBtn}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── StatCards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard value={formatKg(summary.totalKg)} label={`รวมปีงบ ${fiscalYear} (กก.)`} tone="purple" />
        <StatCard value={formatKg(summary.avgKgPerRecordedDay)} label="เฉลี่ยต่อวันที่บันทึก (กก.)" />
        <StatCard value={latestMonth ? formatKg(latestMonth.totalKg) : '—'}
          label={`เดือนล่าสุด${latestMonth ? ` (${latestMonth.label})` : ''} (กก.)`} tone="deep" />
        <StatCard value={`${summary.recordedDays}`} label={`วันที่บันทึกแล้ว (จาก ${summary.totalDays} วัน)`} />
        {/* + 1 ใบต่อประเภทที่ติดธง isHighlighted (เริ่มต้น = ถุงอ่อน) — สเปกข้อ 2.4 */}
        {summary.highlightedTypes.map((type) => (
          <StatCard key={type.key} value={formatKg(type.totalKg)}
            label={`เฉพาะ${type.label} (กก.)`} tone="green" />
        ))}
      </div>

      <div className="flex justify-end">{exportBtn}</div>

      {/* ── แท่งซ้อน 8 กลุ่ม × 12 เดือน ── */}
      <div>
        <p className="text-[13px] font-bold text-[#57506A] mb-2">น้ำหนักรายเดือนแยก 8 กลุ่ม</p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={stackedData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEE9F8" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#E7E2F2' }} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={52} />
            <Tooltip formatter={(value, name) => [kgTip(value), name]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {WASTE_GROUPS.map((group) => (
              /* stroke สีพื้น 1px = ช่องไฟระหว่างชั้น stack (กติกา mark ของ dataviz) */
              <Bar key={group.key} dataKey={group.key} name={group.label} stackId="kg"
                fill={WASTE_GROUP_COLORS[group.key]} stroke="#FAF8FF" strokeWidth={1} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── ตาราง relief — บังคับโดยผล validator (3 สี contrast < 3:1) ห้ามตัดออก ── */}
      <details className="border border-[#E7E2F2] rounded-[16px] px-4 py-3">
        <summary className="text-[13px] font-bold text-[#57506A] cursor-pointer select-none">
          ตารางยอดรายเดือน 8 กลุ่ม (กก.)
        </summary>
        <div className="overflow-x-auto mt-3">
          <table className="text-[12px] whitespace-nowrap min-w-full">
            <thead>
              <tr className={tableHeadCls}>
                <th className="px-2.5 py-1.5 text-left">เดือน</th>
                {WASTE_GROUPS.map((g) => (
                  <th key={g.key} className="px-2.5 py-1.5 text-right">{g.label}</th>
                ))}
                <th className="px-2.5 py-1.5 text-right">รวม</th>
              </tr>
            </thead>
            <tbody>
              {summary.months.map((m) => (
                <tr key={m.key} className="border-b border-[#F1ECFB]">
                  <td className="px-2.5 py-1.5 font-semibold">{m.label}</td>
                  {WASTE_GROUPS.map((g) => (
                    <td key={g.key} className="px-2.5 py-1.5 text-right">
                      {m.groupTotals[g.key] ? formatKg(m.groupTotals[g.key]) : ''}
                    </td>
                  ))}
                  <td className="px-2.5 py-1.5 text-right font-bold">{formatKg(m.totalKg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {/* ── เส้นเทียบปีงบต่อปีงบ — ข้ามเมื่อปีก่อนไม่มีข้อมูล ── */}
      {prevSummary && prevSummary.recordedDays > 0 && (
        <div>
          <p className="text-[13px] font-bold text-[#57506A] mb-2">
            เทียบรายเดือน: ปีงบ {fiscalYear} กับ {fiscalYear - 1}
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={compareData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEE9F8" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#E7E2F2' }} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={52} />
              <Tooltip formatter={(value, name) => [kgTip(value), name]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="current" name={`ปีงบ ${fiscalYear}`}
                stroke={YEAR_LINE_COLORS.current} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="previous" name={`ปีงบ ${fiscalYear - 1}`}
                stroke={YEAR_LINE_COLORS.previous} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── โดนัทสัดส่วน 8 กลุ่มทั้งปี ── */}
      <div>
        <p className="text-[13px] font-bold text-[#57506A] mb-2">สัดส่วนทั้งปีงบแยกกลุ่ม</p>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <ResponsiveContainer width="100%" height={240} className="sm:max-w-[260px]">
            <PieChart>
              <Pie data={donutData} dataKey="value" nameKey="label"
                innerRadius={62} outerRadius={92} paddingAngle={1}
                stroke="#FFFFFF" strokeWidth={2}>
                {donutData.map((g) => (
                  <Cell key={g.key} fill={WASTE_GROUP_COLORS[g.key]} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [kgTip(value), name]} />
            </PieChart>
          </ResponsiveContainer>
          {/* legend + ค่าตรง ๆ = direct label relief ของโดนัท */}
          <ul className="text-[12.5px] space-y-1.5 w-full sm:w-auto">
            {donutData.map((g) => (
              <li key={g.key} className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-[4px]"
                  style={{ background: WASTE_GROUP_COLORS[g.key] }} />
                <span className="text-[#57506A] flex-1">{g.label}</span>
                <span className="font-bold text-[#211B2E]">{formatKg(g.value)} กก.</span>
                <span className="text-[#8A8398] w-14 text-right">
                  {summary.totalKg ? `${((g.value / summary.totalKg) * 100).toFixed(1)}%` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
