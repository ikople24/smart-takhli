// /admin/superadmin/line-settings — ตั้งค่า LINE OA (superadmin เท่านั้น)
// ตั้ง Group ID ของกลุ่มเจ้าหน้าที่ที่รับแจ้งเตือนเรื่องร้องเรียน + ทดสอบส่งข้อความ

import { useCallback, useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/router';
import Swal from 'sweetalert2';

export default function LineSettingsPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const isSuperAdmin = isLoaded && user?.publicMetadata?.role === 'superadmin';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [groupId, setGroupId] = useState('');
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (isLoaded && !isSuperAdmin) router.replace('/admin');
  }, [isLoaded, isSuperAdmin, router]);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/superadmin/line-settings');
      const data = await res.json();
      if (data.success) {
        setInfo(data);
        setGroupId(data.adminGroupId || '');
      }
    } catch (err) {
      console.error('โหลดการตั้งค่าไม่สำเร็จ:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) fetchSettings();
  }, [isSuperAdmin, fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/superadmin/line-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminGroupId: groupId.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'บันทึกไม่สำเร็จ');
      await Swal.fire({ icon: 'success', title: 'บันทึกแล้ว', timer: 1500, showConfirmButton: false });
      fetchSettings();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/superadmin/line-settings', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'ส่งไม่สำเร็จ');
      Swal.fire({ icon: 'success', title: 'ส่งข้อความทดสอบแล้ว', text: 'ตรวจสอบในกลุ่ม LINE ได้เลย' });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'ส่งไม่สำเร็จ', text: err.message });
    } finally {
      setTesting(false);
    }
  };

  if (!isLoaded || !isSuperAdmin || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const StatusBadge = ({ ok, label }) => (
    <div className={`badge gap-1 ${ok ? 'badge-success' : 'badge-error'} badge-outline`}>
      {ok ? '✓' : '✗'} {label}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-green-400 to-green-600 rounded-xl shadow-lg">
            <span className="text-2xl">💬</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">ตั้งค่า LINE OA</h1>
            <p className="text-purple-200">กลุ่มรับแจ้งเตือนเรื่องร้องเรียน (เรื่องใหม่ / ปิดงาน)</p>
          </div>
        </div>

        {/* สถานะ env */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 mb-6">
          <h2 className="text-white font-bold mb-3">สถานะการเชื่อมต่อ</h2>
          <div className="flex flex-wrap gap-2">
            <StatusBadge ok={info?.tokenSet} label="LINE_CHANNEL_ACCESS_TOKEN" />
            <StatusBadge ok={info?.secretSet} label="LINE_CHANNEL_SECRET" />
            <StatusBadge ok={info?.envGroupIdSet} label="env LINE_ADMIN_GROUP_ID (fallback)" />
          </div>
          <p className="text-sm text-purple-200 mt-3">
            Group ID ที่ใช้งานจริงตอนนี้:{' '}
            <code className="bg-black/30 px-2 py-0.5 rounded text-green-300">
              {info?.effectiveGroupId
                ? `...${info.effectiveGroupId.slice(-8)}`
                : 'ยังไม่ได้ตั้งค่า — การแจ้งเตือนเข้ากลุ่มถูกข้าม'}
            </code>
          </p>
        </div>

        {/* ฟอร์ม Group ID */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 mb-6">
          <h2 className="text-white font-bold mb-3">LINE Group ID ของกลุ่มเจ้าหน้าที่</h2>
          <input
            type="text"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            placeholder="Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            className="input input-bordered w-full font-mono text-sm"
          />
          <p className="text-xs text-purple-300 mt-2">
            เว้นว่างแล้วบันทึก = ล้างค่า (ระบบจะ fallback ไปใช้ env LINE_ADMIN_GROUP_ID ถ้ามี)
          </p>
          {info?.updatedAt && (
            <p className="text-xs text-purple-300 mt-1">
              บันทึกล่าสุด: {new Date(info.updatedAt).toLocaleString('th-TH')}
            </p>
          )}
          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} disabled={saving} className="btn btn-primary">
              {saving ? <span className="loading loading-spinner loading-sm" /> : 'บันทึก'}
            </button>
            <button onClick={handleTest} disabled={testing} className="btn btn-outline btn-success">
              {testing ? <span className="loading loading-spinner loading-sm" /> : '🔔 ส่งข้อความทดสอบเข้ากลุ่ม'}
            </button>
          </div>
        </div>

        {/* วิธีหา Group ID */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20">
          <h2 className="text-white font-bold mb-3">วิธีหา Group ID</h2>
          <ol className="list-decimal list-inside text-sm text-purple-100 space-y-2">
            <li>
              เปิดใช้ <strong>&quot;Allow bot to join group chats&quot;</strong> ใน LINE Official
              Account Manager (Settings → Response — ค่าเริ่มต้นปิดอยู่)
            </li>
            <li>เชิญบอท (LINE OA ของเทศบาล) เข้ากลุ่มเจ้าหน้าที่ — บอทจะตอบ Group ID ในกลุ่มทันที</li>
            <li>
              หรือพิมพ์ <code className="bg-black/30 px-1.5 py-0.5 rounded">groupid</code> ในกลุ่มที่มีบอทอยู่
            </li>
            <li>คัดลอก Group ID มาวางในช่องด้านบน แล้วกดบันทึก → กดส่งข้อความทดสอบ</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
