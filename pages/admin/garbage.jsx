import { useCallback, useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import PermissionGuard from '@/components/PermissionGuard';
import WeekScheduleView from '@/components/garbage/admin/WeekScheduleView';
import ContactSettingsCard from '@/components/garbage/admin/ContactSettingsCard';
import { DashboardHeader, cardCls, primaryBtnCls } from '@/components/ui/adminTheme';

// ตารางเดินรถเก็บขยะ — อ่านอย่างเดียวรอบนี้ (แก้ตารางยังทำผ่าน data/garbage/schedule-seed.json + scripts/seed-garbage.mjs)
export default function AdminGarbagePage() {
  const [days, setDays] = useState(null);
  const [activeDate, setActiveDate] = useState(null);
  const [error, setError] = useState('');
  const mountedRef = useRef(true);

  // ต้องเซ็ต true ใน effect body ด้วย ไม่ใช่แค่ false ใน cleanup —
  // StrictMode โหมด dev จะ mount→unmount→mount ถ้าไม่เซ็ตกลับจะค้างเป็น false แล้ว setState ตายเงียบทั้งหมด
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchWeek = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/garbage/week');
      const json = await res.json();
      // API ชุดนี้คืน { error } ไม่ใช่ { success, message }
      if (!res.ok) throw new Error(json?.error || 'โหลดตารางไม่สำเร็จ');
      if (!mountedRef.current) return;
      setDays(json.days);
      // เปิดที่วันที่มีข้อมูลวันแรก ถ้าไม่มีเลยเปิดวันอาทิตย์
      const firstWithData = json.days.find((d) => d.assignments.length > 0);
      setActiveDate((firstWithData ?? json.days[0]).date);
    } catch (err) {
      if (!mountedRef.current) return;
      // ต้องเซ็ต error ด้วย ไม่งั้น days ค้างเป็น null แล้ว spinner หมุนไม่จบหลังปิด Swal
      setError(err.message || 'โหลดตารางไม่สำเร็จ');
      Swal.fire({ icon: 'error', title: 'โหลดตารางไม่สำเร็จ', text: err.message });
    }
  }, []);

  useEffect(() => { fetchWeek(); }, [fetchWeek]);

  return (
    <PermissionGuard>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className={cardCls + ' p-4 sm:p-5'}>
          <DashboardHeader icon="🚛" title="ตารางเดินรถเก็บขยะ"
            subtitle="ตารางรายสัปดาห์ · กองสาธารณสุขและสิ่งแวดล้อม" />
          {error ? (
            <div className="text-center py-12">
              <p className="text-[13px] text-[#8A8398]">{error}</p>
              <button type="button" className={primaryBtnCls + ' mt-3'} onClick={fetchWeek}>
                ลองใหม่
              </button>
            </div>
          ) : !days ? (
            <div className="flex justify-center py-16">
              <span className="loading loading-spinner loading-lg text-primary" />
            </div>
          ) : (
            <WeekScheduleView days={days} activeDate={activeDate} onChangeDate={setActiveDate} />
          )}
        </div>

        <div className={cardCls + ' p-4 sm:p-5'}>
          <ContactSettingsCard />
        </div>
      </div>
    </PermissionGuard>
  );
}
