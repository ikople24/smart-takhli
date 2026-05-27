import React, { ReactNode, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Bars3Icon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { usePermissionsStore } from '@/stores/usePermissionsStore';
import { DEFAULT_PERMISSIONS } from '@/lib/permissions';
import type { Role } from '@/lib/permissions';
import { useUser, UserButton } from '@clerk/nextjs';

interface LayoutAdminProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  noSidebar?: boolean;
}

// Sidebar navigation — รวมทุกหน้าที่เคยอยู่ใน dropdown
// หน้า hideFromMenu (elderly-cards, satisfaction, feedback-analysis) ไม่อยู่ใน nav
// แต่ยังเข้าถึงได้ผ่าน internal link
const navigationItems = [
  // ภาพรวม
  { label: 'Dashboard',          href: '/admin/dashboard',                icon: '📊', group: 'ภาพรวม' },
  { label: 'งานของฉัน',         href: '/admin/my-tasks',                 icon: '✅', group: 'ภาพรวม' },
  { label: 'การแจ้งเตือน',     href: '/admin/notifications',             icon: '🔔', group: 'ภาพรวม' },

  // จัดการ
  { label: 'การร้องเรียน',     href: '/admin/manage-complaints',         icon: '📋', group: 'จัดการ' },
  { label: 'Smart Health',       href: '/admin/smart-health',             icon: '🟣', group: 'จัดการ' },
  { label: 'Smart School',       href: '/admin/education-map',            icon: '🏫', group: 'จัดการ' },
  { label: 'คุณภาพน้ำ (ประปา)', href: '/admin/smart-papar/water-quality', icon: '💧', group: 'จัดการ' },
  { label: 'กิจกรรม',           href: '/admin/manage-activities',        icon: '📅', group: 'จัดการ' },

  // รายงาน
  { label: 'สถิติและรายงาน',   href: '/admin/analytics',                icon: '📉', group: 'รายงาน' },

  // ตั้งค่า
  { label: 'ตั้งค่าหน้าจอ',   href: '/admin',                           icon: '🛠️', group: 'ตั้งค่า' },
  { label: 'จัดการผู้ใช้',     href: '/admin/register-user',            icon: '👥', group: 'ตั้งค่า' },
  { label: 'จัดการ PM2.5',     href: '/admin/pm25-settings',            icon: '🌫️', group: 'ตั้งค่า' },
  { label: 'การบริหารระบบ',   href: '/admin/superadmin',               icon: '⚙️', group: 'ตั้งค่า' },
];

const GROUP_ORDER = ['ภาพรวม', 'จัดการ', 'รายงาน', 'ตั้งค่า'];

