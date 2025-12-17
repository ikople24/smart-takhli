import "@/styles/globals.css";
import "sweetalert2/dist/sweetalert2.min.css";
import type { AppProps } from "next/app";
import { ClerkProvider, useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import { useEffect, useState } from "react";

function AppContent({ Component, pageProps }: AppProps) {
  const { userId, isLoaded, getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState(true);
  const [checking, setChecking] = useState(true);

  const isProtected = ["/admin", "/user"].some((path) =>
    router.pathname.startsWith(path)
  );

  const isSuperAdminPage = router.pathname.startsWith("/admin/superadmin");

  useEffect(() => {
    if (isLoaded && isProtected && !userId) {
      router.replace("/");
    }
  }, [isLoaded, isProtected, userId, router]);

  // ตรวจสอบสิทธิ์การเข้าหน้า (ดึง allowedPages จาก MongoDB)
  useEffect(() => {
    const checkAccess = async () => {
      if (!isLoaded || !user || !isProtected) {
        setHasAccess(true);
        setChecking(false);
        return;
      }

      const userRole = user.publicMetadata?.role as string || 'admin';

      // Super Admin เข้าได้ทุกหน้า
      if (userRole === 'superadmin') {
        setHasAccess(true);
        setChecking(false);
        return;
      }

      // หน้า Super Admin เฉพาะ superadmin เท่านั้น
      if (isSuperAdminPage) {
        setHasAccess(false);
        setChecking(false);
        return;
      }

      try {
        // ดึง allowedPages จาก MongoDB
        const token = await getToken();
        const res = await fetch('/api/users/get-by-clerkId', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        
        const allowedPages = data.user?.allowedPages || [];

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
    return (
      <Layout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-center p-8 bg-red-50 rounded-2xl max-w-md mx-4">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-red-800 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-red-600 mb-4">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
            <p className="text-sm text-gray-500 mb-4">
              กรุณาติดต่อผู้ดูแลระบบหากคุณต้องการสิทธิ์เข้าถึง
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
