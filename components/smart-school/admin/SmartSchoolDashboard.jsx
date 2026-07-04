import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Swal from 'sweetalert2';
import ApplicationTable from './ApplicationTable';
import ApplicationDetailModal from './ApplicationDetailModal';
import ApplicationEditModal from './ApplicationEditModal';
import BlockedSchoolsPanel from './BlockedSchoolsPanel';

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

  // เปลี่ยนสถานะ — เตือนก่อนตั้ง "ได้รับทุน" ถ้าขัดกติกาครัวเรือน (เตือนอย่างเดียว ไม่บล็อก)
  const handleSetStatus = async (row, status) => {
    if (status === 'ได้รับทุน' && (row.flags?.prevYearAwarded || row.flags?.householdAwardedOther)) {
      const reasons = [
        row.flags.prevYearAwarded && '• คนนี้ได้รับทุนปีที่แล้ว — ตามกติกาต้องหมุนเวียนเปลี่ยนคน',
        row.flags.householdAwardedOther && '• ครัวเรือนเดียวกัน (เบอร์/ที่อยู่ตรงกัน) มีผู้ได้รับทุนปีนี้แล้ว',
      ].filter(Boolean).join('\n');
      const c = await Swal.fire({
        icon: 'warning',
        title: 'ขัดกติกาทุน 1 คน/ครัวเรือน/ปี',
        text: reasons,
        showCancelButton: true,
        confirmButtonText: 'ยืนยันให้ทุน (เจ้าหน้าที่ตัดสิน)',
        cancelButtonText: 'ยกเลิก',
      });
      if (!c.isConfirmed) return;
    }
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
      {/* แท็บปีงบประมาณ */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-gray-600">ปีงบประมาณ:</span>
        {yearTabs.map((y) => (
          <button key={y}
            className={`btn btn-sm rounded-full ${y === data?.year ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setYear(y)}>
            {y}
          </button>
        ))}
        <div className="ml-auto join">
          <button className={`btn btn-sm join-item ${view === 'table' ? 'btn-active' : ''}`}
            onClick={() => setView('table')}>ตาราง</button>
          <button className={`btn btn-sm join-item ${view === 'map' ? 'btn-active' : ''}`}
            onClick={() => setView('map')}>แผนที่</button>
          <button className={`btn btn-sm join-item ${view === 'blocked' ? 'btn-active' : ''}`}
            onClick={() => setView('blocked')}>โรงเรียนไม่ผ่าน</button>
        </div>
      </div>

      {/* สรุป */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            ['ทั้งหมด', stats.total],
            ['รายเก่า', stats.renewals],
            ['รับคำร้อง', stats.byStatus?.['รับคำร้อง'] || 0],
            ['ตรวจสอบแล้ว', stats.byStatus?.['ตรวจสอบแล้ว'] || 0],
            ['ได้รับทุน', stats.byStatus?.['ได้รับทุน'] || 0],
            ['ไม่ผ่านเกณฑ์', stats.byStatus?.['ไม่ผ่านเกณฑ์'] || 0],
          ].map(([label, value]) => (
            <div key={label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 text-center">
              <p className="text-2xl font-bold text-gray-800">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      )}

      {loading && !data ? (
        <div className="flex justify-center items-center h-60">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : view === 'blocked' ? (
        <BlockedSchoolsPanel />
      ) : view === 'map' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <MapPoints data={data?.applications || []} />
        </div>
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
