import { Fragment, useState } from 'react';
import { formatRange, formatThaiTime } from '@/lib/garbage/time';
import { KIND_LABEL_TH, weekdayName } from '@/lib/garbage/labels';
import { PillTabs, tableHeadCls, primaryBtnCls } from '@/components/ui/adminTheme';

/**
 * ตารางงานมอบหมายรายวัน — กดแถว (หรือปุ่มในคอลัมน์ "จุด") เพื่อกางดูจุดเก็บ
 * ไม่ส่ง onAdd/onEdit/onDelete มา = ใช้แบบอ่านอย่างเดียว (ปุ่มจัดการทั้งหมดหายไป)
 */
export default function WeekScheduleView({ days, activeDate, onChangeDate, onAdd, onEdit, onDelete }) {
  const [openKey, setOpenKey] = useState(null);
  const day = days.find((d) => d.date === activeDate) ?? days[0];
  const rows = day?.assignments ?? [];

  // ใช้ PillTabs กลางจาก components/ui/adminTheme — label รับ node ได้ จึงแนบป้าย "รอข้อมูล" ไปด้วย
  const tabs = days.map((d) => ({
    key: d.date,
    label: (
      <>
        {weekdayName(d.weekday)}
        {d.assignments.length === 0 && (
          <span className="ml-1 text-[10px] font-normal opacity-70">รอข้อมูล</span>
        )}
      </>
    ),
  }));

  return (
    <div className="space-y-3">
      <PillTabs
        tabs={tabs}
        active={activeDate}
        onChange={(date) => { onChangeDate(date); setOpenKey(null); }}
      />

      {/* ปุ่มเพิ่มอยู่นอกเงื่อนไข rows.length เพราะวันที่ยังไม่มีตารางเลยคือวันที่ต้องกดเพิ่มมากที่สุด */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-[12px] text-[#8A8398]">{day?.date} · {rows.length} รายการ</div>
        {onAdd && (
          <button type="button" className={primaryBtnCls} onClick={() => onAdd(day?.weekday)}>
            + เพิ่มงาน
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-center text-[13px] text-[#8A8398] py-10">
          วัน{weekdayName(day?.weekday ?? 0)}ยังไม่มีตารางในระบบ — รอข้อมูลจากกองสาธารณสุข
        </p>
      ) : (
        <div className="overflow-x-auto border border-[#E7E2F2] rounded-[16px]">
          <table className="text-[12px] w-full border-collapse">
            <thead>
              <tr className={tableHeadCls}>
                <th className="px-3 py-2 text-left border-b border-[#E7E2F2]">รถ</th>
                <th className="px-3 py-2 text-left border-b border-[#E7E2F2]">รอบ</th>
                <th className="px-3 py-2 text-left border-b border-[#E7E2F2]">สาย</th>
                <th className="px-3 py-2 text-left border-b border-[#E7E2F2]">ช่วงเวลา</th>
                <th className="px-3 py-2 text-right border-b border-[#E7E2F2]">จุด</th>
                {onEdit && <th className="px-3 py-2 text-right border-b border-[#E7E2F2]">จัดการ</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const key = `${a.truckNumber}-${a.shiftNo}`;
                const open = openKey === key;
                // นับเฉพาะจุดที่วันนั้นเก็บจริง — จุดที่เหลือของสายยังกางดูได้ในลิสต์ข้างล่าง
                const servedCount = a.stops.filter((s) => s.served).length;
                return (
                  // ต้องใช้ Fragment ที่มี key ไม่ใช่ <> เพราะ map คืนสองแถว — ไม่งั้น React เตือนเรื่อง key
                  <Fragment key={key}>
                    <tr onClick={() => setOpenKey(open ? null : key)}
                      className="cursor-pointer hover:bg-[#FAF8FF] border-b border-[#F1ECFB]">
                      <td className="px-3 py-2">
                        <span aria-hidden className={'inline-block h-2 w-2 rounded-full mr-1.5 ' +
                          (a.truckColor === 'yellow' ? 'bg-amber-400' : 'bg-emerald-500')} />
                        {a.truckNumber}
                      </td>
                      <td className="px-3 py-2">{a.shiftNo}</td>
                      <td className="px-3 py-2">
                        {a.routeCode ?? '—'}
                        {KIND_LABEL_TH[a.kind] && (
                          <span className="ml-1.5 inline-block text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#EDE7FD] text-[#6D28D9]">
                            {KIND_LABEL_TH[a.kind]}{a.coverForRouteCode ? ` ${a.coverForRouteCode}` : ''}
                          </span>
                        )}
                        {a.routeNeedsVerification && (
                          <span className="ml-1.5 inline-block text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            รอตรวจสอบ
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatRange(a.startMin, a.endMin) || '—'}</td>
                      <td className="px-3 py-2 text-right">
                        {a.stops.length === 0 ? (
                          <span className="text-[#8A8398]">0</span>
                        ) : (
                          // ปุ่มนี้คือตัวควบคุมจริงของการกาง (คีย์บอร์ดโฟกัสได้/Enter ได้)
                          // stopPropagation กัน onClick ของแถวสลับซ้ำจนกลับมาปิดเอง
                          <button
                            type="button"
                            aria-expanded={open}
                            aria-controls={`garbage-stops-${key}`}
                            onClick={(e) => { e.stopPropagation(); setOpenKey(open ? null : key); }}
                            className="inline-flex items-center gap-1 font-semibold text-[#6D28D9] rounded-[8px] px-2 py-1
                              hover:bg-[#EDE7FD] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
                          >
                            {servedCount}
                            <span aria-hidden className="text-[10px]">{open ? '▲' : '▼'}</span>
                            <span className="sr-only">
                              จุดที่เก็บวันนี้ จากทั้งหมด {a.stops.length} จุดของสาย —{' '}
                              {open ? 'ซ่อนรายการจุด' : 'ดูรายการจุด'}
                            </span>
                          </button>
                        )}
                      </td>
                      {onEdit && (
                        // stopPropagation จำเป็น — ทั้งแถวมี onClick กางรายการจุด กดปุ่มแล้วจะกางไปด้วย
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button type="button" className="px-2 text-[#6D28D9]"
                            aria-label={`แก้งานรถ ${a.truckNumber} รอบ ${a.shiftNo}`}
                            onClick={(e) => { e.stopPropagation(); onEdit(a); }}>แก้</button>
                          <button type="button" className="px-2 text-red-500"
                            aria-label={`ลบงานรถ ${a.truckNumber} รอบ ${a.shiftNo}`}
                            onClick={(e) => { e.stopPropagation(); onDelete(a); }}>ลบ</button>
                        </td>
                      )}
                    </tr>
                    {open && a.stops.length > 0 && (
                      <tr id={`garbage-stops-${key}`} className="bg-[#FAF8FF] border-b border-[#F1ECFB]">
                        <td colSpan={onEdit ? 6 : 5} className="px-3 py-2">
                          <ol className="space-y-0.5">
                            {a.stops.map((s) => (
                              <li key={s.seq} className="flex gap-2 text-[12px]">
                                <span className="text-[#8A8398] w-6 text-right">{s.seq}.</span>
                                <span className="flex-1">{s.name}</span>
                                {s.mode === 'walk' && <span className="text-[10.5px] text-[#8A8398]">เดินเก็บ</span>}
                                {s.served
                                  ? <span className="text-[#57506A] whitespace-nowrap">{formatThaiTime(s.atMin) || 'ยังไม่ระบุเวลา'}</span>
                                  : <span className="text-[#B9B3C7] whitespace-nowrap">ไม่เก็บวันนี้</span>}
                              </li>
                            ))}
                          </ol>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
