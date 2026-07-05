import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { SCHOLARSHIP_LEVELS, levelBucket, bucketInfo } from '@/lib/smart-school/scholarshipLevels';
import { cardCls, tableHeadCls, chipCls, statusBadgeCls, FONT_DISPLAY } from '@/components/smart-school/adminTheme';

const bucketRank = (key) => SCHOLARSHIP_LEVELS.findIndex((b) => b.key === key);

// โต๊ะจัดสรรทุน — แท็บระดับ + โควตา; เจ้าหน้าที่กดให้ทุนเอง (เตือนเกณฑ์/ครัวเรือน ไม่บล็อก)
export default function AllocationBoard({ rows, onRefresh }) {
  const [levelTab, setLevelTab] = useState(SCHOLARSHIP_LEVELS[0].key);
  const [sortBy, setSortBy] = useState('rank'); // 'rank' | 'income' | 'name'
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [draftRank, setDraftRank] = useState({}); // { [_id]: string } ระหว่างพิมพ์

  // เปลี่ยนระดับ → รีเซ็ตตัวกรองโรงเรียน (โรงเรียนคนละชุดในแต่ละระดับ)
  useEffect(() => { setSchoolFilter('all'); }, [levelTab]);

  // บันทึกลำดับจัดสรรทุนที่เจ้าหน้าที่พิมพ์เอง (ต้องตรงเอกสารราชการ) — บันทึกตอนออกจากช่อง
  const saveRank = async (r, raw) => {
    const v = String(raw).trim();
    const current = r.scholarshipRank == null ? '' : String(r.scholarshipRank);
    setDraftRank((d) => { const n = { ...d }; delete n[r._id]; return n; });
    if (v === current) return; // ไม่เปลี่ยน
    if (v !== '' && (!/^\d+$/.test(v) || parseInt(v, 10) < 1)) {
      Swal.fire({ icon: 'warning', title: 'ลำดับไม่ถูกต้อง', text: 'ต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป' });
      return;
    }
    const res = await fetch('/api/smart-school/rank', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _id: r._id, rank: v === '' ? null : parseInt(v, 10) }),
    });
    if (res.ok) onRefresh();
    else Swal.fire({ icon: 'error', title: 'บันทึกลำดับไม่สำเร็จ', text: (await res.json()).message });
  };

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
    if (sortBy === 'rank') {
      arr.sort((a, b) => {
        const ra = a.scholarshipRank, rb = b.scholarshipRank;
        if (ra != null && rb != null) return ra - rb;
        if (ra != null) return -1; // มีลำดับแล้ว อยู่บน
        if (rb != null) return 1;
        return (a.annualIncome || 0) - (b.annualIncome || 0); // ยังไม่จัดลำดับ: รายได้น้อยก่อน
      });
    } else if (sortBy === 'income') {
      arr.sort((a, b) => (a.annualIncome || 0) - (b.annualIncome || 0));
    } else {
      arr.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'th'));
    }
    return arr;
  }, [byLevel, levelTab, sortBy]);

  // รายชื่อโรงเรียนในระดับนี้ (สำหรับตัวกรอง)
  const schools = useMemo(() => {
    const s = new Set();
    for (const r of list) if (r.schoolName) s.add(r.schoolName);
    return [...s].sort((a, b) => a.localeCompare(b, 'th'));
  }, [list]);

  const visible = useMemo(() => (
    schoolFilter === 'all' ? list : list.filter((r) => (r.schoolName || '') === schoolFilter)
  ), [list, schoolFilter]);

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
    const awarded = list
      .filter((r) => r.status === 'ได้รับทุน')
      .sort((a, b) => (a.scholarshipRank ?? Number.MAX_SAFE_INTEGER) - (b.scholarshipRank ?? Number.MAX_SAFE_INTEGER));
    const header = ['ลำดับที่', 'ชื่อ-นามสกุล', 'สถานศึกษา', 'จำนวนเงิน(บาท)'];
    const lines = awarded.map((r) => [r.scholarshipRank ?? '', `${r.prefix || ''}${r.name || ''}`, r.schoolName || '', r.scholarshipAmount || info.amount]);
    const csv = [header, ...lines].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ผู้ได้รับทุน_${levelTab.replace(/[/\\]/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {SCHOLARSHIP_LEVELS.map((b) => {
          const awarded = (byLevel[b.key] || []).filter((r) => r.status === 'ได้รับทุน').length;
          const over = awarded > b.quota;
          const pct = Math.min(100, Math.round((awarded / b.quota) * 100));
          return (
            <div key={b.key} className={'rounded-[18px] p-4 ' + (over ? 'bg-white border border-[#FBCFE0]' : 'bg-white border border-[#E7E2F2]')}>
              <div className="text-[12px] text-[#8A8398]">{b.label}</div>
              <div className="text-[26px] font-bold mt-1" style={{ fontFamily: FONT_DISPLAY, color: over ? '#B91C1C' : undefined }}>
                {awarded}<span className="text-[14px] text-[#8A8398]">/{b.quota}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#EDE7FD] mt-2">
                <div className="h-full rounded-full" style={{ width: (over ? 100 : pct) + '%', background: over ? '#DC2626' : '#7C3AED' }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className={cardCls + ' p-4 space-y-3'}>
        <div className="flex flex-wrap gap-1.5">
          {SCHOLARSHIP_LEVELS.map((b) => {
            const awarded = (byLevel[b.key] || []).filter((r) => r.status === 'ได้รับทุน').length;
            const over = awarded > b.quota;
            return (
              <button key={b.key} type="button"
                className={over
                  ? 'text-[11.5px] leading-none px-3.5 py-2 rounded-full font-semibold transition bg-[#DC2626] text-white shadow-[0_6px_14px_-8px_rgba(220,38,38,0.8)]'
                  : chipCls(levelTab === b.key)}
                onClick={() => setLevelTab(b.key)}>
                {b.label} {awarded}/{b.quota}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="font-bold text-[#211B2E]">{info.label}</span>
          <span className={awardedInLevel > info.quota
            ? 'inline-block text-[11.5px] font-semibold px-2.5 py-1 rounded-full bg-[#FEE2E2] text-[#B91C1C]'
            : 'inline-block text-[11.5px] font-semibold px-2.5 py-1 rounded-full bg-[#EDE7FD] text-[#6D28D9]'}>
            เลือกแล้ว {awardedInLevel} / โควตา {info.quota}
          </span>
          <span className="text-[#8A8398]">ทุนละ {info.amount.toLocaleString()} บาท · รวม {(awardedInLevel * info.amount).toLocaleString()} บาท</span>
          <select className="ml-auto max-w-[12rem] bg-white border border-[#E7E2F2] rounded-[10px] px-2.5 py-1.5 text-[12.5px] font-medium text-[#211B2E] outline-none focus:border-[#7C3AED]" value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)}>
            <option value="all">ทุกโรงเรียน ({schools.length})</option>
            {schools.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="bg-white border border-[#E7E2F2] rounded-[10px] px-2.5 py-1.5 text-[12.5px] font-medium text-[#211B2E] outline-none focus:border-[#7C3AED]" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="rank">เรียงตามลำดับที่จัด</option>
            <option value="income">เรียงรายได้น้อย→มาก</option>
            <option value="name">เรียงชื่อ</option>
          </select>
          <button type="button" className="text-[12.5px] font-bold text-[#7C3AED] bg-[#F1ECFB] rounded-[10px] px-3.5 py-1.5 transition hover:bg-[#DDD2FB]" onClick={exportCsv}>Export ผู้ได้ทุน</button>
        </div>

        <div className={cardCls + ' overflow-hidden'}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead><tr className={tableHeadCls}>
                <th className="text-center px-3 py-2.5">ลำดับ</th><th className="text-left px-3 py-2.5">ชื่อ-นามสกุล</th><th className="text-left px-3 py-2.5">สถานศึกษา</th><th className="text-left px-3 py-2.5">รายได้/ปี</th><th className="text-left px-3 py-2.5">ทะเบียนบ้าน</th><th className="text-left px-3 py-2.5">ครัวเรือน</th><th className="text-left px-3 py-2.5">สถานะ</th><th className="px-3 py-2.5"></th>
              </tr></thead>
              <tbody>
                {visible.map((r) => {
                  const awarded = r.status === 'ได้รับทุน';
                  const reasons = notMet(r);
                  return (
                    <tr key={r._id} className={'border-t border-[#F0ECF8] hover:bg-[#F6F3FD] ' + (reasons.length ? 'bg-[#FFFBEB]' : '')}>
                      <td className="text-center px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number" min="1"
                            className="w-14 text-center bg-white border border-[#E7E2F2] rounded-[10px] px-1.5 py-1 text-[13px] font-medium text-[#211B2E] outline-none focus:border-[#7C3AED]"
                            placeholder="–"
                            value={draftRank[r._id] ?? (r.scholarshipRank ?? '')}
                            onChange={(e) => setDraftRank((d) => ({ ...d, [r._id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveRank(r, e.currentTarget.value); }}
                          />
                          {draftRank[r._id] !== undefined && (
                            <button type="button" className="text-[11.5px] font-bold text-white bg-[#7C3AED] rounded-[8px] px-2 py-1 transition hover:bg-[#6D28D9]" onClick={() => saveRank(r, draftRank[r._id])}>OK</button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">{r.prefix}{r.name}</td>
                      <td className="px-3 py-2">{r.schoolName || '-'}{r.schoolEligibility === 'block' && <span className="inline-block text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#B91C1C] ml-1">ไม่ผ่าน</span>}</td>
                      <td className="px-3 py-2">{(r.annualIncome || 0).toLocaleString()}</td>
                      <td className="px-3 py-2">{r.residencyOverOneYear === true ? '✓' : r.residencyOverOneYear === false ? '✗' : '-'}</td>
                      <td className="px-3 py-2">{r.household?.members?.length > 0 ? <span className="inline-block text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#B45309]" title={r.household.members.map((m) => `${m.name} (${m.level})`).join(', ')}>🏠 {r.household.members.length}</span> : ''}</td>
                      <td className="px-3 py-2"><span className={statusBadgeCls(r.status)}>{r.status}</span></td>
                      <td className="px-3 py-2">
                        <button type="button"
                          className={awarded
                            ? 'text-[12px] font-bold text-[#B91C1C] bg-[#FEE2E2] rounded-[10px] px-3 py-1.5 transition hover:bg-[#FECACA]'
                            : 'text-[12px] font-bold text-white bg-[#16A34A] rounded-[10px] px-3 py-1.5 transition hover:bg-[#15803D]'}
                          onClick={() => setAward(r, !awarded)}>
                          {awarded ? 'ถอนทุน' : 'ให้ทุน'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {visible.length === 0 && <tr><td colSpan={8} className="text-center text-[#B9B0C9] py-6">{schoolFilter === 'all' ? 'ไม่มีผู้สมัครในระดับนี้' : 'ไม่มีผู้สมัครจากโรงเรียนนี้'}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
