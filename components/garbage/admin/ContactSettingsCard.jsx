import { useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { inputCls, labelCls, primaryBtnCls } from '@/components/ui/adminTheme';

/** ตั้งค่าเบอร์ติดต่อที่หน้าประชาชนนำไปแสดงในแถบ "ตารางบางวันยังอยู่ระหว่างจัดทำ" */
export default function ContactSettingsCard() {
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const mountedRef = useRef(true);

  // ต้องเซ็ต true ใน effect body ด้วย ไม่ใช่แค่ false ใน cleanup —
  // StrictMode โหมด dev จะ mount→unmount→mount ถ้าไม่เซ็ตกลับจะค้างเป็น false แล้ว setState ตายเงียบทั้งหมด
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/garbage/settings');
        const json = await res.json();
        if (!alive) return;
        if (!res.ok) throw new Error(json?.error || 'โหลดค่าตั้งค่าไม่สำเร็จ');
        setPhone(json.contactPhone ?? '');
        setNote(json.contactNote ?? '');
      } catch (error) {
        if (alive) Swal.fire({ icon: 'error', title: 'โหลดค่าตั้งค่าไม่สำเร็จ', text: error.message });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/garbage/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactPhone: phone, contactNote: note }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'บันทึกไม่สำเร็จ');
      // ออกจากหน้าไปแล้วไม่ต้องเซ็ต state หรือเด้ง Swal ค้างไว้
      if (!mountedRef.current) return;
      setPhone(json.contactPhone ?? '');
      setNote(json.contactNote ?? '');
      Swal.fire({ icon: 'success', title: 'บันทึกแล้ว', timer: 1400, showConfirmButton: false });
    } catch (error) {
      if (!mountedRef.current) return;
      Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: error.message });
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[14px] font-bold text-[#57506A]">ตั้งค่าการแสดงผลหน้าประชาชน</div>
        <div className="text-[12px] text-[#8A8398]">
          เบอร์นี้จะแสดงในแถบแจ้งว่าตารางบางวันยังอยู่ระหว่างจัดทำ · เว้นว่างไว้คือไม่แสดง
        </div>
      </div>
      <div>
        <label className={labelCls} htmlFor="garbage-contact-phone">เบอร์ติดต่อ</label>
        <input id="garbage-contact-phone" className={inputCls} value={phone} disabled={loading}
          onChange={(e) => setPhone(e.target.value)} placeholder="เช่น 056-123456" />
      </div>
      <div>
        <label className={labelCls} htmlFor="garbage-contact-note">หมายเหตุ (ไม่บังคับ)</label>
        <input id="garbage-contact-note" className={inputCls} value={note} disabled={loading}
          onChange={(e) => setNote(e.target.value)} placeholder="เช่น ติดต่อในเวลาราชการ" />
      </div>
      <button type="button" className={primaryBtnCls} onClick={save} disabled={loading || saving}>
        {saving ? 'กำลังบันทึก...' : 'บันทึก'}
      </button>
    </div>
  );
}