export const LayoutAdmin: React.FC<LayoutAdminProps> = ({
  children,
  title,
  subtitle,
  breadcrumbs = [],
  noSidebar = false,
}) => {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // อ่านสิทธิ์จาก store (ถูก populate โดย _app.tsx หลัง verify-app-access เสร็จ)
  const { role, allowedPages, isLoaded } = usePermissionsStore();
  const { user } = useUser();

  const userRole = (user?.publicMetadata?.role as string) || 'admin';
  const isSuperAdmin = userRole === 'superadmin';

  // กรอง navigationItems ตาม role + allowedPages จาก MongoDB
  const visibleNavItems = useMemo(() => {
    return navigationItems.filter((item) => {
      // หน้า superadmin แสดงเฉพาะ superadmin
      if (item.href.startsWith('/admin/superadmin') || item.href === '/admin/superadmin') {
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

  // จัดกลุ่ม items ตาม group
  const groupedNav = useMemo(() => {
    const map: Record<string, typeof visibleNavItems> = {};
    visibleNavItems.forEach((item) => {
      if (!map[item.group]) map[item.group] = [];
      map[item.group].push(item);
    });
    return GROUP_ORDER
      .filter((g) => (map[g]?.length ?? 0) > 0)
      .map((g) => ({ label: g, items: map[g] }));
  }, [visibleNavItems]);

  const isActive = (href: string) => router.pathname === href;

  return (
    <div className="flex h-screen bg-base-100 overflow-hidden">
      {/* ─── Sidebar ─── */}
      {!noSidebar && (
        <aside
          className={[
            // Mobile: fixed overlay; Desktop: in-flow flex column
            'fixed inset-y-0 left-0 z-40',
            'md:relative md:z-auto md:inset-auto md:flex md:flex-col',
            // Transition
            'transition-all duration-300 ease-in-out',
            // Mobile width always 64, desktop collapses to 16
            'w-64',
            sidebarCollapsed ? 'md:w-16' : 'md:w-60',
            // Mobile show/hide via translate
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
            // Dark theme
            'bg-gray-900 text-gray-100 border-r border-gray-700/50 flex flex-col',
          ].join(' ')}
        >
          {/* Logo + Collapse button */}
          <div
            className={[
              'flex items-center h-14 px-3 border-b border-gray-700/50 flex-shrink-0',
              sidebarCollapsed ? 'justify-center' : 'justify-between',
            ].join(' ')}
          >
            {!sidebarCollapsed && (
              <Link href="/admin/dashboard" className="text-white font-bold text-lg tracking-wide px-1">
                Smart
              </Link>
            )}
            <div className="flex items-center gap-1">
              {/* Mobile close */}
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
              {/* Desktop collapse toggle */}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden md:flex p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                title={sidebarCollapsed ? 'ขยาย Sidebar' : 'ย่อ Sidebar'}
              >
                {sidebarCollapsed
                  ? <ChevronRightIcon className="w-4 h-4" />
                  : <ChevronLeftIcon className="w-4 h-4" />
                }
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-2">
            {groupedNav.map((group) => (
              <div key={group.label} className="mb-1">
                {/* Section header — hidden when collapsed */}
                {!sidebarCollapsed && (
                  <p className="px-4 pt-4 pb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-widest select-none">
                    {group.label}
                  </p>
                )}
                {sidebarCollapsed && <div className="pt-3" />}

                <ul className="px-2 space-y-0.5">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={[
                          'flex items-center gap-3 rounded-lg transition-colors duration-150 text-sm',
                          sidebarCollapsed
                            ? 'justify-center px-2 py-2.5 tooltip tooltip-right'
                            : 'px-3 py-2',
                          isActive(item.href)
                            ? 'bg-primary/20 text-primary font-semibold'
                            : 'text-gray-300 hover:text-white hover:bg-gray-800',
                        ].join(' ')}
                        {...(sidebarCollapsed ? { 'data-tip': item.label } : {})}
                      >
                        <span className="text-base leading-none flex-shrink-0">{item.icon}</span>
                        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {/* User profile at bottom */}
          <div className="flex-shrink-0 border-t border-gray-700/50 p-3">
            {sidebarCollapsed ? (
              <div className="flex justify-center">
                <UserButton afterSignOutUrl="/" />
              </div>
            ) : (
              <div className="flex items-center gap-3 min-w-0">
                <UserButton afterSignOutUrl="/" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-200 truncate">
                    {user?.fullName || 'ผู้ดูแลระบบ'}
                  </p>
                  <p className={`text-xs truncate ${isSuperAdmin ? 'text-amber-400' : 'text-gray-400'}`}>
                    {isSuperAdmin ? '👑 Super Admin' : '🛡️ Admin'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ─── Main Content ─── */}
      <main className="flex-1 overflow-auto flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-base-100 border-b border-base-300 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-4 px-6 h-14">
            {/* Mobile sidebar toggle */}
            {!noSidebar && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden btn btn-ghost btn-sm btn-circle"
              >
                <Bars3Icon className="w-5 h-5" />
              </button>
            )}

            {/* Page title */}
            {(title || subtitle) && (
              <div>
                {title && <h2 className="text-lg font-semibold leading-tight">{title}</h2>}
                {subtitle && <p className="text-xs text-base-content/60">{subtitle}</p>}
              </div>
            )}
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
                    <span className="text-base-content/70">{crumb.label}</span>
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
        <footer className="flex-shrink-0 bg-base-200 border-t border-base-300 px-6 py-3 text-center text-sm text-base-content/60">
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
