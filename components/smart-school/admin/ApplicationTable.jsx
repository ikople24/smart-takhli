import React, { useMemo, useState } from 'react';
import { SCHOLARSHIP_LEVELS, levelBucket } from '@/lib/smart-school/scholarshipLevels';

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
  const [levelTab, setLevelTab] = useState('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (levelTab !== 'all' && levelBucket(r.educationLevel) !== levelTab) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (renewalFilter === 'renewal' && !r.isRenewal) return false;
      if (renewalFilter === 'new' && r.isRenewal) return false;
      if (!q) return true;
      return [r.name, r.applicationId, r.phone, r.address, r.schoolName]
        .some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [rows, search, statusFilter, renewalFilter, levelTab]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
      <div className="flex flex-wrap gap-1">
        <button className={`btn btn-xs ${levelTab === 'all' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setLevelTab('all')}>ทั้งหมด ({rows.length})</button>
        {SCHOLARSHIP_LEVELS.map((b) => {
          const n = rows.filter((r) => levelBucket(r.educationLevel) === b.key).length;
          return (
            <button key={b.key} className={`btn btn-xs ${levelTab === b.key ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setLevelTab(b.key)}>{b.label} ({n})</button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <input type="text" placeholder="ค้นหา ชื่อ/รหัส/เบอร์/ที่อยู่/โรงเรียน"
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
              <th>ครัวเรือน/เกณฑ์</th>
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
                <td>{r.prefix}{r.name}</td>
                <td>{r.educationLevel || '-'}</td>
                <td>{r.phone || '-'}</td>
                <td>{(r.annualIncome || 0).toLocaleString()}</td>
                <td>
                  <span className={`badge badge-sm ${STATUS_BADGE[r.status] || 'badge-ghost'}`}>
                    {r.status}
                  </span>
                </td>
                <td className="space-x-1 whitespace-nowrap">
                  {r.household?.members?.length > 0 && (
                    <span className="badge badge-warning badge-sm cursor-pointer"
                      title={`บ้านเดียวกับ: ${r.household.members.map((m) => m.name).join(', ')}`}
                      onClick={() => onDetail(r)}>
                      🏠 บ้านเดียวกัน ({r.household.members.length})
                    </span>
                  )}
                  {r.schoolEligibility === 'block' && <span className="badge badge-error badge-sm ml-1">เอกชน/นอกเขต</span>}
                  {r.residencyOverOneYear === false && <span className="badge badge-ghost badge-sm ml-1">ทะเบียน&lt;1ปี?</span>}
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
