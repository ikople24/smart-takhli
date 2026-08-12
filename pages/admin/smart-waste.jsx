import { useCallback, useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import Swal from 'sweetalert2';
import dynamic from 'next/dynamic';
import PermissionGuard from '@/components/PermissionGuard';
import DailyEntryForm from '@/components/smart-waste/entry/DailyEntryForm';
import MonthTable from '@/components/smart-waste/admin/MonthTable';
import TypeManagerModal from '@/components/smart-waste/admin/TypeManagerModal';
import { DashboardHeader, PillTabs, YearPills, cardCls } from '@/components/smart-waste/wasteTheme';
import { bangkokToday } from '@/lib/smart-waste/fiscalYear';
import { listFiscalYears } from '@/lib/smart-waste/uiDate';

// recharts หนัก — โหลดเฉพาะฝั่ง client ตอนเปิดแท็บสรุปเท่านั้น
const SummaryDashboard = dynamic(
  () => import('@/components/smart-waste/admin/SummaryDashboard'),
  { ssr: false, loading: () => (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    ) }
);

// Smart Waste — บันทึกขยะรีไซเคิลและขยะเปียกรายวัน (กองสาธารณสุข)
// หน้าเดียว 3 แท็บตามสเปกข้อ 7.1 — จัดการประเภทเป็น modal ไม่แยกหน้า (เลี่ยง permission entry ที่ 2)
export default function SmartWastePage() {
  const { user } = useUser();
  const isSuperAdmin = user?.publicMetadata?.role === 'superadmin';

  const [tab, setTab] = useState('entry'); // 'entry' | 'data' | 'summary'
  const [types, setTypes] = useState(null); // null = ยังไม่โหลด (รวม inactive — ตารางย้อนหลังต้องใช้)
  const [editDate, setEditDate] = useState(null); // แท็บข้อมูลสั่งเปิดฟอร์มที่วันนี้
  const [managerOpen, setManagerOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0); // บันทึกสำเร็จ → บังคับแท็บอื่นโหลดใหม่

  const years = listFiscalYears(bangkokToday());
  const [fiscalYear, setFiscalYear] = useState(years[0]);

  const fetchTypes = useCallback(async () => {
    try {
      const res = await fetch('/api/smart-waste/types?includeInactive=1');
      if (!res.ok) throw new Error((await res.json()).message || 'โหลดประเภทขยะไม่สำเร็จ');
      setTypes((await res.json()).types);
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'โหลดประเภทขยะไม่สำเร็จ', text: error.message });
    }
  }, []);

  useEffect(() => { fetchTypes(); }, [fetchTypes]);

  const openEntryAt = (recordDate) => {
    setEditDate(recordDate);
    setTab('entry');
  };

  return (
    <PermissionGuard>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className={cardCls + ' p-4 sm:p-5'}>
          <DashboardHeader icon="♻️" title="ระบบบริหารจัดการขยะ"
            subtitle="บันทึกน้ำหนักคัดแยกรายวัน · กองสาธารณสุข"
            right={
              <button type="button" onClick={() => setManagerOpen(true)}
                title="จัดการประเภทขยะ" aria-label="จัดการประเภทขยะ"
                className="grid h-10 w-10 place-items-center rounded-[12px] border border-[#E7E2F2]
                  text-[18px] hover:bg-[#F1ECFB] transition">⚙️</button>
            } />
          <PillTabs active={tab} onChange={setTab}
            tabs={[
              { key: 'entry', label: '📝 บันทึก' },
              { key: 'data', label: '📅 ข้อมูล' },
              { key: 'summary', label: '📊 สรุป' },
            ]} />

          <div className="mt-4">
            {!types ? (
              <div className="flex justify-center py-16">
                <span className="loading loading-spinner loading-lg text-primary" />
              </div>
            ) : tab === 'entry' ? (
              <DailyEntryForm types={types} initialDate={editDate}
                onSaved={() => setRefreshTick((t) => t + 1)} />
            ) : tab === 'data' ? (
              <div className="space-y-3">
                <YearPills years={years} value={fiscalYear} onChange={setFiscalYear} />
                <MonthTable fiscalYear={fiscalYear} types={types}
                  onEditDate={openEntryAt} refreshTick={refreshTick} />
              </div>
            ) : (
              <div className="space-y-3">
                <YearPills years={years} value={fiscalYear} onChange={setFiscalYear} />
                <SummaryDashboard fiscalYear={fiscalYear} refreshTick={refreshTick} />
              </div>
            )}
          </div>
        </div>

        <TypeManagerModal open={managerOpen} onClose={() => setManagerOpen(false)}
          isSuperAdmin={isSuperAdmin}
          onChanged={() => { fetchTypes(); setRefreshTick((t) => t + 1); }} />
      </div>
    </PermissionGuard>
  );
}
