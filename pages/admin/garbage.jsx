import { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import PermissionGuard from '@/components/PermissionGuard';
import WeekScheduleView from '@/components/garbage/admin/WeekScheduleView';
import ContactSettingsCard from '@/components/garbage/admin/ContactSettingsCard';
import { DashboardHeader, cardCls } from '@/components/ui/adminTheme';

// ตารางเดินรถเก็บขยะ — อ่านอย่างเดียวรอบนี้ (แก้ตารางยังทำผ่าน data/garbage/schedule-seed.json + scripts/seed-garbage.mjs)
export default function AdminGarbagePage() {
  const [days, setDays] = useState(null);
  const [activeDate, setActiveDate] = useState(null);

  const fetchWeek = useCallback(async () => {
    try {
      const res = await fetch('/api/garbage/week');
      const json = await res.json();
      // API ชุดนี้คืน { error } ไม่ใช่ { success, message }
      if (!res.ok) throw new Error(json?.error || 'โหลดตารางไม่สำเร็จ');
      setDays(json.days);
      // เปิดที่วันที่มีข้อมูลวันแรก ถ้าไม่มีเลยเปิดวันอาทิตย์
      const firstWithData = json.days.find((d) => d.assignments.length > 0);
      setActiveDate((firstWithData ?? json.days[0]).date);
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'โหลดตารางไม่สำเร็จ', text: error.message });
    }
  }, []);

  useEffect(() => { fetchWeek(); }, [fetchWeek]);

  return (
    <PermissionGuard>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className={cardCls + ' p-4 sm:p-5'}>
          <DashboardHeader icon="🚛" title="ตารางเดินรถเก็บขยะ"
            subtitle="ตารางรายสัปดาห์ · กองสาธารณสุขและสิ่งแวดล้อม" />
          {!days ? (
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
