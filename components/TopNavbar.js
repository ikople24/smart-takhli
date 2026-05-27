import React from "react";
import { UserButton, useUser, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/router";
import { NotificationBell } from "@/components/NotificationBell";
import { ClipboardDocumentListIcon } from "@heroicons/react/24/outline";

const TopNavbar = () => {
  const { isSignedIn, user } = useUser();
  const router = useRouter();

  const userRole = user?.publicMetadata?.role || "admin";
  const isAdmin = userRole === "admin" || userRole === "superadmin";
  const isOnMyTasks = router.pathname === '/admin/my-tasks';

  return (
    <header className="w-full min-w-[320px] bg-base-100/90 backdrop-blur-md border-b border-base-300 px-4 h-14 flex items-center justify-between sticky top-0 z-50 shadow-sm">
      {/* Left: placeholder (sidebar handles navigation) */}
      <div className="w-10" />

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
