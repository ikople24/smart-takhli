import React, { ReactNode, useState } from 'react';
import { useRouter } from 'next/router';
import { useUser, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { MenuIcon, XIcon } from '@heroicons/react/24/outline';

interface LayoutAdminProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

const navigationItems = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
  { label: 'การร้องเรียน', href: '/admin/manage-complaints', icon: '📋' },
  { label: 'งานที่ได้รับมอบหมาย', href: '/admin/my-tasks', icon: '✅' },
  { label: 'ข้อมูลผู้สูงอายุ', href: '/admin/elderly-cards', icon: '👴' },
  { label: 'การบริหารระบบ', href: '/admin/superadmin', icon: '⚙️' },
  { label: 'ตั้งค่า', href: '/admin/settings/organizations', icon: '🔧' },
];

export const LayoutAdmin: React.FC<LayoutAdminProps> = ({
  children,
  title,
  subtitle,
  breadcrumbs = [],
}) => {
  const router = useRouter();
  const { user } = useUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (href: string) => router.pathname === href;

  return (
    <div className="flex h-screen bg-base-100">
      {/* Sidebar */}
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
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          {navigationItems.map((item) => (
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

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-base-100 border-b border-base-300 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4">
            {/* Left: Menu + Title */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden btn btn-ghost btn-sm btn-circle"
              >
                <MenuIcon className="w-5 h-5" />
              </button>
              <div>
                {title && <h2 className="text-xl font-semibold">{title}</h2>}
                {subtitle && <p className="text-sm text-base-content/60">{subtitle}</p>}
              </div>
            </div>

            {/* Right: User Menu */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium hidden sm:inline">
                {user?.firstName} {user?.lastName}
              </span>
              <UserButton afterSignOutUrl="/" />
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
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};
