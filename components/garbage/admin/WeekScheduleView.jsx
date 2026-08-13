import { Fragment, useState } from 'react';
import { formatRange, formatThaiTime } from '@/lib/garbage/time';
import { KIND_LABEL_TH, weekdayName } from '@/lib/garbage/labels';
import { tableHeadCls } from '@/components/ui/adminTheme';

/** ตารางงานมอบหมายรายวัน — อ่านอย่างเดียว คลิกแถวเพื่อกางดูจุดเก็บ */
export default function WeekScheduleView({ days, activeDate, onChangeDate }) {
  const [openKey, setOpenKey] = useState(null);
  const day = days.find((d) => d.date === activeDate) ?? days[0];
  const rows = day?.assignments ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 bg-[#F1ECFB] p-1.5 rounded-[14px]">
        {days.map((d) => {
          const on = d.date === activeDate;
          const empty = d.assignments.length === 0;
          return (
            <button key={d.date} type="button" onClick={() => { onChangeDate(d.date); setOpenKey(null); }}
              className={'text-[13px] px-3 py-2 rounded-[10px] font-semibold transition ' +
                (on ? 'bg-white text-[#7C3AED] shadow-[0_2px_6px_-2px_rgba(124,58,237,0.3)]'
                    : 'text-[#8A8398] hover:text-[#6D28D9]')}>
              {weekdayName(d.weekday)}
              {empty && <span className="ml-1 text-[10px] font-normal opacity-70">รอข้อมูล</span>}
            </button>
          );
        })}
      </div>

      <div className="text-[12px] text-[#8A8398]">{day?.date} · {rows.length} รายการ</div>

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
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const key = `${a.truckNumber}-${a.shiftNo}`;
                const open = openKey === key;
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
                      <td className="px-3 py-2 text-right">{a.stops.length}</td>
                    </tr>
                    {open && a.stops.length > 0 && (
                      <tr className="bg-[#FAF8FF] border-b border-[#F1ECFB]">
                        <td colSpan={5} className="px-3 py-2">
                          <ol className="space-y-0.5">
                            {a.stops.map((s) => (
                              <li key={s.seq} className="flex gap-2 text-[12px]">
                                <span className="text-[#8A8398] w-6 text-right">{s.seq}.</span>
                                <span className="flex-1">{s.name}</span>
                                {s.mode === 'walk' && <span className="text-[10.5px] text-[#8A8398]">เดินเก็บ</span>}
                                <span className="text-[#57506A] whitespace-nowrap">{formatThaiTime(s.atMin) || '—'}</span>
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
