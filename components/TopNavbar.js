import React from "react";
import Image from "next/image";
import { UserButton, useUser, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/router";
import { NotificationBell } from "@/components/NotificationBell";
import { ClipboardDocumentListIcon, Squares2X2Icon } from "@heroicons/react/24/outline";

const TopNavbar = () => {
  const { isSignedIn, user } = useUser();
  const router = useRouter();

  const userRole = user?.publicMetadata?.role || "admin";
  const isAdmin = userRole === "admin" || userRole === "superadmin";
  const isAdminRoute = router.pathname.startsWith("/admin");
  const isOnMyTasks = router.pathname === '/admin/my-tasks';

  return (
    <header className="w-full min-w-[320px] bg-base-100/90 backdrop-blur-md border-b border-base-300 px-4 h-14 flex items-center justify-between sticky top-0 z-50 shadow-sm">
      {/* Left: ปุ่มไปหน้า admin บนหน้า public / placeholder บนหน้า admin (sidebar จัดการแล้ว) */}
      {isSignedIn && isAdmin && !isAdminRoute ? (
        <Link
          href="/admin/dashboard"
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-base-content/70 hover:text-base-content hover:bg-base-200 transition-colors"
          title="ไปยังแผงควบคุม Admin"
        >
          <Squares2X2Icon className="w-5 h-5 flex-shrink-0" />
          <span className="hidden sm:inline">แผงควบคุม</span>
        </Link>
      ) : (
        <div className="w-10" />
      )}

      {/* Center: Brand */}
      <Link
        href="/"
        className="absolute left-1/2 -translate-x-1/2 font-semibold text-blue-950 text-base sm:text-lg md:text-xl lg:text-2xl"
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
            <button className="hover:ring-2 hover:ring-purple-600 transition rounded-full overflow-hidden">
              <Image
                src="/icons/icon-192x192.png"
                alt="Sign in"
                width={40}
                height={40}
                className="rounded-full object-cover"
              />
            </button>
          </SignInButton>
        )}
      </div>
    </header>
  );
};

export default TopNavbar;
