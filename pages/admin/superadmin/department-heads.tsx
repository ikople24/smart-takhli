// /admin/superadmin/department-heads — ตั้งค่าหัวหน้ากอง (superadmin เท่านั้น)
// ใครเป็นหัวหน้ากอง = มอบหมาย/โอนงานในกองได้ (โมดูลงานเจ้าหน้าที่ lib/tasks/roles.js) — ไม่ตั้งค่าระบบดูจากตำแหน่ง
// guard แบบเดียวกับ line-settings.jsx: ไม่ใช่ superadmin → redirect /admin
import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '@clerk/nextjs';
import { HeadsPanel } from '@/components/tasks';

export default function DepartmentHeadsPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const isSuperAdmin = isLoaded && user?.publicMetadata?.role === 'superadmin';

  useEffect(() => {
    if (isLoaded && !isSuperAdmin) router.replace('/admin');
  }, [isLoaded, isSuperAdmin, router]);

  if (!isSuperAdmin) return null;

  return (
    <div className="mx-auto max-w-4xl font-tk-sans text-tk-ink">
      <p className="mb-4 text-[13px] text-tk-ink-4">
        หัวหน้ากองเท่านั้นที่ <b>มอบหมาย</b>งานจากกองงานรอรับให้คนอื่น และ <b>โอน</b>งานของเจ้าหน้าที่ในกองได้ · เจ้าหน้าที่ทั่วไปรับงานเองได้แต่โอนต้องผ่าน &ldquo;ขอโอนงาน&rdquo; ·
        ถ้าไม่ตั้งค่า ระบบถือว่าเป็นหัวหน้าเมื่อตำแหน่งมีคำว่า ผู้อำนวยการ / หัวหน้า / ผอ. / ปลัด
      </p>
      <HeadsPanel defaultOpen standalone />
    </div>
  );
}
