import "@/styles/globals.css";
import "sweetalert2/dist/sweetalert2.min.css";
import type { AppProps } from "next/app";
import { ClerkProvider, useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { useEffect, useState } from "react";

// ประเภทของการปฏิเสธการเข้าถึง
type AccessDeniedReason = 'no_access' | 'user_not_registered' | 'app_mismatch' | 'no_app_assigned' | null;

function AppContent({ Component, pageProps }: AppProps) {
  const { userId, isLoaded, getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState(true);
  const [checking, setChecking] = useState(true);
  const [deniedReason, setDeniedReason] = useState<AccessDeniedReason>(null);
  const [deniedMessage, setDeniedMessage] = useState<string>("");

  const isProtected = ["/admin", "/user"].some((path) =>
    router.pathname.startsWith(path)
  );

  const isSuperAdminPage = router.pathname.startsWith("/admin/superadmin");

  useEffect(() => {
    if (isLoaded && isProtected && !userId) {
      router.replace("/");
    }
  }, [isLoaded, isProtected, userId, router]);

  // ตรวจสอบสิทธิ์การเข้าหน้า (ตรวจสอบ appId และ allowedPages จาก MongoDB)
  useEffect(() => {
    const checkAccess = async () => {
      if (!isLoaded || !user || !isProtected) {
        setHasAccess(true);
        setChecking(false);
        return;
      }

      const userRole = user.publicMetadata?.role as string || 'admin';

      try {
        // ขั้นตอนที่ 1: ตรวจสอบว่า user อยู่ใน MongoDB และ appId ตรงกันหรือไม่
        const token = await getToken();
        const verifyRes = await fetch('/api/auth/verify-app-access', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const verifyData = await verifyRes.json();

        // ถ้าไม่มีสิทธิ์เข้า app นี้
        if (!verifyData.hasAccess) {
          setHasAccess(false);
          setDeniedReason(verifyData.reason || 'no_access');
          setDeniedMessage(verifyData.message || 'ไม่มีสิทธิ์เข้าถึง');
          setChecking(false);
          return;
        }

        // Super Admin เข้าได้ทุกหน้า (ตรวจสอบหลังจาก verify app access)
        if (userRole === 'superadmin') {
          setHasAccess(true);
          setChecking(false);
          return;
        }

        // หน้า Super Admin เฉพาะ superadmin เท่านั้น
        if (isSuperAdminPage) {
          setHasAccess(false);
          setDeniedReason('no_access');
          setDeniedMessage('หน้านี้สำหรับ Super Admin เท่านั้น');
          setChecking(false);
          return;
        }

        // ขั้นตอนที่ 2: ตรวจสอบ allowedPages
        const allowedPages = verifyData.user?.allowedPages || [];

        // ถ้ายังไม่ได้ตั้งค่า allowedPages = เข้าได้ทุกหน้า (default)
        if (!allowedPages || allowedPages.length === 0) {
          setHasAccess(true);
          setChecking(false);
          return;
        }

        // ตรวจสอบว่าหน้าปัจจุบันอยู่ใน allowedPages หรือไม่
        const currentPath = router.pathname;
        const isAllowed = allowedPages.some((allowedPath: string) => 
          currentPath === allowedPath || currentPath.startsWith(allowedPath + '/')
        );

        if (!isAllowed) {
          setDeniedReason('no_access');
          setDeniedMessage('คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
        }
        setHasAccess(isAllowed);
      } catch (error) {
        console.error("Error checking access:", error);
        setHasAccess(true); // Default to allow on error
      } finally {
        setChecking(false);
      }
    };

    checkAccess();
  }, [isLoaded, user, router.pathname, isProtected, isSuperAdminPage, getToken]);

  if (isProtected && (!isLoaded || !userId || checking)) {
    return <div className="p-8 text-center">กำลังโหลด...</div>;
  }

  if (isProtected && !hasAccess) {
    // แสดงข้อความตามประเภทการปฏิเสธ
    const getAccessDeniedContent = () => {
      switch (deniedReason) {
        case 'user_not_registered':
          return {
            icon: (
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            ),
            bgColor: 'bg-amber-50',
            iconBg: 'bg-amber-100',
            title: 'ยังไม่ได้ลงทะเบียน',
            titleColor: 'text-amber-800',
            message: deniedMessage,
            messageColor: 'text-amber-600',
            hint: 'กรุณาติดต่อผู้ดูแลระบบเพื่อลงทะเบียนเข้าใช้งาน',
          };
        case 'no_app_assigned':
          return {
            icon: (
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            ),
            bgColor: 'bg-blue-50',
            iconBg: 'bg-blue-100',
            title: 'รอการอนุมัติ',
            titleColor: 'text-blue-800',
            message: deniedMessage,
            messageColor: 'text-blue-600',
            hint: 'บัญชีของคุณยังไม่ได้รับการกำหนดสิทธิ์การใช้งาน กรุณารอผู้ดูแลระบบอนุมัติ',
          };
        case 'app_mismatch':
          return {
            icon: (
              <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            ),
            bgColor: 'bg-orange-50',
            iconBg: 'bg-orange-100',
            title: 'ไม่มีสิทธิ์เข้าแอปนี้',
            titleColor: 'text-orange-800',
            message: deniedMessage,
            messageColor: 'text-orange-600',
            hint: 'บัญชีของคุณไม่ได้ลงทะเบียนสำหรับแอปพลิเคชันนี้',
          };
        default:
          return {
            icon: (
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ),
            bgColor: 'bg-red-50',
            iconBg: 'bg-red-100',
            title: 'ไม่มีสิทธิ์เข้าถึง',
            titleColor: 'text-red-800',
            message: deniedMessage || 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้',
            messageColor: 'text-red-600',
            hint: 'กรุณาติดต่อผู้ดูแลระบบหากคุณต้องการสิทธิ์เข้าถึง',
          };
      }
    };

    const content = getAccessDeniedContent();

    return (
      <Layout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className={`text-center p-8 ${content.bgColor} rounded-2xl max-w-md mx-4`}>
            <div className={`w-16 h-16 mx-auto mb-4 ${content.iconBg} rounded-full flex items-center justify-center`}>
              {content.icon}
            </div>
            <h2 className={`text-xl font-bold ${content.titleColor} mb-2`}>{content.title}</h2>
            <p className={`${content.messageColor} mb-4`}>{content.message}</p>
            <p className="text-sm text-gray-500 mb-4">
              {content.hint}
            </p>
            <button
              onClick={() => router.push('/')}
              className="btn btn-error btn-outline"
            >
              กลับหน้าหลัก
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}

export default function App(props: AppProps) {
  return (
    <ClerkProvider {...props.pageProps}>
      <AppContent {...props} />
    </ClerkProvider>
  );
}
