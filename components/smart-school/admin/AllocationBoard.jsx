import React, { useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { SCHOLARSHIP_LEVELS, levelBucket, bucketInfo } from '@/lib/smart-school/scholarshipLevels';

const bucketRank = (key) => SCHOLARSHIP_LEVELS.findIndex((b) => b.key === key);

// โต๊ะจัดสรรทุน — แท็บระดับ + โควตา; เจ้าหน้าที่กดให้ทุนเอง (เตือนเกณฑ์/ครัวเรือน ไม่บล็อก)
export default function AllocationBoard({ rows, onRefresh }) {
  const [levelTab, setLevelTab] = useState(SCHOLARSHIP_LEVELS[0].key);
  const [sortBy, setSortBy] = useState('income'); // 'income' | 'name'

  const byLevel = useMemo(() => {
    const m = {};
    for (const b of SCHOLARSHIP_LEVELS) m[b.key] = [];
    for (const r of rows) {
      const k = levelBucket(r.educationLevel);
      if (k) m[k].push(r);
    }
    return m;
  }, [rows]);

  const info = bucketInfo(levelTab);
  const list = useMemo(() => {
    const arr = [...(byLevel[levelTab] || [])];
    if (sortBy === 'income') arr.sort((a, b) => (a.annualIncome || 0) - (b.annualIncome || 0));
    else arr.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'th'));
    return arr;
  }, [byLevel, levelTab, sortBy]);

  const awardedInLevel = list.filter((r) => r.status === 'ได้รับทุน').length;

  const notMet = (r) => {
    const reasons = [];
    if (r.schoolEligibility === 'block') reasons.push('โรงเรียนไม่ผ่าน (เอกชน/นอกเขต)');
    if (r.residencyOverOneYear === false) reasons.push('ทะเบียนบ้านอาจไม่ถึง 1 ปี');
    const c = r.eligibilityChecklist || {};
    if (!c.residencyVerified || !c.schoolVerified || !c.documentsVerified) reasons.push('เจ้าหน้าที่ยังตรวจไม่ครบ');
    return reasons;
  };

  const higherInHousehold = (r) => {
    const myRank = bucketRank(levelBucket(r.educationLevel));
    return (r.household?.members || []).filter((m) => {
      const rank = bucketRank(levelBucket(m.level));
      return rank > myRank && m.status !== 'ได้รับทุน';
    });
  };

  const setAward = async (r, award) => {
    if (award) {
      const reasons = notMet(r);
      const higher = higherInHousehold(r);
      const parts = [];
      if (reasons.length) parts.push('ยังไม่ผ่านเกณฑ์:\n• ' + reasons.join('\n• '));
      if (higher.length) parts.push('ในบ้านนี้มีระดับสูงกว่ายังไม่ได้เลือก (ปกติพิจารณาก่อน):\n• ' + higher.map((m) => m.name).join('\n• '));
      if (awardedInLevel >= info.quota) parts.push(`เกินโควตาระดับนี้แล้ว (${awardedInLevel}/${info.quota})`);
      if (parts.length) {
        const c = await Swal.fire({
          icon: 'warning', title: 'ยืนยันให้ทุน?', text: parts.join('\n\n'),
          showCancelButton: true, confirmButtonText: 'ยืนยันให้ทุน', cancelButtonText: 'ยกเลิก',
        });
        if (!c.isConfirmed) return;
      }
    }
    const res = await fetch('/api/smart-school/status', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _id: r._id, status: award ? 'ได้รับทุน' : 'ตรวจสอบแล้ว' }),
    });
    if (res.ok) onRefresh();
    else Swal.fire({ icon: 'error', title: 'ไม่สำเร็จ', text: (await res.json()).message });
  };

  const exportCsv = () => {
    const awarded = list.filter((r) => r.status === 'ได้รับทุน');
    const header = ['ชื่อ-นามสกุล', 'สถานศึกษา', 'จำนวนเงิน(บาท)'];
    const lines = awarded.map((r) => [`${r.prefix || ''}${r.name || ''}`, r.schoolName || '', r.scholarshipAmount || info.amount]);
    const csv = [header, ...lines].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ผู้ได้รับทุน_${levelTab}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
      <div className="flex flex-wrap gap-1">
        {SCHOLARSHIP_LEVELS.map((b) => {
          const awarded = (byLevel[b.key] || []).filter((r) => r.status === 'ได้รับทุน').length;
          const over = awarded > b.quota;
          return (
            <button key={b.key}
              className={`btn btn-xs ${levelTab === b.key ? 'btn-primary' : 'btn-outline'} ${over ? 'btn-error' : ''}`}
              onClick={() => setLevelTab(b.key)}>
              {b.label} {awarded}/{b.quota}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{info.label}</span>
        <span className={`badge ${awardedInLevel > info.quota ? 'badge-error' : 'badge-primary'}`}>
          เลือกแล้ว {awardedInLevel} / โควตา {info.quota}
        </span>
        <span className="text-gray-500">ทุนละ {info.amount.toLocaleString()} บาท · รวม {(awardedInLevel * info.amount).toLocaleString()} บาท</span>
        <select className="select select-bordered select-xs ml-auto" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="income">เรียงรายได้น้อย→มาก</option>
          <option value="name">เรียงชื่อ</option>
        </select>
        <button className="btn btn-xs btn-outline" onClick={exportCsv}>Export ผู้ได้ทุน</button>
      </div>

      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead><tr>
            <th>ชื่อ-นามสกุล</th><th>สถานศึกษา</th><th>รายได้/ปี</th><th>ทะเบียนบ้าน</th><th>ครัวเรือน</th><th>สถานะ</th><th></th>
          </tr></thead>
          <tbody>
            {list.map((r) => {
              const awarded = r.status === 'ได้รับทุน';
              const reasons = notMet(r);
              return (
                <tr key={r._id} className={`hover ${reasons.length ? 'bg-amber-50' : ''}`}>
                  <td>{r.prefix}{r.name}</td>
                  <td>{r.schoolName || '-'}{r.schoolEligibility === 'block' && <span className="badge badge-error badge-xs ml-1">ไม่ผ่าน</span>}</td>
                  <td>{(r.annualIncome || 0).toLocaleString()}</td>
                  <td>{r.residencyOverOneYear === true ? '✓' : r.residencyOverOneYear === false ? '✗' : '-'}</td>
                  <td>{r.household?.members?.length > 0 ? <span className="badge badge-warning badge-xs" title={r.household.members.map((m) => `${m.name} (${m.level})`).join(', ')}>🏠 {r.household.members.length}</span> : ''}</td>
                  <td><span className={`badge badge-sm ${awarded ? 'badge-success' : 'badge-ghost'}`}>{r.status}</span></td>
                  <td>
                    <button className={`btn btn-xs ${awarded ? 'btn-outline btn-error' : 'btn-success'}`}
                      onClick={() => setAward(r, !awarded)}>
                      {awarded ? 'ถอนทุน' : 'ให้ทุน'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={7} className="text-center text-gray-400 py-6">ไม่มีผู้สมัครในระดับนี้</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
