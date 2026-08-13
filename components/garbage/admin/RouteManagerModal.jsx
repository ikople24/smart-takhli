import { useEffect, useState } from 'react';
import { zoneLabel } from '@/lib/garbage/labels';
import { inputCls, labelCls, primaryBtnCls, ghostBtnCls } from '@/components/ui/adminTheme';

/**
 * จัดการสายและรายการจุดเก็บ
 * เตือนก่อนบันทึกว่าการลบหรือสลับจุดกระทบเวลาของงานที่ใช้สายนี้
 * ส่ง prevSeq ไปให้เซิร์ฟเวอร์ย้ายเวลาตามจุดเดิม ไม่ใช่ตามตำแหน่ง
 */
export default function RouteManagerModal({ open, routes, communities = [], onClose, onSaved }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [verified, setVerified] = useState(false);
  const [stops, setStops] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setCode(routes[0]?.code ?? '');
  }, [open, routes]);

  useEffect(() => {
    const r = routes.find((x) => x.code === code);
    if (!r) return;
    setName(r.name);
    setVerified(!r.needsVerification);
    setStops(r.stops.map((s) => ({
      prevSeq: s.seq, name: s.name, mode: s.mode, roadId: s.roadId ?? null,
      communityName: s.communityName ?? '', communitySource: s.communitySource ?? null,
    })));
  }, [code, routes]);

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= stops.length) return;
    const next = [...stops];
    [next[i], next[j]] = [next[j], next[i]];
    setStops(next);
  };

  const removed = (routes.find((r) => r.code === code)?.stops.length ?? 0) - stops.filter((s) => s.prevSeq != null).length;
  const reordered = stops.some((s, i) => s.prevSeq != null && s.prevSeq !== i + 1);

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      // ต้องส่ง updatedAt ที่โหลดมากลับไปด้วย — เซิร์ฟเวอร์ใช้กันฟอร์มค้างเขียนทับ
      // (สลับลำดับจุดจากฟอร์มเก่าจะทำให้เวลาไปติดผิดจุดทุกจุดโดยไม่มีร่องรอย)
      // เอกสารเก่าที่ยังไม่มี updatedAt ใน DB จะได้ null มาจาก GET — ต้องส่งค่าที่ "ไม่ว่าง"
      // เพราะ schema บังคับ min(1) ส่วนเซิร์ฟเวอร์จะข้ามการเทียบให้เองเมื่อฝั่ง DB เป็น null
      const current = routes.find((r) => r.code === code);
      const res = await fetch(`/api/garbage/routes/${code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          needsVerification: !verified,
          // ส่งเฉพาะฟิลด์ที่ schema รับ — communitySource ห้ามส่ง (เซิร์ฟเวอร์ตั้งเอง
          // และ stopDraftSchema เป็น .strict() จะปฏิเสธทั้งคำขอถ้าติดไปด้วย)
          stops: stops.map((s) => ({
            prevSeq: s.prevSeq, name: s.name, mode: s.mode, roadId: s.roadId ?? null,
            communityName: s.communityName || null,
          })),
          updatedAt: current?.updatedAt ?? 'none',
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 409) {
        throw new Error(json?.error || 'ข้อมูลสายเปลี่ยนไปแล้ว — ปิดหน้าต่างนี้แล้วเปิดใหม่');
      }
      if (!res.ok) throw new Error(json?.error || 'บันทึกไม่สำเร็จ');
      onSaved(json?.affectedAssignments ?? 0, json?.warnings ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[24px] bg-white p-5 space-y-3">
        <div className="text-[16px] font-bold text-[#57506A]">จัดการสายและจุดเก็บ</div>

        {error && (
          <div className="rounded-[14px] bg-amber-50 ring-1 ring-amber-200 p-3 text-[13px] text-amber-900">{error}</div>
        )}

        <div>
          <label className={labelCls} htmlFor="rm-code">สาย</label>
          <select id="rm-code" className={inputCls} value={code} onChange={(e) => setCode(e.target.value)}>
            {/* ชื่อสายคือคำที่ใช้เรียกจริงแล้ว ("โซน 1" · "รถยกภาชนะรองรับ") — รหัสเป็นแค่คีย์ ไม่ต้องโชว์ */}
            {routes.map((r) => <option key={r.code} value={r.code}>{r.name || zoneLabel(r.code)}</option>)}
          </select>
        </div>

        <div>
          <label className={labelCls} htmlFor="rm-name">ชื่อสาย</label>
          <input id="rm-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
          ตรวจสอบชื่อจุดกับกองสาธารณสุขแล้ว
        </label>

        <div className="rounded-[14px] border border-[#E7E2F2] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className={labelCls + ' mb-0'}>จุดเก็บ ({stops.length})</span>
            <span className="text-[11.5px] text-[#8A8398]">
              ระบุชุมชนแล้ว {stops.filter((s) => s.communityName).length}/{stops.length}
              {stops.some((s) => s.communitySource === 'auto') &&
                ` · รอตรวจ ${stops.filter((s) => s.communitySource === 'auto').length}`}
            </span>
            <button type="button" className={ghostBtnCls}
              onClick={() => setStops([...stops, { prevSeq: null, name: '', mode: 'truck', roadId: null }])}>
              + เพิ่มจุด
            </button>
          </div>
          <ol className="space-y-1 max-h-72 overflow-y-auto">
            {stops.map((s, i) => (
              <li key={s.prevSeq ?? `new-${i}`} className="flex items-center gap-1.5">
                <span className="w-6 text-right text-[12px] text-[#8A8398]">{i + 1}.</span>
                <input className="flex-1 rounded-[10px] border border-[#E7E2F2] px-2 py-1 text-[12.5px]"
                  value={s.name} aria-label={`ชื่อจุดลำดับที่ ${i + 1}`}
                  onChange={(e) => {
                    const next = [...stops];
                    next[i] = { ...s, name: e.target.value };
                    setStops(next);
                  }} />
                <select className="rounded-[10px] border border-[#E7E2F2] px-1 py-1 text-[11.5px]"
                  value={s.mode} aria-label={`วิธีเก็บจุดลำดับที่ ${i + 1}`}
                  onChange={(e) => {
                    const next = [...stops];
                    next[i] = { ...s, mode: e.target.value };
                    setStops(next);
                  }}>
                  <option value="truck">รถ</option>
                  <option value="walk">เดิน</option>
                </select>
                {/* พื้นเหลือง = ระบบเติมให้จากพิกัด ยังไม่มีเจ้าหน้าที่ตรวจ (communitySource === 'auto') */}
                <select
                  className={'rounded-[10px] border px-1 py-1 text-[11.5px] max-w-[9rem] ' +
                    (s.communitySource === 'auto'
                      ? 'border-amber-300 bg-amber-50'
                      : 'border-[#E7E2F2]')}
                  value={s.communityName || ''}
                  aria-label={`ชุมชนของจุดลำดับที่ ${i + 1}`}
                  title={s.communitySource === 'auto' ? 'ระบบเติมให้ ยังไม่มีคนตรวจ' : ''}
                  onChange={(e) => {
                    const next = [...stops];
                    next[i] = { ...s, communityName: e.target.value, communitySource: e.target.value ? 'manual' : null };
                    setStops(next);
                  }}>
                  <option value="">— ชุมชน —</option>
                  {communities.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button type="button" aria-label={`เลื่อนขึ้น จุดลำดับที่ ${i + 1}`}
                  className="px-1.5 text-[#8A8398] disabled:opacity-30" disabled={i === 0}
                  onClick={() => move(i, -1)}>↑</button>
                <button type="button" aria-label={`เลื่อนลง จุดลำดับที่ ${i + 1}`}
                  className="px-1.5 text-[#8A8398] disabled:opacity-30" disabled={i === stops.length - 1}
                  onClick={() => move(i, 1)}>↓</button>
                <button type="button" aria-label={`ลบ จุดลำดับที่ ${i + 1}`}
                  className="px-1.5 text-red-500"
                  onClick={() => setStops(stops.filter((_, j) => j !== i))}>✕</button>
              </li>
            ))}
          </ol>
        </div>

        {(removed > 0 || reordered) && (
          <div className="rounded-[14px] bg-amber-50 ring-1 ring-amber-200 p-3 text-[12.5px] text-amber-900">
            {removed > 0 && <>จะลบจุด {removed} จุด — เวลาของจุดที่ถูกลบจะหายไปด้วย<br /></>}
            {reordered && <>มีการสลับลำดับจุด — เวลาจะย้ายตามจุดเดิม ไม่ตามตำแหน่ง</>}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" className={primaryBtnCls} onClick={save} disabled={saving || stops.length === 0}>
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
          <button type="button" className={ghostBtnCls} onClick={onClose} disabled={saving}>ยกเลิก</button>
        </div>
      </div>
    </div>
  );
}
