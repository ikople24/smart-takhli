import React, { useEffect, useState } from "react";
import Image from "next/image";
import { UserButton, useUser, SignInButton, useAuth } from "@clerk/nextjs";
import AdminDropdownMenu from "./AdminDropdownMenu";

// รายการหน้าทั้งหมด
const ALL_PAGES = [
  { path: '/admin', label: '🛠 ตั้งค่าหน้าจอ' },
  { path: '/admin/register-user', label: '👥 จัดการผู้ใช้งาน' },
  { path: '/admin/manage-complaints', label: '📋 จัดการเรื่องร้องเรียน' },
  { path: '/admin/dashboard', label: '📊 แดชบอร์ด' },
  { path: '/admin/smart-health', label: '🟣 smart-health' },
  { path: '/admin/smart-health-delivery', label: '📦 smart-health ส่งของ' },
  { path: '/admin/smart-health-return', label: '↩️ smart-health รับคืน' },
  { path: '/admin/education-map', label: '🏫 smart-school' },
  { path: '/admin/manage-activities', label: '📅 จัดการกิจกรรม' },
  { path: '/admin/feedback-analysis', label: '📈 วิเคราะห์ความคิดเห็น' },
  { path: '/user/satisfaction', label: '⭐ ประเมินความพึงพอใจ' },
];

const TopNavbar = () => {
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const [allowedPages, setAllowedPages] = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);

  const userRole = user?.publicMetadata?.role || "admin";
  const isSuperAdmin = userRole === "superadmin";
  const isAdmin = userRole === "admin" || isSuperAdmin;

  // ดึง allowedPages จาก MongoDB
  useEffect(() => {
    const fetchAllowedPages = async () => {
      if (!user) {
        setMenuLoading(false);
        return;
      }

      try {
        const token = await getToken();
        const res = await fetch('/api/users/get-by-clerkId', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (data.user?.allowedPages) {
          setAllowedPages(data.user.allowedPages);
        }
      } catch (error) {
        console.error("Error fetching allowed pages:", error);
      } finally {
        setMenuLoading(false);
      }
    };

    fetchAllowedPages();
  }, [user, getToken]);

  // เมนูตาม role และ allowedPages จาก MongoDB
  const getMenuLinks = () => {
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
    if (isAdmin) {
      return ALL_PAGES;
    }
    
    return [
      { path: "/admin/register-user", label: "👤 ลงทะเบียน" },
    ];
  };

  return (
    <header className="w-full min-w-[320px] bg-white/30 backdrop-blur-md border-b border-white/40 shadow-md px-4 py-4 flex items-center justify-center sticky top-0 z-50">
      <div className="absolute left-4">
        <AdminDropdownMenu
          show={isSignedIn && (isAdmin || userRole === "user")}
          links={getMenuLinks()}
          loading={menuLoading}
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
                <span className={`font-medium ${
                  isSuperAdmin ? 'text-amber-600' : 
                  isAdmin ? 'text-green-600' : 'text-blue-600'
                }`}>
                  {isSuperAdmin ? '👑 Super Admin' : 
                   isAdmin ? '🛡️ Admin' : 
                   userRole || "User"}
                </span>
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
