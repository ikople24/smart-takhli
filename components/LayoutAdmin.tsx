import React, { ReactNode, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Bars3Icon, XMarkIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { NotificationBell } from '@/components/NotificationBell';
import { usePermissionsStore } from '@/stores/usePermissionsStore';
import { DEFAULT_PERMISSIONS } from '@/lib/permissions';
import type { Role } from '@/lib/permissions';

interface LayoutAdminProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  noSidebar?: boolean;
}

// Sidebar navigation — เฉพาะรายการหลักที่ใช้บ่อย
// หน้า hideFromMenu (elderly-cards, satisfaction) ถูกตัดออก — เข้าถึงผ่าน internal link
const navigationItems = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
  { label: 'การร้องเรียน', href: '/admin/manage-complaints', icon: '📋' },
  { label: 'สถิติและรายงาน', href: '/admin/analytics', icon: '📉' },
  { label: 'การแจ้งเตือน', href: '/admin/notifications', icon: '🔔' },
  { label: 'การบริหารระบบ', href: '/admin/superadmin', icon: '⚙️' },
];

export const LayoutAdmin: React.FC<LayoutAdminProps> = ({
  children,
  title,
  subtitle,
  breadcrumbs = [],
  noSidebar = false,
}) => {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // อ่านสิทธิ์จาก store (ถูก populate โดย _app.tsx หลัง verify-app-access เสร็จ)
  const { role, allowedPages, isLoaded } = usePermissionsStore();

  // กรอง navigationItems ตาม role + allowedPages จาก MongoDB
  const visibleNavItems = useMemo(() => {
    return navigationItems.filter((item) => {
      // หน้า superadmin แสดงเฉพาะ superadmin
      if (item.href.startsWith('/admin/superadmin')) {
        return role === 'superadmin';
      }
      // superadmin เห็นทุกหน้า
      if (role === 'superadmin') return true;
      // ถ้ายังไม่ได้โหลด permissions หรือ allowedPages ว่าง → ใช้ DEFAULT_PERMISSIONS
      const effectivePaths =
        isLoaded && allowedPages.length > 0
          ? allowedPages
          : DEFAULT_PERMISSIONS[role as Role] ?? DEFAULT_PERMISSIONS['admin'];
      return effectivePaths.some(
        (p) => item.href === p || item.href.startsWith(p + '/')
      );
    });
  }, [role, allowedPages, isLoaded]);

  const isActive = (href: string) => router.pathname === href;

  return (
    <div className="flex h-screen bg-base-100">
      {/* Sidebar */}
      {!noSidebar && (
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-base-200 border-r border-base-300
          transition-transform duration-300 ease-in-out
          md:relative md:translate-x-0
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo Area */}
        <div className="flex items-center justify-between p-6 border-b border-base-300">
          <h1 className="text-xl font-bold text-primary">Smart</h1>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden btn btn-ghost btn-sm btn-circle"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          {visibleNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200
                ${
                  isActive(item.href)
                    ? 'bg-primary text-primary-content font-semibold'
                    : 'text-base-content hover:bg-base-300'
                }
              `}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-base-100 border-b border-base-300 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4">
            {/* Left: Menu + Title */}
            <div className="flex items-center gap-4">
              {!noSidebar && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden btn btn-ghost btn-sm btn-circle"
              >
                <Bars3Icon className="w-5 h-5" />
              </button>
              )}
              <div>
                {title && <h2 className="text-xl font-semibold">{title}</h2>}
                {subtitle && <p className="text-sm text-base-content/60">{subtitle}</p>}
              </div>
            </div>

            {/* Right: Shortcuts + User Menu */}
            <div className="flex items-center gap-2">
              {/* My Tasks shortcut */}
              <Link
                href="/admin/my-tasks"
                className={`btn btn-ghost btn-sm btn-circle tooltip tooltip-bottom ${
                  router.pathname === '/admin/my-tasks' ? 'text-primary' : ''
                }`}
                data-tip="KPI งานของฉัน"
              >
                <ClipboardDocumentListIcon className="w-5 h-5" />
              </Link>

              {/* Notification Bell */}
              <NotificationBell />
            </div>
          </div>

          {/* Breadcrumbs */}
          {breadcrumbs.length > 0 && (
            <div className="px-6 pb-3 flex items-center gap-2 text-sm overflow-x-auto">
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <span className="text-base-content/40">/</span>}
                  {crumb.href ? (
                    <Link href={crumb.href} className="link link-hover text-primary">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-base-content">{crumb.label}</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            {children}
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-base-200 border-t border-base-300 px-6 py-4 text-center text-sm text-base-content/60">
          <p>&copy; 2025 Smart Municipality System. All rights reserved.</p>
        </footer>
      </main>

      {/* Mobile backdrop */}
      {!noSidebar && mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default LayoutAdmin;
