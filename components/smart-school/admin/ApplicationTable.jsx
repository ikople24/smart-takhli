import React, { useMemo, useState } from 'react';
import { SCHOLARSHIP_LEVELS, levelBucket } from '@/lib/smart-school/scholarshipLevels';
import { cardCls, tableHeadCls, chipCls, inputCls, statusBadgeCls } from '@/components/smart-school/adminTheme';
import { renewalStatus } from '@/lib/smart-school/takhliScholarship';

// badge หน้าชื่อ: เก่า/ใหม่/ไม่ระบุ — isRenewal อย่างเดียวไม่พอ เพราะระบบไม่มีข้อมูลก่อนปี 2568
const RENEWAL_BADGE = {
  old: { label: 'เก่า', cls: 'bg-[#FEF3C7] text-[#B45309]' },
  new: { label: 'ใหม่', cls: 'bg-[#DCFCE7] text-[#15803D]' },
  unknown: { label: 'ไม่ระบุ', cls: 'bg-[#F1F1F4] text-[#6B7280]' },
};

export default function ApplicationTable({ rows, onDetail, onEdit }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [renewalFilter, setRenewalFilter] = useState('all'); // all | renewal | new
  const [levelTab, setLevelTab] = useState('all');
  const [citizenFilter, setCitizenFilter] = useState('all'); // all | has | none

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (levelTab !== 'all' && levelBucket(r.educationLevel) !== levelTab) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      // กรองตามสถานะที่ badge แสดงจริง (รวมคำแจ้งของผู้กรอก) ไม่ใช่ isRenewal ดิบ
      if (renewalFilter !== 'all' && renewalStatus(r).kind !== renewalFilter) return false;
      if (citizenFilter === 'has' && !r.hasCitizenId) return false;
      if (citizenFilter === 'none' && r.hasCitizenId) return false;
      if (!q) return true;
      return [r.name, r.applicationId, r.phone, r.address, r.schoolName]
        .some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [rows, search, statusFilter, renewalFilter, levelTab, citizenFilter]);

  return (
    <div className={cardCls + ' p-4 space-y-3'}>
      <div className="flex flex-wrap gap-2">
        <button className={chipCls(levelTab === 'all')}
          onClick={() => setLevelTab('all')}>ทั้งหมด ({rows.length})</button>
        {SCHOLARSHIP_LEVELS.map((b) => {
          const n = rows.filter((r) => levelBucket(r.educationLevel) === b.key).length;
          return (
            <button key={b.key} className={chipCls(levelTab === b.key)}
              onClick={() => setLevelTab(b.key)}>{b.label} ({n})</button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="max-w-[280px] flex-1 min-w-48">
          <input type="text" placeholder="ค้นหา ชื่อ/รหัส/เบอร์/ที่อยู่/โรงเรียน"
            className={inputCls}
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
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
          <option value="all">เก่า+ใหม่+ไม่ระบุ</option>
          <option value="old">เฉพาะรายเก่า</option>
          <option value="new">เฉพาะรายใหม่ (ยืนยันแล้ว)</option>
          <option value="unknown">ยังไม่ระบุประวัติทุน</option>
        </select>
        <select className="select select-bordered select-sm" value={citizenFilter}
          onChange={(e) => setCitizenFilter(e.target.value)}>
          <option value="all">เลขบัตร: ทั้งหมด</option>
          <option value="has">มีเลขบัตรแล้ว</option>
          <option value="none">ยังไม่มีเลขบัตร</option>
        </select>
        <span className="text-[12px] text-[#8A8398] self-center">{filtered.length} รายการ</span>
      </div>

      <div className="overflow-hidden rounded-[16px] border border-[#E7E2F2]">
        <div className="overflow-x-auto">
          <table className="table table-sm w-full">
            <thead>
              <tr>
                <th className={tableHeadCls}>รหัส</th>
                <th className={tableHeadCls}>ชื่อ-นามสกุล</th>
                <th className={tableHeadCls}>ระดับ</th>
                <th className={tableHeadCls}>เบอร์โทร</th>
                <th className={tableHeadCls}>เลขบัตร</th>
                <th className={tableHeadCls}>รายได้/ปี</th>
                <th className={tableHeadCls}>สถานะ</th>
                <th className={tableHeadCls}>ครัวเรือน/เกณฑ์</th>
                <th className={tableHeadCls}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const rn = renewalStatus(r);
                const badge = RENEWAL_BADGE[rn.kind];
                return (
                <tr key={r._id} className="border-t border-[#F0ECF8] hover:bg-[#F6F3FD]">
                  <td className="whitespace-nowrap">{r.applicationId}</td>
                  <td className="whitespace-nowrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold mr-1 ${badge.cls}`} title={rn.reason}>
                      {badge.label}
                    </span>
                    {r.prefix}{r.name}
                  </td>
                  <td>{r.educationLevel || '-'}</td>
                  <td>{r.phone || '-'}</td>
                  <td className="whitespace-nowrap">
                    {r.citizenIdMasked ? (
                      <span className="text-[12px] text-[#211B2E]">{r.citizenIdMasked}</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F1F1F4] text-[#6B7280] font-bold">
                        ยังไม่มี
                      </span>
                    )}
                  </td>
                  <td>{(r.annualIncome || 0).toLocaleString()}</td>
                  <td>
                    <span className={statusBadgeCls(r.status)}>{r.status}</span>
                  </td>
                  <td className="space-x-1 whitespace-nowrap">
                    {r.household?.members?.length > 0 && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309] font-bold cursor-pointer"
                        title={`บ้านเดียวกับ: ${r.household.members.map((m) => m.name).join(', ')}`}
                        onClick={() => onDetail(r)}
                      >
                        🏠 {r.household.members.length}
                      </span>
                    )}
                    {r.schoolEligibility === 'block' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FEE2E2] text-[#B91C1C] font-bold">
                        เอกชน/นอกเขต
                      </span>
                    )}
                    {r.residencyOverOneYear === false && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F1F1F4] text-[#6B7280] font-bold">
                        ทะเบียน&lt;1ปี?
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    <button className="btn btn-xs btn-outline" onClick={() => onDetail(r)}>ดู</button>
                    <button className="btn btn-xs btn-outline btn-primary ml-1" onClick={() => onEdit(r)}>แก้ไข</button>
                  </td>
                </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="text-center text-gray-400 py-6">ไม่มีข้อมูล</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
