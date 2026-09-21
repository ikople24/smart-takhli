import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { cardCls, tableHeadCls, inputCls, chipCls, primaryBtnCls } from '@/components/smart-school/adminTheme';

const REASON_BADGE = {
  private: 'bg-[#FCE4E4] text-[#C0392B]',
  'out-of-district': 'bg-[#FDF1D6] text-[#B7791F]',
  other: 'bg-[#F1ECFB] text-[#57506A]',
};

const REASON_LABEL = {
  private: 'เอกชน',
  'out-of-district': 'นอกเขต',
  other: 'อื่นๆ',
};

const REASON_OPTIONS = [
  { value: 'private', label: 'เอกชน' },
  { value: 'out-of-district', label: 'นอกเขต' },
  { value: 'other', label: 'อื่นๆ' },
];

export default function BlockedSchoolsPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [name, setName] = useState('');
  const [reason, setReason] = useState('private');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/smart-school/blocked-schools');
      if (!res.ok) throw new Error((await res.json()).message || 'โหลดข้อมูลไม่สำเร็จ');
      const json = await res.json();
      setItems(json.items || []);
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => (it.name || '').toLowerCase().includes(q));
  }, [items, search]);

  const handleDelete = async (item) => {
    const c = await Swal.fire({
      icon: 'warning',
      title: `ลบ "${item.name}" ออกจากบัญชีดำ?`,
      text: 'โรงเรียนนี้จะไม่ถูกเตือนในฟอร์มอีกต่อไป',
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
    });
    if (!c.isConfirmed) return;
    try {
      const res = await fetch('/api/smart-school/blocked-schools', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: item.name }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'ลบไม่สำเร็จ');
      await fetchData();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: e.message });
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      Swal.fire({ icon: 'warning', title: 'ต้องระบุชื่อโรงเรียน' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/smart-school/blocked-schools', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, reason, note }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'เพิ่มไม่สำเร็จ');
      setName('');
      setReason('private');
      setNote('');
      await fetchData();
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'เพิ่มไม่สำเร็จ', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cardCls + ' p-5 space-y-5'}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input type="text" placeholder="ค้นหาชื่อโรงเรียน"
            className={inputCls + ' flex-1 min-w-48'}
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <span className="text-[12px] text-[#8A8398] self-center">{filtered.length} รายการ</span>
        </div>

        <div className="overflow-x-auto rounded-[16px] border border-[#E7E2F2]">
          <table className="table table-sm">
            <thead>
              <tr>
                <th className={tableHeadCls}>ชื่อโรงเรียน</th>
                <th className={tableHeadCls}>เหตุผล</th>
                <th className={tableHeadCls}>หมายเหตุ</th>
                <th className={tableHeadCls}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="text-center text-[#8A8398] py-6">กำลังโหลด...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-[#8A8398] py-6">
                    {items.length === 0 ? 'ยังไม่มีรายการ — เพิ่มด้านล่าง' : 'ไม่พบรายการที่ค้นหา'}
                  </td>
                </tr>
              ) : (
                filtered.map((it) => (
                  <tr key={it.name} className="border-t border-[#F0ECF8] hover:bg-[#F6F3FD]">
                    <td>{it.name}</td>
                    <td>
                      <span className={`inline-block text-[11.5px] font-semibold px-2.5 py-1 rounded-full ${REASON_BADGE[it.reason] || 'bg-[#F1ECFB] text-[#57506A]'}`}>
                        {REASON_LABEL[it.reason] || 'อื่นๆ'}
                      </span>
                    </td>
                    <td className="text-[#8A8398]">{it.note || '-'}</td>
                    <td className="whitespace-nowrap">
                      <button
                        type="button"
                        className="text-[12.5px] font-semibold text-[#DC2626] hover:text-[#B91C1C] transition"
                        onClick={() => handleDelete(it)}
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <form onSubmit={handleAdd} className="border-t border-[#E7E2F2] pt-5 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-48">
          <label className="label py-1"><span className="label-text text-xs text-[#8A8398]">ชื่อโรงเรียน</span></label>
          <input type="text" placeholder="ชื่อโรงเรียน"
            className={inputCls}
            value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label py-1"><span className="label-text text-xs text-[#8A8398]">เหตุผล</span></label>
          <div className="flex flex-wrap gap-2">
            {REASON_OPTIONS.map((opt) => (
              <button key={opt.value} type="button"
                className={chipCls(reason === opt.value)}
                onClick={() => setReason(opt.value)}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 min-w-48">
          <label className="label py-1"><span className="label-text text-xs text-[#8A8398]">หมายเหตุ</span></label>
          <input type="text" placeholder="หมายเหตุ (ถ้ามี)"
            className={inputCls}
            value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <button type="submit" className={primaryBtnCls} disabled={saving}>
          {saving ? <span className="loading loading-spinner loading-xs" /> : 'เพิ่ม'}
        </button>
      </form>
    </div>
  );
}
