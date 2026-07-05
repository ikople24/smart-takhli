import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Swal from 'sweetalert2';
import ApplicationTable from './ApplicationTable';
import ApplicationDetailModal from './ApplicationDetailModal';
import ApplicationEditModal from './ApplicationEditModal';
import BlockedSchoolsPanel from './BlockedSchoolsPanel';
import AllocationBoard from './AllocationBoard';
import { DashboardHeader, YearPills, PillTabs, StatCard, cardCls } from '@/components/smart-school/adminTheme';

const MapPoints = dynamic(() => import('./MapPoints'), { ssr: false });

export default function SmartSchoolDashboard() {
  const [year, setYear] = useState(null); // null = ปีปัจจุบัน (server ตัดสิน)
  const [data, setData] = useState(null); // { year, years, applications, stats }
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('table'); // 'table' | 'map' | 'blocked'
  const [detailRow, setDetailRow] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const reqIdRef = useRef(0);

  const fetchData = useCallback(async () => {
    const myId = ++reqIdRef.current;
    setLoading(true);
    try {
      const q = year ? `?year=${year}` : '';
      const res = await fetch(`/api/smart-school/list${q}`);
      if (!res.ok) throw new Error((await res.json()).message || 'โหลดข้อมูลไม่สำเร็จ');
      const json = await res.json();
      if (myId === reqIdRef.current) setData(json);
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: e.message });
    } finally {
      if (myId === reqIdRef.current) setLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSetStatus = async (row, status) => {
    const res = await fetch('/api/smart-school/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _id: row._id, status }),
    });
    if (res.ok) {
      await fetchData();
      setDetailRow(null);
    } else {
      Swal.fire({ icon: 'error', title: 'เปลี่ยนสถานะไม่สำเร็จ', text: (await res.json()).message });
    }
  };

  const handleDelete = async (row) => {
    const c = await Swal.fire({
      icon: 'warning',
      title: `ลบใบสมัคร ${row.applicationId}?`,
      text: 'ใช้สำหรับเก็บกวาดรายการซ้ำ — ลบแล้วกู้คืนไม่ได้',
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
    });
    if (!c.isConfirmed) return;
    const res = await fetch('/api/smart-school/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _id: row._id }),
    });
    if (res.ok) {
      setDetailRow(null);
      await fetchData();
    } else {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: (await res.json()).message });
    }
  };

  const stats = data?.stats;
  // ปีในแท็บ = union ของ data.years กับ data.year กัน edge case ปีงบใหม่ที่ยังไม่มีใบสมัคร (data.year ไม่อยู่ใน years)
  const yearTabs = data ? Array.from(new Set([...(data.years || []), data.year])).sort((a, b) => b - a) : [];

  return (
    <div className="space-y-4">
      <div className={cardCls + ' p-5'}>
        <DashboardHeader
          title="Smart School — สำรวจการศึกษา"
          subtitle="ทะเบียนผู้ขอทุน + แบบสำรวจรายปีงบประมาณ"
          right={<YearPills years={yearTabs} value={data?.year} onChange={(y) => setYear(y)} />}
        />

        <div className={stats && view === 'table' ? 'mb-5' : ''}>
          <PillTabs
            active={view}
            onChange={setView}
            tabs={[
              { key: 'table', label: '📋 ตาราง' },
              { key: 'map', label: '🗺️ แผนที่' },
              { key: 'blocked', label: '🚫 โรงเรียนไม่ผ่าน' },
              { key: 'allocation', label: '🎯 จัดสรรทุน' },
            ]}
          />
        </div>

        {/* สรุป */}
        {stats && view === 'table' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard value={stats.total} label="ทั้งหมด" tone="purple" />
            <StatCard value={stats.renewals} label="รายเก่า" />
            <StatCard value={stats.byStatus?.['รับคำร้อง'] || 0} label="รับคำร้อง" />
            <StatCard value={stats.byStatus?.['ตรวจสอบแล้ว'] || 0} label="ตรวจสอบแล้ว" tone="deep" />
            <StatCard value={stats.byStatus?.['ได้รับทุน'] || 0} label="ได้รับทุน" tone="green" />
            <StatCard value={stats.byStatus?.['ไม่ผ่านเกณฑ์'] || 0} label="ไม่ผ่านเกณฑ์" tone="gray" />
          </div>
        )}
      </div>

      {/* เนื้อหาแต่ละแท็บ — แต่ละ view ห่อการ์ดของตัวเอง (กันการ์ดซ้อนการ์ด) */}
      {loading && !data ? (
        <div className="flex justify-center items-center h-60">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : view === 'blocked' ? (
        <BlockedSchoolsPanel />
      ) : view === 'allocation' ? (
        <AllocationBoard rows={data?.applications || []} onRefresh={fetchData} />
      ) : view === 'map' ? (
        <MapPoints data={data?.applications || []} />
      ) : (
        <ApplicationTable
          rows={data?.applications || []}
          onDetail={setDetailRow}
          onEdit={setEditRow}
        />
      )}

      {detailRow && (
        <ApplicationDetailModal
          row={detailRow}
          onClose={() => setDetailRow(null)}
          onSetStatus={handleSetStatus}
          onEdit={() => { setEditRow(detailRow); setDetailRow(null); }}
          onDelete={handleDelete}
        />
      )}
      {editRow && (
        <ApplicationEditModal
          row={editRow}
          onClose={() => setEditRow(null)}
          onSaved={async () => { setEditRow(null); await fetchData(); }}
        />
      )}
    </div>
  );
}
