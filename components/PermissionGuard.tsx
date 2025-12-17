import { useUser, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { hasPermission, Role, DEFAULT_PERMISSIONS } from "@/lib/permissions";

interface PermissionGuardProps {
  children: React.ReactNode;
  requiredPath?: string;
  fallback?: React.ReactNode;
}

export default function PermissionGuard({ 
  children, 
  requiredPath,
  fallback 
}: PermissionGuardProps) {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  const pathToCheck = requiredPath || router.pathname;

  useEffect(() => {
    const checkPermission = async () => {
      if (!isLoaded) return;
      
      if (!user) {
        setHasAccess(false);
        setChecking(false);
        return;
      }

      const userRole = (user.publicMetadata?.role as Role) || 'admin';
      
      // Superadmin has access to everything
      if (userRole === 'superadmin') {
        setHasAccess(true);
        setChecking(false);
        return;
      }

      try {
        // Try to fetch user's custom permissions
        const token = await getToken();
        const res = await fetch(`/api/permissions/get-user?userId=${user.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        const data = await res.json();
        const userPermissions = data.permissions || [];
        
        // Check if user has permission
        const allowed = hasPermission(userRole, userPermissions, pathToCheck);
        setHasAccess(allowed);
      } catch (error) {
        console.error("Error checking permissions:", error);
        // Fallback to default permissions
        const allowed = hasPermission(userRole, undefined, pathToCheck);
        setHasAccess(allowed);
      } finally {
        setChecking(false);
      }
    };

    checkPermission();
  }, [isLoaded, user, pathToCheck, getToken]);

  if (checking || !isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg text-primary mb-4"></div>
          <p className="text-gray-500">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center p-8 bg-red-50 rounded-2xl max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-red-800 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
          <p className="text-red-600 mb-4">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
          <button
            onClick={() => router.push('/')}
            className="btn btn-error btn-outline"
          >
            กลับหน้าหลัก
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Hook สำหรับใช้ตรวจสอบ permission
export function usePermissions() {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role>('admin');

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!isLoaded || !user) {
        setLoading(false);
        return;
      }

      const userRole = (user.publicMetadata?.role as Role) || 'admin';
      setRole(userRole);

      if (userRole === 'superadmin') {
        // Superadmin gets all permissions
        setPermissions(['*']);
        setLoading(false);
        return;
      }

      try {
        const token = await getToken();
        const res = await fetch(`/api/permissions/get-user?userId=${user.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        const data = await res.json();
        setPermissions(data.permissions || DEFAULT_PERMISSIONS[userRole] || []);
      } catch (error) {
        console.error("Error fetching permissions:", error);
        setPermissions(DEFAULT_PERMISSIONS[userRole] || []);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [isLoaded, user, getToken]);

  const checkPermission = (path: string): boolean => {
    if (role === 'superadmin') return true;
    return hasPermission(role, permissions, path);
  };

  return {
    permissions,
    role,
    loading,
    checkPermission,
    isAdmin: role === 'admin' || role === 'superadmin',
    isSuperAdmin: role === 'superadmin',
  };
}

