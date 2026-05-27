import React, { useEffect, useState } from "react";
import { UserButton, useUser, SignInButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/router";
import AdminDropdownMenu from "./AdminDropdownMenu";
import { NotificationBell } from "@/components/NotificationBell";
import { ClipboardDocumentListIcon } from "@heroicons/react/24/outline";
import { ALL_PAGES as ALL_PAGES_DATA } from "@/lib/permissions";

// แปลง PagePermission → { path, label } ที่ AdminDropdownMenu รับได้
// กรอง hideFromMenu ออก — หน้าเหล่านั้นเข้าถึงผ่าน internal link ไม่ใช่ nav dropdown
const ALL_PAGES = ALL_PAGES_DATA
  .filter((p) => !p.hideFromMenu)
  .map((p) => ({ path: p.path, label: `${p.icon} ${p.label}` }));

const TopNavbar = () => {
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();
  const [allowedPages, setAllowedPages] = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [hasAppAccess, setHasAppAccess] = useState(false);

  const userRole = user?.publicMetadata?.role || "admin";
  const isSuperAdmin = userRole === "superadmin";
  const isAdmin = userRole === "admin" || isSuperAdmin;

  // ดึง allowedPages และตรวจสอบสิทธิ์ app
  useEffect(() => {
    const fetchAccessAndPages = async () => {
      if (!user) {
        setMenuLoading(false);
        setHasAppAccess(false);
        return;
      }

      try {
        const token = await getToken();

        // ตรวจสอบสิทธิ์ app ก่อน
        const verifyRes = await fetch('/api/auth/verify-app-access', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const verifyData = await verifyRes.json();

        // ถ้าไม่มีสิทธิ์เข้า app → ซ่อนเมนูทั้งหมด
        if (!verifyData.success || verifyData.hasAccess !== true) {
          setHasAppAccess(false);
          setAllowedPages([]);
          setMenuLoading(false);
          return;
        }

        // มีสิทธิ์เข้า app
        setHasAppAccess(true);

        // ดึง allowedPages จาก response
        if (verifyData.user?.allowedPages) {
          setAllowedPages(verifyData.user.allowedPages);
        }
      } catch (error) {
        console.error("Error fetching access:", error);
        setHasAppAccess(false);
        setAllowedPages([]);
      } finally {
        setMenuLoading(false);
      }
    };

    fetchAccessAndPages();
  }, [user, getToken]);

  // เมนูตาม role และ allowedPages จาก MongoDB
  const getMenuLinks = () => {
    // ถ้าไม่มีสิทธิ์เข้า app → ไม่แสดงเมนูเลย
    if (!hasAppAccess) return [];

    // Super Admin เห็นทุกหน้า + หน้า Super Admin
    if (isSuperAdmin) {
      return [
        ...ALL_PAGES,
        { path: "/admin/superadmin", label: "👑 Super Admin" },
      ];
    }

    // ถ้ามี allowedPages ที่ตั้งค่าไว้ ให้ใช้
    if (allowedPages && allowedPages.length > 0) {
      return ALL_PAGES.filter(page => allowedPages.includes(page.path));
    }

    // Default: Admin เห็นทุกหน้า, User เห็นแค่ลงทะเบียน
    if (isAdmin) return ALL_PAGES;

    return [{ path: "/admin/register-user", label: "👤 ลงทะเบียน" }];
  };

  const isOnMyTasks = router.pathname === '/admin/my-tasks';

  return (
    <header className="w-full min-w-[320px] bg-base-100/90 backdrop-blur-md border-b border-base-300 px-4 h-14 flex items-center justify-between sticky top-0 z-50 shadow-sm">
      {/* Left: Hamburger dropdown (ใช้กับหน้าที่ไม่มี Sidebar) */}
      <div className="flex items-center w-10">
        <AdminDropdownMenu
          show={isSignedIn && (isAdmin || userRole === "user")}
          links={getMenuLinks()}
          loading={menuLoading}
          disabled={!hasAppAccess && !menuLoading}
        />
      </div>

      {/* Center: Brand */}
      <Link
        href="/"
        className="absolute left-1/2 -translate-x-1/2 text-base font-bold text-primary tracking-widest"
      >
        SMART-TAKHLI
      </Link>

      {/* Right: Notification + My Tasks + User Avatar */}
      <div className="flex items-center gap-1 ml-auto">
        {isSignedIn && isAdmin && (
          <>
            {/* My Tasks shortcut */}
            <Link
              href="/admin/my-tasks"
              className={`btn btn-ghost btn-sm btn-circle tooltip tooltip-bottom ${isOnMyTasks ? 'text-primary' : ''}`}
              data-tip="KPI งานของฉัน"
            >
              <ClipboardDocumentListIcon className="w-5 h-5" />
            </Link>

            {/* Notification Bell */}
            <NotificationBell />
          </>
        )}

        {/* User button / Sign-in */}
        {isSignedIn ? (
          <UserButton afterSignOutUrl="/" />
        ) : (
          <SignInButton mode="modal">
            <button className="btn btn-primary btn-sm rounded-full">
              เข้าสู่ระบบ
            </button>
          </SignInButton>
        )}
      </div>
    </header>
  );
};

export default TopNavbar;
