import { useEffect, useMemo, useState } from 'react';
import { parseThaiTime, formatThaiTime } from '@/lib/garbage/time';
import { KIND_LABEL_TH, weekdayName } from '@/lib/garbage/labels';
import { inputCls, labelCls, primaryBtnCls, ghostBtnCls } from '@/components/ui/adminTheme';
import StopTimesEditor from './StopTimesEditor';

const KINDS = ['normal', 'substitute', 'day_off', 'special'];

/** แปลง "4.00" หรือ "4:00" เป็นนาที — ช่องเวลาในฟอร์มรับรูปแบบเดียวกับที่แสดง */
function toMin(text) {
  return parseThaiTime(text);
}

/**
 * ฟอร์มเพิ่ม/แก้งานมอบหมาย
 * ซ่อนช่องที่ชนิดงานนั้นไม่ใช้ เพื่อไม่ให้ผู้ใช้ไปชนกฎ validator ฝั่งเซิร์ฟเวอร์
 * assignment = null คือโหมดเพิ่มใหม่
 */
export default function AssignmentFormModal({ open, weekday, assignment, trucks, routes, onClose, onSaved }) {
  const [truckNumber, setTruckNumber] = useState('');
  const [shiftNo, setShiftNo] = useState('1');
  const [kind, setKind] = useState('normal');
  const [routeCode, setRouteCode] = useState('');
  const [coverForRouteCode, setCoverForRouteCode] = useState('');
  const [startText, setStartText] = useState('');
  const [endText, setEndText] = useState('');
  const [label, setLabel] = useState('');
  const [stopTimes, setStopTimes] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    if (assignment) {
      setTruckNumber(String(assignment.truckNumber));
      setShiftNo(String(assignment.shiftNo));
      setKind(assignment.kind);
      setRouteCode(assignment.routeCode ?? '');
      setCoverForRouteCode(assignment.coverForRouteCode ?? '');
      setStartText(assignment.startMin == null ? '' : formatThaiTime(assignment.startMin).replace(' น.', ''));
      setEndText(assignment.endMin == null ? '' : formatThaiTime(assignment.endMin).replace(' น.', ''));
      setLabel(assignment.label ?? '');
      // ยึด served ไม่ใช่ atMin — จุดที่ "เก็บวันนี้แต่ยังไม่ระบุเวลา" (เช่นทุกจุดของรถ 13)
      // มี atMin เป็น null ถ้ากรองด้วย atMin จุดพวกนี้จะหายเงียบ ๆ แล้วการกดบันทึกครั้งเดียว
      // จะลบเครื่องหมาย "เก็บวันนี้" ทิ้งทั้งหมดโดยที่แอดมินไม่รู้ตัว
      setStopTimes(assignment.stops.filter((s) => s.served).map((s) => ({ seq: s.seq, atMin: s.atMin })));
    } else {
      setTruckNumber('');
      setShiftNo('1');
      setKind('normal');
      setRouteCode('');
      setCoverForRouteCode('');
      setStartText('');
      setEndText('');
      setLabel('');
      setStopTimes([]);
    }
  }, [open, assignment]);

  const selectedRoute = useMemo(() => routes.find((r) => r.code === routeCode) ?? null, [routes, routeCode]);
  const isDayOff = kind === 'day_off';
  const needsRoute = kind === 'normal' || kind === 'substitute';

  const save = async () => {
    setError('');
    const startMin = isDayOff ? null : toMin(startText);
    const endMin = isDayOff ? null : toMin(endText);
    if (!isDayOff && (startMin == null || endMin == null)) {
      setError('เวลาต้องเป็นรูปแบบ 4.00 หรือ 13.30');
      return;
    }
    const body = {
      weekday,
      truckNumber: Number(truckNumber),
      shiftNo: Number(shiftNo),
      kind,
      routeCode: isDayOff ? null : routeCode || null,
      coverForRouteCode: kind === 'substitute' ? coverForRouteCode || null : null,
      startMin,
      endMin,
      stopTimes: isDayOff ? [] : stopTimes,
      communityWindows: assignment?.communityWindows ?? [],
      label: label.trim() === '' ? null : label.trim(),
    };
    // PUT เท่านั้นที่ต้องส่ง updatedAt — เซิร์ฟเวอร์ใช้กันฟอร์มค้างเขียนทับ (POST ยังไม่มีเอกสารให้ชน)
    // งานเก่าที่ยังไม่มี updatedAt ใน DB จะได้ค่าว่างมาจาก /week — ต้องส่งค่าที่ "ไม่ว่าง"
    // เพราะ schema บังคับ min(1) ส่วนเซิร์ฟเวอร์จะข้ามการเทียบให้เองเมื่อฝั่ง DB ไม่ใช่ Date
    if (assignment) body.updatedAt = assignment.updatedAt || 'none';

    setSaving(true);
    try {
      const url = assignment
        ? `/api/garbage/assignments/${assignment.id}`
        : '/api/garbage/assignments';
      const res = await fetch(url, {
        method: assignment ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (res.status === 409) {
        // ทั้งชนคีย์ธรรมชาติและฟอร์มค้าง (สายถูกสลับลำดับจุดไปแล้ว) มาทางนี้ — ข้อความจากเซิร์ฟเวอร์บอกเองว่าเคสไหน
        throw new Error(json?.error || 'ข้อมูลเปลี่ยนไปแล้ว — ปิดหน้าต่างนี้แล้วเปิดใหม่');
      }
      if (!res.ok) throw new Error(json?.error || 'บันทึกไม่สำเร็จ');
      onSaved();
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
        <div className="text-[16px] font-bold text-[#57506A]">
          {assignment ? 'แก้งาน' : 'เพิ่มงาน'} · วัน{weekdayName(weekday)}
        </div>

        {error && (
          <div className="rounded-[14px] bg-amber-50 ring-1 ring-amber-200 p-3 text-[13px] text-amber-900">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="af-truck">เบอร์รถ</label>
            <select id="af-truck" className={inputCls} value={truckNumber}
              onChange={(e) => setTruckNumber(e.target.value)}>
              <option value="">เลือกรถ</option>
              {trucks.map((t) => <option key={t.number} value={t.number}>รถ {t.number}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="af-shift">รอบที่</label>
            <input id="af-shift" className={inputCls} type="number" min="1" value={shiftNo}
              onChange={(e) => setShiftNo(e.target.value)} />
          </div>
        </div>

        <div>
          <label className={labelCls} htmlFor="af-kind">ชนิดงาน</label>
          <select id="af-kind" className={inputCls} value={kind} onChange={(e) => setKind(e.target.value)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>{KIND_LABEL_TH[k] || 'ปกติ'}</option>
            ))}
          </select>
        </div>

        {!isDayOff && (
          <>
            <div>
              <label className={labelCls} htmlFor="af-route">สาย{needsRoute ? '' : ' (ไม่บังคับ)'}</label>
              <select id="af-route" className={inputCls} value={routeCode}
                onChange={(e) => { setRouteCode(e.target.value); setStopTimes([]); }}>
                <option value="">ไม่ระบุสาย</option>
                {routes.map((r) => <option key={r.code} value={r.code}>{r.code} · {r.name}</option>)}
              </select>
              {routes.length === 0 ? (
                <p className="mt-1 text-[11.5px] text-amber-700">
                  โหลดรายการสายไม่ได้ — ปิดหน้าต่างนี้แล้วรีเฟรชหน้า ถ้ายังไม่ได้แปลว่ายังไม่มีสิทธิ์หน้านี้
                </p>
              ) : (
                <p className="mt-1 text-[11.5px] text-[#8A8398]">
                  เลือกสายก่อน แล้วช่องตั้งเวลาถึงแต่ละจุดจะขึ้นด้านล่าง
                </p>
              )}
            </div>

            {kind === 'substitute' && (
              <div>
                <label className={labelCls} htmlFor="af-cover">แทนสาย</label>
                <select id="af-cover" className={inputCls} value={coverForRouteCode}
                  onChange={(e) => setCoverForRouteCode(e.target.value)}>
                  <option value="">เลือกสายที่แทน</option>
                  {routes.map((r) => <option key={r.code} value={r.code}>{r.code}</option>)}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="af-start">เวลาเริ่ม</label>
                <input id="af-start" className={inputCls} value={startText} placeholder="4.00"
                  onChange={(e) => setStartText(e.target.value)} />
              </div>
              <div>
                <label className={labelCls} htmlFor="af-end">เวลาสิ้นสุด</label>
                <input id="af-end" className={inputCls} value={endText} placeholder="9.20"
                  onChange={(e) => setEndText(e.target.value)} />
              </div>
            </div>

            {selectedRoute && (
              <StopTimesEditor route={selectedRoute} value={stopTimes} onChange={setStopTimes}
                startMin={toMin(startText)} endMin={toMin(endText)} />
            )}
          </>
        )}

        <div>
          <label className={labelCls} htmlFor="af-label">ป้ายกำกับ (ไม่บังคับ)</label>
          <input id="af-label" className={inputCls} value={label} placeholder="เช่น วันตลาดนัดพิเศษ"
            onChange={(e) => setLabel(e.target.value)} />
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" className={primaryBtnCls} onClick={save} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
          <button type="button" className={ghostBtnCls} onClick={onClose} disabled={saving}>ยกเลิก</button>
        </div>
      </div>
    </div>
  );
}
