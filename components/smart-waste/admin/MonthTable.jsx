// components/smart-waste/admin/MonthTable.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { fiscalMonths, bangkokToday } from '@/lib/smart-waste/fiscalYear';
import { round2 } from '@/lib/smart-waste/aggregate';
import { WASTE_GROUPS, wasteGroupLabel } from '@/lib/smart-waste/wasteGroups';
import { chipCls, tableHeadCls, formatKg } from '../wasteTheme';

// ตาราง/การ์ดข้อมูลรายเดือน — คอลัมน์คือ "ทุกประเภท" ตาม order (รวม inactive
// เพราะข้อมูลย้อนหลังอาจอ้างประเภทที่ปิดไปแล้ว — สเปกข้อ 11)
export default function MonthTable({ fiscalYear, types, onEditDate, refreshTick }) {
  const months = useMemo(() => fiscalMonths(fiscalYear), [fiscalYear]);
  const today = bangkokToday();
  const currentMonthKey = today.slice(0, 7);

  const [monthKey, setMonthKey] = useState(
    months.some((m) => m.key === currentMonthKey) ? currentMonthKey : months[0].key
  );
  // มือถือ default การ์ด / จอใหญ่ default ตาราง (สเปกข้อ 7.3)
  const [view, setView] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 'cards' : 'table'
  );
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const reqIdRef = useRef(0);

  // เปลี่ยนปีงบ → เดือนเดิมอาจไม่อยู่ในปีใหม่
  useEffect(() => {
    if (!months.some((m) => m.key === monthKey)) setMonthKey(months[0].key);
  }, [months, monthKey]);

  const month = months.find((m) => m.key === monthKey) || months[0];

  const fetchMonth = useCallback(async () => {
    const myId = ++reqIdRef.current;
    setLoading(true);
    try {
      const from = `${month.key}-01`;
      const to = `${month.key}-${String(month.daysInMonth).padStart(2, '0')}`;
      const res = await fetch(`/api/smart-waste/daily?from=${from}&to=${to}`);
      if (!res.ok) throw new Error((await res.json()).message || 'โหลดข้อมูลไม่สำเร็จ');
      const json = await res.json();
      if (myId === reqIdRef.current) setRecords(json.records);
    } catch (error) {
      if (myId === reqIdRef.current) {
        Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: error.message });
      }
    } finally {
      if (myId === reqIdRef.current) setLoading(false);
    }
  }, [month.key, month.daysInMonth]);

  // refreshTick มาจากหน้าแม่ — บันทึกในแท็บฟอร์มแล้วข้อมูลที่นี่ต้องสด
  useEffect(() => { fetchMonth(); }, [fetchMonth, refreshTick]);

  // ยอดรวมเดือนต่อประเภท (แถวท้ายตาราง) — บวกจาก entries ชุดเดียวกับที่แสดง
  const columnTotals = useMemo(() => {
    const totals = {};
    let grand = 0;
    for (const record of records) {
      for (const entry of record.entries) {
        totals[entry.typeKey] = round2((totals[entry.typeKey] || 0) + entry.kg);
      }
      grand = round2(grand + record.totalKg);
    }
    return { totals, grand };
  }, [records]);

  return (
    <div>
      {/* pill 12 เดือนของปีงบ */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
        {months.map((m) => (
          <button key={m.key} type="button" onClick={() => setMonthKey(m.key)}
            className={chipCls(m.key === monthKey) + ' shrink-0'}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mt-2 mb-3">
        <p className="text-[13px] font-bold text-[#57506A]">
          {month.label} · บันทึกแล้ว {records.length} วัน · รวม {formatKg(columnTotals.grand)} กก.
        </p>
        <div className="flex gap-1.5">
          <button type="button" className={chipCls(view === 'cards')} onClick={() => setView('cards')}>การ์ด</button>
          <button type="button" className={chipCls(view === 'table')} onClick={() => setView('table')}>ตาราง</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : records.length === 0 ? (
        <p className="text-center text-[13px] text-[#8A8398] py-10">
          ยังไม่มีข้อมูลใน {month.label} — กรอกได้ที่แท็บ "บันทึก"
        </p>
      ) : view === 'cards' ? (
        /* ── การ์ดต่อวัน (มือถือ) — แตะเพื่อแก้ ── */
        <div className="space-y-2">
          {records.map((record) => {
            const topGroups = WASTE_GROUPS
              .map((g) => ({ ...g, kg: record.groupTotals?.[g.key] || 0 }))
              .filter((g) => g.kg > 0)
              .sort((a, b) => b.kg - a.kg)
              .slice(0, 3);
            return (
              <button key={record.recordDate} type="button"
                onClick={() => onEditDate(record.recordDate)}
                className="w-full text-left bg-white border border-[#E7E2F2] rounded-[16px] p-3.5
                  hover:border-[#7C3AED] transition">
                <div className="flex items-baseline justify-between">
                  <span className="text-[14px] font-bold text-[#211B2E]">
                    {Number(record.recordDate.slice(8, 10))} {month.label}
                  </span>
                  <span className="text-[15px] font-bold text-[#7C3AED]">{formatKg(record.totalKg)} กก.</span>
                </div>
                <div className="text-[11.5px] text-[#8A8398] mt-1">
                  {topGroups.map((g) => `${g.label} ${formatKg(g.kg)}`).join(' · ') || '—'}
                  {record.note ? ` · 📝 ${record.note}` : ''}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        /* ── ตารางเหมือน Excel เดิม — คอลัมน์วันที่ sticky ── */
        <div className="overflow-x-auto border border-[#E7E2F2] rounded-[16px]">
          <table className="text-[12px] whitespace-nowrap border-collapse min-w-full">
            <thead>
              <tr className={tableHeadCls}>
                <th className="sticky left-0 z-10 bg-[#F6F3FD] px-3 py-2 text-left border-b border-[#E7E2F2]">วันที่</th>
                {types.map((type) => (
                  <th key={type.key} title={wasteGroupLabel(type.group)}
                    className="px-2.5 py-2 text-right border-b border-[#E7E2F2] font-semibold">
                    {type.label}{type.active ? '' : ' (ปิด)'}
                  </th>
                ))}
                <th className="px-3 py-2 text-right border-b border-[#E7E2F2]">รวม</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const kgByKey = Object.fromEntries(record.entries.map((e) => [e.typeKey, e.kg]));
                return (
                  <tr key={record.recordDate} className="hover:bg-[#FAF8FF] cursor-pointer"
                    onClick={() => onEditDate(record.recordDate)}
                    title="แตะเพื่อแก้ไขวันนี้">
                    <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-semibold border-b border-[#F1ECFB]">
                      {Number(record.recordDate.slice(8, 10))}
                    </td>
                    {types.map((type) => (
                      <td key={type.key} className="px-2.5 py-1.5 text-right border-b border-[#F1ECFB]">
                        {kgByKey[type.key] ? formatKg(kgByKey[type.key]) : ''}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right font-bold border-b border-[#F1ECFB]">
                      {formatKg(record.totalKg)}
                    </td>
                  </tr>
                );
              })}
              {/* แถวท้าย = ยอดรวมเดือน (สเปกข้อ 7.3) */}
              <tr className="bg-[#F6F3FD] font-bold">
                <td className="sticky left-0 z-10 bg-[#F6F3FD] px-3 py-2">รวม</td>
                {types.map((type) => (
                  <td key={type.key} className="px-2.5 py-2 text-right">
                    {columnTotals.totals[type.key] ? formatKg(columnTotals.totals[type.key]) : ''}
                  </td>
                ))}
                <td className="px-3 py-2 text-right text-[#7C3AED]">{formatKg(columnTotals.grand)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
