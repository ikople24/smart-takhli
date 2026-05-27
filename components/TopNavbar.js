import React, { useEffect, useState } from "react";
import Image from "next/image";
import { UserButton, useUser, SignInButton, useAuth } from "@clerk/nextjs";
import AdminDropdownMenu from "./AdminDropdownMenu";
import { ALL_PAGES as ALL_PAGES_DATA } from "@/lib/permissions";

// แปลง PagePermission → { path, label } ที่ AdminDropdownMenu รับได้
// กรอง hideFromMenu ออก — หน้าเหล่านั้นเข้าถึงผ่าน internal link ไม่ใช่ nav dropdown
const ALL_PAGES = ALL_PAGES_DATA
  .filter((p) => !p.hideFromMenu)
  .map((p) => ({ path: p.path, label: `${p.icon} ${p.label}` }));

const TopNavbar = () => {
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const [allowedPages, setAllowedPages] = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [hasAppAccess, setHasAppAccess] = useState(false); // เพิ่ม state สำหรับตรวจสอบสิทธิ์ app

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
          console.log("🚫 No app access - hiding menu");
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
    if (!hasAppAccess) {
      return [];
    }
    
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
          disabled={!hasAppAccess && !menuLoading} // ปิดเมนูถ้าไม่มีสิทธิ์
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
