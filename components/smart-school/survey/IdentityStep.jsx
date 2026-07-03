import React, { useState } from 'react';
import { isValidCitizenId } from '@/lib/smart-school/citizenId';

// ขั้นที่ 1: ระบุตัวตน — เลข 13 หลักคือ credential (ไม่ใช้เบอร์โทร
// เพราะหลายคนในบ้านใช้เบอร์ร่วมกัน แยกตัวบุคคลไม่ได้)
export default function IdentityStep({ onDone, disabled }) {
  const [mode, setMode] = useState(null); // 'new' | 'renewal'
  const [citizenId, setCitizenId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lookupState, setLookupState] = useState(null); // null | 'notfound' | { result }
  const [searchName, setSearchName] = useState('');
  const [searchResults, setSearchResults] = useState(null); // null | []
  const [selectedRef, setSelectedRef] = useState(null);

  const idValid = isValidCitizenId(citizenId);

  const post = async (url, body) => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch {
      return { ok: false, status: 0, data: { message: 'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่' } };
    }
  };

  // รายเก่า: ค้นด้วยเลขบัตร
  const handleLookupById = async () => {
    setError('');
    setLoading(true);
    const { ok, data } = await post('/api/smart-school/lookup', { citizenId });
    setLoading(false);
    if (!ok) return setError(data.message || 'เกิดข้อผิดพลาด');
    setLookupState(data.found ? { result: data.result } : 'notfound');
  };

  // เจอด้วยเลขบัตร → ผู้ใช้กดยืนยัน "ใช่ฉัน" → ดึงข้อมูลเต็ม
  const handleConfirmSelf = async () => {
    setError('');
    setLoading(true);
    const { ok, data } = await post('/api/smart-school/verify', { citizenId });
    setLoading(false);
    if (!ok) return setError(data.message || 'ยืนยันไม่สำเร็จ');
    onDone({ citizenId, applicant: data.applicant, prevApplication: data.application });
  };

  // ไม่เจอ → ค้นชื่อ (เฉพาะ record ที่ยังไม่ผูกเลขบัตร)
  const handleSearchName = async () => {
    setError('');
    setLoading(true);
    const { ok, data } = await post('/api/smart-school/lookup', { name: searchName });
    setLoading(false);
    if (!ok) return setError(data.message || 'เกิดข้อผิดพลาด');
    setSearchResults(data.results || []);
  };

  // เลือกรายการจากการค้นชื่อ → ผูกเลขบัตรของตนให้ record นั้น
  const handleClaim = async () => {
    setError('');
    setLoading(true);
    const { ok, data } = await post('/api/smart-school/verify', {
      citizenId,
      applicantRef: selectedRef,
    });
    setLoading(false);
    if (!ok) return setError(data.message || 'ยืนยันไม่สำเร็จ');
    onDone({ citizenId, applicant: data.applicant, prevApplication: data.application });
  };

  const handleNewApplicant = async () => {
    setError('');
    // กันเลขซ้ำ: ถ้าเลขนี้มีในระบบแล้ว พาเข้าเส้นทางรายเก่า
    setLoading(true);
    const { ok, data } = await post('/api/smart-school/lookup', { citizenId });
    if (!ok) { setLoading(false); return setError(data.message || 'เกิดข้อผิดพลาด'); }
    if (data.found) {
      setMode('renewal');
      setLookupState({ result: data.result });
      setError('เลขบัตรนี้เคยยื่นแล้ว — ระบบพาเข้าเส้นทางรายเก่าให้');
      setLoading(false);
      return;
    }
    setLoading(false);
    onDone({ citizenId, applicant: null, prevApplication: null });
  };

  return (
    <div className="space-y-4">
      <div className="alert alert-info text-xs">
        ทุนพิจารณา 1 คนต่อครัวเรือนต่อปี และหมุนเวียนผู้รับในปีถัดไป
      </div>

      <div className="space-y-2">
        <label className="font-extrabold text-sm text-gray-600">ท่านเคยยื่นแบบสำรวจนี้มาก่อนหรือไม่</label>
        <div className="flex gap-2 justify-center">
          <button type="button" disabled={disabled || loading}
            className={`btn btn-sm rounded-full flex-1 ${mode === 'new' ? 'btn-info' : 'btn-outline'}`}
            onClick={() => { setMode('new'); setLookupState(null); setSearchResults(null); setSelectedRef(null); setError(''); }}>
            รายใหม่ (ครั้งแรก)
          </button>
          <button type="button" disabled={disabled || loading}
            className={`btn btn-sm rounded-full flex-1 ${mode === 'renewal' ? 'btn-info' : 'btn-outline'}`}
            onClick={() => { setMode('renewal'); setLookupState(null); setSearchResults(null); setSelectedRef(null); setError(''); }}>
            รายเก่า (เคยยื่นแล้ว)
          </button>
        </div>
      </div>

      {mode && (
        <div className="space-y-2">
          <label className="font-extrabold text-sm text-gray-600">เลขบัตรประชาชน 13 หลัก</label>
          <input type="tel" className="input input-bordered w-full" maxLength={13}
            placeholder="กรอกเลขบัตรประชาชน 13 หลัก" value={citizenId} disabled={disabled}
            onChange={(e) => {
              setCitizenId(e.target.value.replace(/\D/g, ''));
              setLookupState(null);
              setSearchResults(null);
              setSelectedRef(null);
              setError('');
            }} />
          {citizenId.length === 13 && !idValid && (
            <p className="text-xs text-error">เลขบัตรประชาชนไม่ถูกต้อง กรุณาตรวจสอบ</p>
          )}
        </div>
      )}

      {mode === 'new' && (
        <button type="button" className="btn btn-primary w-full" disabled={!idValid || loading || disabled}
          onClick={handleNewApplicant}>
          {loading ? <span className="loading loading-spinner loading-sm" /> : 'ถัดไป'}
        </button>
      )}

      {mode === 'renewal' && !lookupState && (
        <button type="button" className="btn btn-primary w-full" disabled={!idValid || loading || disabled}
          onClick={handleLookupById}>
          {loading ? <span className="loading loading-spinner loading-sm" /> : 'ค้นหาข้อมูลเดิม'}
        </button>
      )}

      {mode === 'renewal' && lookupState && lookupState !== 'notfound' && (
        <div className="card bg-base-200 p-3 space-y-2">
          <p className="text-sm">
            พบข้อมูลของ <span className="font-bold">{lookupState.result.maskedName}</span>
            {lookupState.result.lastYear ? ` (ยื่นล่าสุดปีงบ ${lookupState.result.lastYear})` : ''}
          </p>
          <button type="button" className="btn btn-success btn-sm w-full" disabled={loading || disabled}
            onClick={handleConfirmSelf}>
            ใช่ ข้อมูลของฉัน — ดึงข้อมูลเดิมมาแก้ไข
          </button>
        </div>
      )}

      {mode === 'renewal' && lookupState === 'notfound' && (
        <div className="card bg-base-200 p-3 space-y-2">
          <p className="text-sm">ไม่พบเลขบัตรนี้ในระบบ — ข้อมูลปีก่อนอาจยังไม่ถูกผูกเลขบัตร ลองค้นด้วยชื่อ-นามสกุล</p>
          <div className="flex gap-2">
            <input type="text" className="input input-bordered input-sm flex-1"
              placeholder="ชื่อ-นามสกุลที่เคยยื่น" value={searchName} disabled={disabled}
              onChange={(e) => setSearchName(e.target.value)} />
            <button type="button" className="btn btn-sm btn-primary"
              disabled={searchName.trim().length < 2 || loading || disabled}
              onClick={handleSearchName}>ค้นหา</button>
          </div>

          {searchResults && searchResults.length > 0 && (
            <div className="space-y-1">
              {searchResults.map((r) => (
                <label key={r.ref} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" className="radio radio-sm" name="claim"
                    checked={selectedRef === r.ref} onChange={() => setSelectedRef(r.ref)} />
                  {r.maskedName}{r.lastYear ? ` (ปีงบ ${r.lastYear})` : ''}
                </label>
              ))}
              <button type="button" className="btn btn-success btn-sm w-full"
                disabled={!selectedRef || loading || disabled} onClick={handleClaim}>
                ใช่ ข้อมูลของฉัน — ผูกเลขบัตรและดึงข้อมูลเดิม
              </button>
            </div>
          )}
          {searchResults && searchResults.length === 0 && (
            <p className="text-xs text-gray-500">ไม่พบรายการ</p>
          )}

          <button type="button" className="btn btn-outline btn-sm w-full" disabled={!idValid || loading || disabled}
            onClick={handleNewApplicant}>
            หาไม่เจอ — ยื่นเป็นรายใหม่
          </button>
        </div>
      )}

      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
