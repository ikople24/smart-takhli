// /admin/superadmin/task-settings — วันหยุดราชการ + กำหนดปิดเรื่องตามชนิดงาน (superadmin เท่านั้น)
// กำหนดปิดเรื่องนับวันทำการ จ.–ศ. ไม่รวมวันหยุดในหน้านี้ (lib/tasks/businessDays.js) · เกณฑ์รับเรื่อง 24 ชม. ไม่สนวันหยุด
// guard แบบเดียวกับ department-heads.tsx: ไม่ใช่ superadmin → redirect /admin (PUT ฝั่ง API เช็ค superadmin ซ้ำ)
import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '@clerk/nextjs';
import { TaskSettingsPanel } from '@/components/tasks';

export default function TaskSettingsPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const isSuperAdmin = isLoaded && user?.publicMetadata?.role === 'superadmin';

  useEffect(() => {
    if (isLoaded && !isSuperAdmin) router.replace('/admin');
  }, [isLoaded, isSuperAdmin, router]);

  if (!isSuperAdmin) return null;

  return (
    <div className="mx-auto max-w-4xl font-tk-sans text-tk-ink">
      <TaskSettingsPanel />
    </div>
  );
}
