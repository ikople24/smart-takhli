import React, { useMemo, useState } from 'react';

const STATUS_BADGE = {
  'รับคำร้อง': 'badge-info',
  'ตรวจสอบแล้ว': 'badge-primary',
  'ได้รับทุน': 'badge-success',
  'ไม่ผ่านเกณฑ์': 'badge-ghost',
};

export default function ApplicationTable({ rows, onDetail, onEdit }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [renewalFilter, setRenewalFilter] = useState('all'); // all | renewal | new

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (renewalFilter === 'renewal' && !r.isRenewal) return false;
      if (renewalFilter === 'new' && r.isRenewal) return false;
      if (!q) return true;
      return [r.name, r.applicationId, r.phone, r.address, r.citizenId]
        .some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [rows, search, statusFilter, renewalFilter]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <input type="text" placeholder="ค้นหา ชื่อ/รหัส/เบอร์/ที่อยู่/เลขบัตร"
          className="input input-bordered input-sm flex-1 min-w-48"
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select select-bordered select-sm" value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">ทุกสถานะ</option>
          <option value="รับคำร้อง">รับคำร้อง</option>
          <option value="ตรวจสอบแล้ว">ตรวจสอบแล้ว</option>
          <option value="ได้รับทุน">ได้รับทุน</option>
          <option value="ไม่ผ่านเกณฑ์">ไม่ผ่านเกณฑ์</option>
        </select>
        <select className="select select-bordered select-sm" value={renewalFilter}
          onChange={(e) => setRenewalFilter(e.target.value)}>
          <option value="all">รายเก่า+ใหม่</option>
          <option value="renewal">เฉพาะรายเก่า</option>
          <option value="new">เฉพาะรายใหม่</option>
        </select>
        <span className="text-xs text-gray-500 self-center">{filtered.length} รายการ</span>
      </div>

      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>รหัส</th>
              <th>ชื่อ-นามสกุล</th>
              <th>ระดับ</th>
              <th>เบอร์โทร</th>
              <th>รายได้/ปี</th>
              <th>สถานะ</th>
              <th>กติกาครัวเรือน</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r._id} className="hover">
                <td className="whitespace-nowrap">
                  {r.applicationId}
                  {r.isRenewal && <span className="badge badge-warning badge-xs ml-1">รายเก่า</span>}
                </td>
                <td>
                  {r.prefix}{r.name}
                  {!r.citizenId && (
                    <span className="badge badge-outline badge-xs ml-1" title="ยังไม่ผูกเลขบัตร 13 หลัก">
                      ไม่มีเลขบัตร
                    </span>
                  )}
                </td>
                <td>{r.educationLevel || '-'}</td>
                <td>{r.phone || '-'}</td>
                <td>{(r.annualIncome || 0).toLocaleString()}</td>
                <td>
                  <span className={`badge badge-sm ${STATUS_BADGE[r.status] || 'badge-ghost'}`}>
                    {r.status}
                  </span>
                </td>
                <td className="space-x-1 whitespace-nowrap">
                  {r.flags?.prevYearAwarded && (
                    <span className="badge badge-error badge-sm" title="ได้ทุนปีที่แล้ว — ตามกติกาต้องหมุนเวียนเปลี่ยนคน">
                      🔁 ได้ทุนปีที่แล้ว
                    </span>
                  )}
                  {r.flags?.householdKey && (
                    <span className="badge badge-warning badge-sm"
                      title={`น่าจะครัวเรือนเดียวกัน (${r.flags.householdKey.startsWith('p:') ? 'เบอร์โทรตรงกัน' : 'ที่อยู่ตรงกัน'})${r.flags.householdAwardedOther ? ' — มีคนในบ้านได้ทุนปีนี้แล้ว' : ''}`}>
                      🏠 บ้านเดียวกัน{r.flags.householdAwardedOther ? ' ⚠️' : ''}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap">
                  <button className="btn btn-xs btn-outline" onClick={() => onDetail(r)}>ดู</button>
                  <button className="btn btn-xs btn-outline btn-primary ml-1" onClick={() => onEdit(r)}>แก้ไข</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center text-gray-400 py-6">ไม่มีข้อมูล</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
