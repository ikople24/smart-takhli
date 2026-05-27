// stores/usePermissionsStore.ts
// Zustand store สำหรับเก็บสิทธิ์ผู้ใช้ที่ได้จาก verify-app-access
// ให้ทั้ง _app.tsx (writer) และ LayoutAdmin / TopNavbar (readers) เข้าถึงข้อมูลชุดเดียวกัน
// โดยไม่ต้องเรียก API ซ้ำ

import { create } from 'zustand';
import type { Role } from '@/lib/permissions';

interface PermissionsStore {
  /** role จาก Clerk publicMetadata */
  role: Role;
  /** allowedPages จาก MongoDB (empty = ยังไม่ set = ใช้ default ตาม role) */
  allowedPages: string[];
  /** user มีสิทธิ์เข้า app นี้หรือไม่ */
  hasAppAccess: boolean;
  /** ข้อมูล permissions ถูก populate แล้วหรือยัง */
  isLoaded: boolean;

  setPermissions: (role: Role, allowedPages: string[], hasAppAccess: boolean) => void;
  reset: () => void;
}

export const usePermissionsStore = create<PermissionsStore>((set) => ({
  role: 'admin',
  allowedPages: [],
  hasAppAccess: false,
  isLoaded: false,

  setPermissions: (role, allowedPages, hasAppAccess) =>
    set({ role, allowedPages, hasAppAccess, isLoaded: true }),

  reset: () =>
    set({ role: 'admin', allowedPages: [], hasAppAccess: false, isLoaded: false }),
}));
