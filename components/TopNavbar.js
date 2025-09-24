import React from "react";
import Image from "next/image";
import { UserButton, useUser, SignInButton } from "@clerk/nextjs";
import AdminDropdownMenu from "./AdminDropdownMenu";

const TopNavbar = () => {
  const { isSignedIn, user } = useUser();

  return (
    <header className="w-full min-w-[320px] bg-white/30 backdrop-blur-md border-b border-white/40 shadow-md px-4 py-4 flex items-center justify-center sticky top-0 z-50">
      <div className="absolute left-4">
        <AdminDropdownMenu
          show={user?.publicMetadata?.role === "admin" || user?.publicMetadata?.role === "user"}
          links={[
            ...(user?.publicMetadata?.role === "admin"
              ? [
                  { path: "/admin", label: "🛠 ตั้งค่าหน้าจอ" },
                  { path: "/admin/register-user", label: "👥 จัดการผู้ใช้งาน" },
                  { path: "/admin/manage-complaints", label: "📋 จัดการเรื่องร้องเรียน" },
                  { path: "/admin/dashboard", label: "📊 แดชบอร์ด" },
                  { path: "/admin/smart-health", label: "🟣 smart-health" },
                  { path: "/admin/education-map", label: "🏫 smart-school" },
                  { path: "/admin/feedback-analysis", label: "📊 วิเคราะห์ความคิดเห็น" },
                  { path: "/user/satisfaction", label: "📊 ประเมินความพึงพอใจ" },
                ]
              : []),
            ...(user?.publicMetadata?.role === "user" ? [] : []),
          ]}
        />
      </div>
      <div className="text-2xl font-semibold text-blue-950 flex justify-center items-center">
        <span className="text-base sm:text-lg md:text-xl lg:text-2xl">SMART-TAKHLI</span>
      </div>
      <div className="absolute right-4 flex items-center space-x-2">
        {isSignedIn ? (
          <>
            {isSignedIn && user && (
              <div className="hidden sm:flex flex-col items-end text-xs text-gray-500">
                <span className="text-sm font-medium text-gray-700">{user?.fullName || "name"}</span>
                <span className="text-green-600">{user?.publicMetadata?.role || "User"}</span>
              </div>
            )}
            <UserButton afterSignOutUrl="/" />
          </>
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
