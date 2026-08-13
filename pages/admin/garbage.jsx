import { useCallback, useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import PermissionGuard from '@/components/PermissionGuard';
import WeekScheduleView from '@/components/garbage/admin/WeekScheduleView';
import ContactSettingsCard from '@/components/garbage/admin/ContactSettingsCard';
import AssignmentFormModal from '@/components/garbage/admin/AssignmentFormModal';
import RouteManagerModal from '@/components/garbage/admin/RouteManagerModal';
import { DashboardHeader, cardCls, primaryBtnCls } from '@/components/ui/adminTheme';

// ตารางเดินรถเก็บขยะ — ตั้งแต่ M6 แก้จากหน้านี้ได้ (UI เป็นแหล่งความจริง, seed เหลือเป็น bootstrap ตอน DB ว่าง)
export default function AdminGarbagePage() {
  const [days, setDays] = useState(null);
  const [activeDate, setActiveDate] = useState(null);
  const [error, setError] = useState('');
  const [routes, setRoutes] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [routeMgrOpen, setRouteMgrOpen] = useState(false);
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
      // โหลดซ้ำหลังเพิ่ม/แก้/ลบ ต้องคงวันที่เลือกไว้ ไม่งั้นเพิ่มงานวันพุธแล้วแท็บเด้งกลับวันจันทร์
      setActiveDate((prev) => {
        if (prev && json.days.some((d) => d.date === prev)) return prev;
        const firstWithData = json.days.find((d) => d.assignments.length > 0);
        return (firstWithData ?? json.days[0]).date;
      });
    } catch (err) {
      if (!mountedRef.current) return;
      // ต้องเซ็ต error ด้วย ไม่งั้น days ค้างเป็น null แล้ว spinner หมุนไม่จบหลังปิด Swal
      setError(err.message || 'โหลดตารางไม่สำเร็จ');
      Swal.fire({ icon: 'error', title: 'โหลดตารางไม่สำเร็จ', text: err.message });
    }
  }, []);

  useEffect(() => { fetchWeek(); }, [fetchWeek]);

  const fetchRoutes = useCallback(async () => {
    try {
      const res = await fetch('/api/garbage/routes');
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'โหลดรายการสายไม่สำเร็จ');
      if (mountedRef.current) setRoutes(json.routes ?? []);
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'โหลดรายการสายไม่สำเร็จ', text: e.message });
    }
  }, []);

  useEffect(() => { fetchRoutes(); }, [fetchRoutes]);

  // เบอร์รถที่มีในระบบ — ดึงจากงานที่มีอยู่ (ทะเบียนรถยังแก้ผ่าน seed รอบนี้)
  useEffect(() => {
    if (!days) return;
    const nums = new Set();
    days.forEach((d) => d.assignments.forEach((a) => nums.add(a.truckNumber)));
    setTrucks([...nums].sort((a, b) => a - b).map((number) => ({ number })));
  }, [days]);

  // วันที่เลือกอยู่ → เลขวันในสัปดาห์ ใช้เป็นค่าตั้งต้นของฟอร์มเพิ่มงาน
  const activeWeekday = days?.find((d) => d.date === activeDate)?.weekday ?? 0;

  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (a) => { setEditing(a); setFormOpen(true); };

  const removeAssignment = async (a) => {
    const ok = await Swal.fire({
      icon: 'warning', title: 'ลบงานนี้?',
      text: `รถ ${a.truckNumber} รอบ ${a.shiftNo}${a.routeCode ? ` สาย ${a.routeCode}` : ''}`,
      showCancelButton: true, confirmButtonText: 'ลบ', cancelButtonText: 'ยกเลิก',
    });
    if (!ok.isConfirmed) return;
    try {
      const res = await fetch(`/api/garbage/assignments/${a.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || 'ลบไม่สำเร็จ');
      fetchWeek();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: e.message });
    }
  };

  return (
    <PermissionGuard>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className={cardCls + ' p-4 sm:p-5'}>
          <DashboardHeader icon="🚛" title="ตารางเดินรถเก็บขยะ"
            subtitle="ตารางรายสัปดาห์ · กองสาธารณสุขและสิ่งแวดล้อม"
            right={
              <button type="button" onClick={() => setRouteMgrOpen(true)}
                title="จัดการสายและจุดเก็บ" aria-label="จัดการสายและจุดเก็บ"
                className="grid h-10 w-10 place-items-center rounded-[12px] border border-[#E7E2F2]
                  text-[18px] hover:bg-[#F1ECFB] transition">🛣️</button>
            } />
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
            <WeekScheduleView days={days} activeDate={activeDate} onChangeDate={setActiveDate}
              onAdd={openAdd} onEdit={openEdit} onDelete={removeAssignment} />
          )}
        </div>

        <div className={cardCls + ' p-4 sm:p-5'}>
          <ContactSettingsCard />
        </div>

        {/* ทุก mutation สำเร็จโหลดใหม่จาก DB เสมอ — ห้ามแก้ state ในเครื่องเอง (กันหน้าจอไม่ตรงกับฐานข้อมูล) */}
        <AssignmentFormModal open={formOpen} weekday={activeWeekday} assignment={editing}
          trucks={trucks} routes={routes}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); fetchWeek(); }} />

        <RouteManagerModal open={routeMgrOpen} routes={routes}
          onClose={() => setRouteMgrOpen(false)}
          onSaved={(affected, warnings) => {
            setRouteMgrOpen(false);
            fetchRoutes();
            fetchWeek();
            const base = affected > 0 ? `ปรับเวลาของ ${affected} งานให้ตรงกับจุดใหม่แล้ว` : '';
            if (warnings?.length) {
              // เตือนแบบไม่หายเอง — งานที่เวลาเรียงย้อนต้องให้เจ้าหน้าที่ไปแก้เวลาเอง
              Swal.fire({ icon: 'warning', title: 'บันทึกแล้ว แต่ต้องตรวจเวลา',
                html: [base, ...warnings].filter(Boolean).join('<br>') });
            } else {
              Swal.fire({ icon: 'success', title: 'บันทึกแล้ว', text: base,
                timer: 2000, showConfirmButton: false });
            }
          }} />
      </div>
    </PermissionGuard>
  );
}
