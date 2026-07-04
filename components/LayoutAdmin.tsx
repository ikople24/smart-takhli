import React, { ReactNode, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Bars3Icon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { usePermissionsStore } from '@/stores/usePermissionsStore';
import { DEFAULT_PERMISSIONS, pathMatchesPermission } from '@/lib/permissions';
import type { Role } from '@/lib/permissions';
import { useUser, UserButton } from '@clerk/nextjs';
import TopNavbar from '@/components/TopNavbar';

interface LayoutAdminProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  noSidebar?: boolean;
}

// Sidebar navigation — รวมทุกหน้าที่เคยอยู่ใน dropdown
const navigationItems = [
  // ภาพรวม
  { label: 'Dashboard',          href: '/admin/dashboard',                icon: '📊', group: 'ภาพรวม' },
  { label: 'งานของฉัน',         href: '/admin/my-tasks',                 icon: '✅', group: 'ภาพรวม' },
  { label: 'การแจ้งเตือน',     href: '/admin/notifications',             icon: '🔔', group: 'ภาพรวม' },

  // จัดการ
  { label: 'การร้องเรียน',     href: '/admin/manage-complaints',         icon: '📋', group: 'จัดการ' },
  { label: 'Smart Health',       href: '/admin/smart-health',             icon: '🟣', group: 'จัดการ' },
  { label: 'โรงเรียนผู้สูงอายุ', href: '/admin/elderly-school',           icon: '🎓', group: 'จัดการ' },
  { label: 'Smart School',       href: '/admin/smart-school',             icon: '🏫', group: 'จัดการ' },
  { label: 'คุณภาพน้ำ (ประปา)', href: '/admin/smart-papar/water-quality', icon: '💧', group: 'จัดการ' },
  { label: 'กิจกรรม',           href: '/admin/manage-activities',        icon: '📅', group: 'จัดการ' },

  // รายงาน
  { label: 'สถิติและรายงาน',   href: '/admin/analytics',                icon: '📉', group: 'รายงาน' },

  // ตั้งค่า
  { label: 'ตั้งค่าหน้าจอ',   href: '/admin',                                   icon: '🛠️', group: 'ตั้งค่า' },
  { label: 'จัดการผู้ใช้',     href: '/admin/register-user',                    icon: '👥', group: 'ตั้งค่า' },
  { label: 'จัดการ PM2.5',     href: '/admin/pm25-settings',                    icon: '🌫️', group: 'ตั้งค่า' },
  { label: 'ข้อมูลองค์กร',     href: '/admin/settings/organizations',           icon: '🏛️', group: 'ตั้งค่า' },
  { label: 'ข้อมูลชุมชน',      href: '/admin/settings/communities',             icon: '🏘️', group: 'ตั้งค่า' },
  { label: 'แผนที่ GeoJSON',   href: '/admin/settings/geojson-map',             icon: '🗺️', group: 'ตั้งค่า' },
  { label: 'การบริหารระบบ',   href: '/admin/superadmin',                        icon: '⚙️', group: 'ตั้งค่า' },
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

  const { role, allowedPages, isLoaded } = usePermissionsStore();
  const { user } = useUser();

  const userRole = (user?.publicMetadata?.role as string) || 'admin';
  const isSuperAdmin = userRole === 'superadmin';

  const visibleNavItems = useMemo(() => {
    return navigationItems.filter((item) => {
      if (item.href.startsWith('/admin/superadmin') || item.href === '/admin/superadmin') {
        return role === 'superadmin';
      }
      if (role === 'superadmin') return true;
      const effectivePaths =
        isLoaded && allowedPages.length > 0
          ? allowedPages
          : DEFAULT_PERMISSIONS[role as Role] ?? DEFAULT_PERMISSIONS['admin'];
      return effectivePaths.some((p) => pathMatchesPermission(item.href, p));
    });
  }, [role, allowedPages, isLoaded]);

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
    /*
     * h-screen — sidebar spans full viewport height, same level as TopNavbar
     * TopNavbar is rendered INSIDE the content column (not in Layout.js for admin routes)
     * BottomNav is fixed bottom-0 h-14 — content area has pb-14 to compensate
     */
    <div className="flex h-screen bg-base-100 overflow-hidden">

      {/* ─── Sidebar ─── */}
      {!noSidebar && (
        <aside
          className={[
            // Mobile: fixed overlay; Desktop: in-flow flex column
            'fixed inset-y-0 left-0 z-40',
            'md:relative md:z-auto md:inset-auto md:flex md:flex-col',
            'transition-all duration-300 ease-in-out',
            // Mobile always w-64; desktop collapses to w-14
            'w-64 flex flex-col',
            sidebarCollapsed ? 'md:w-14' : 'md:w-56',
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
            // Light theme — ไม่ใช้ dark (gray-900) แต่ใช้ base-200 ให้ match TopNavbar
            'bg-base-200 border-r border-base-300',
          ].join(' ')}
        >
          {/* Logo + Collapse button */}
          <div
            className={[
              'flex items-center h-14 px-3 border-b border-base-300 flex-shrink-0',
              sidebarCollapsed ? 'justify-center' : 'justify-between',
            ].join(' ')}
          >
            {!sidebarCollapsed && (
              <Link href="/admin/dashboard" className="text-base-content font-bold text-lg tracking-wide px-1 hover:text-primary transition-colors">
                SMART-TAKHLI
              </Link>
            )}
            <div className="flex items-center gap-1">
              {/* Mobile close */}
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="md:hidden p-1.5 rounded-lg text-base-content/50 hover:text-base-content hover:bg-base-300 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
              {/* Desktop collapse toggle */}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden md:flex p-1.5 rounded-lg text-base-content/40 hover:text-base-content hover:bg-base-300 transition-colors"
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
            {/* ── Skeleton ── แสดงระหว่างที่ permissions ยังโหลดไม่เสร็จ
                ป้องกัน flash ของเมนูที่ไม่ควรเห็น */}
            {!isLoaded ? (
              <div className="px-3 pt-3 space-y-1 animate-pulse">
                {/* group label skeleton */}
                <div className="h-2.5 w-16 rounded bg-base-300/70 mb-3 mx-1" />
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-2 py-2">
                    <div className="w-5 h-5 rounded bg-base-300/70 flex-shrink-0" />
                    {!sidebarCollapsed && <div className={`h-3 rounded bg-base-300/70 ${i === 2 ? 'w-20' : 'w-24'}`} />}
                  </div>
                ))}
                <div className="h-2.5 w-12 rounded bg-base-300/70 mt-5 mb-3 mx-1" />
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-2 py-2">
                    <div className="w-5 h-5 rounded bg-base-300/70 flex-shrink-0" />
                    {!sidebarCollapsed && <div className={`h-3 rounded bg-base-300/70 ${i === 1 ? 'w-28' : 'w-20'}`} />}
                  </div>
                ))}
                <div className="h-2.5 w-14 rounded bg-base-300/70 mt-5 mb-3 mx-1" />
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-2 py-2">
                    <div className="w-5 h-5 rounded bg-base-300/70 flex-shrink-0" />
                    {!sidebarCollapsed && <div className={`h-3 rounded bg-base-300/70 ${i === 1 ? 'w-22' : 'w-16'}`} />}
                  </div>
                ))}
              </div>
            ) : (
              groupedNav.map((group) => (
                <div key={group.label} className="mb-1">
                  {/* Section header */}
                  {!sidebarCollapsed ? (
                    <p className="px-4 pt-4 pb-1 text-[10px] font-semibold text-base-content/40 uppercase tracking-widest select-none">
                      {group.label}
                    </p>
                  ) : (
                    <div className="pt-3 border-t border-base-300/50 mx-2" />
                  )}

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
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-base-content/70 hover:text-base-content hover:bg-base-300',
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
              ))
            )}
          </nav>

          {/* User profile at bottom */}
          <div className="flex-shrink-0 border-t border-base-300 p-3 mb-14 md:mb-0">
            {sidebarCollapsed ? (
              <div className="flex justify-center">
                {!isLoaded
                  ? <div className="w-8 h-8 rounded-full bg-base-300/70 animate-pulse" />
                  : <UserButton afterSignOutUrl="/" />
                }
              </div>
            ) : !isLoaded ? (
              /* Skeleton user card */
              <div className="flex items-center gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-base-300/70 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-24 rounded bg-base-300/70" />
                  <div className="h-2.5 w-14 rounded bg-base-300/70" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 min-w-0">
                <UserButton afterSignOutUrl="/" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-base-content truncate">
                    {user?.fullName || 'ผู้ดูแลระบบ'}
                  </p>
                  <p className={`text-xs truncate ${isSuperAdmin ? 'text-warning font-medium' : 'text-base-content/50'}`}>
                    {isSuperAdmin ? '👑 Super Admin' : '🛡️ Admin'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ─── Main Content ─── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* TopNavbar — อยู่ในคอลัมน์ content เท่านั้น (sidebar อยู่ระดับเดียวกัน) */}
        <TopNavbar />

        {/* Page title / subtitle / breadcrumbs sub-header */}
        {(title || subtitle || breadcrumbs.length > 0) && (
          <div className="flex-shrink-0 bg-base-100 border-b border-base-300">
            <div className="flex items-center gap-4 px-6 h-12">
              {/* Mobile sidebar toggle */}
              {!noSidebar && (
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden btn btn-ghost btn-sm btn-circle"
                >
                  <Bars3Icon className="w-5 h-5" />
                </button>
              )}
              {(title || subtitle) && (
                <div>
                  {title && <h2 className="text-base font-semibold leading-tight">{title}</h2>}
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
          </div>
        )}

        {/* Mobile sidebar toggle when no title bar */}
        {!noSidebar && !title && !subtitle && breadcrumbs.length === 0 && (
          <div className="flex-shrink-0 px-4 py-2 md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="btn btn-ghost btn-sm btn-circle"
            >
              <Bars3Icon className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Scrollable content — pb-14 รองรับ BottomNav ที่ fixed bottom-0 */}
        <div className="flex-1 overflow-auto pb-14">
          <div className="p-6">
            {children}
          </div>
        </div>

        {/* Footer */}
        <footer className="flex-shrink-0 bg-base-200 border-t border-base-300 px-6 py-3 text-center text-sm text-base-content/60 mb-14 md:mb-0">
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
