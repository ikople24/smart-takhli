import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

const REASON_BADGE = {
  private: 'badge-error',
  'out-of-district': 'badge-warning',
  other: 'badge-ghost',
};

const REASON_LABEL = {
  private: 'เอกชน',
  'out-of-district': 'นอกเขต',
  other: 'อื่นๆ',
};

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
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input type="text" placeholder="ค้นหาชื่อโรงเรียน"
            className="input input-bordered input-sm flex-1 min-w-48"
            value={search} onChange={(e) => setSearch(e.target.value)} />
          <span className="text-xs text-gray-500 self-center">{filtered.length} รายการ</span>
        </div>

        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>ชื่อโรงเรียน</th>
                <th>เหตุผล</th>
                <th>หมายเหตุ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="text-center text-gray-400 py-6">กำลังโหลด...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-gray-400 py-6">
                    {items.length === 0 ? 'ยังไม่มีรายการ — เพิ่มด้านล่าง' : 'ไม่พบรายการที่ค้นหา'}
                  </td>
                </tr>
              ) : (
                filtered.map((it) => (
                  <tr key={it.name} className="hover">
                    <td>{it.name}</td>
                    <td>
                      <span className={`badge badge-sm ${REASON_BADGE[it.reason] || 'badge-ghost'}`}>
                        {REASON_LABEL[it.reason] || 'อื่นๆ'}
                      </span>
                    </td>
                    <td className="text-gray-500">{it.note || '-'}</td>
                    <td className="whitespace-nowrap">
                      <button className="btn btn-xs btn-error" onClick={() => handleDelete(it)}>ลบ</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <form onSubmit={handleAdd} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-48">
          <label className="label py-1"><span className="label-text text-xs">ชื่อโรงเรียน</span></label>
          <input type="text" placeholder="ชื่อโรงเรียน"
            className="input input-bordered input-sm w-full"
            value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label py-1"><span className="label-text text-xs">เหตุผล</span></label>
          <select className="select select-bordered select-sm" value={reason}
            onChange={(e) => setReason(e.target.value)}>
            <option value="private">เอกชน</option>
            <option value="out-of-district">นอกเขต</option>
            <option value="other">อื่นๆ</option>
          </select>
        </div>
        <div className="flex-1 min-w-48">
          <label className="label py-1"><span className="label-text text-xs">หมายเหตุ</span></label>
          <input type="text" placeholder="หมายเหตุ (ถ้ามี)"
            className="input input-bordered input-sm w-full"
            value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>
          {saving ? <span className="loading loading-spinner loading-xs" /> : 'เพิ่ม'}
        </button>
      </form>
    </div>
  );
}
