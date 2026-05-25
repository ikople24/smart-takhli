import React, { ReactNode } from 'react';
import Link from 'next/link';
import { useUser, UserButton, SignInButton } from '@clerk/nextjs';

interface LayoutUserProps {
  children: ReactNode;
  title?: string;
}

export const LayoutUser: React.FC<LayoutUserProps> = ({ children, title }) => {
  const { user, isLoaded } = useUser();

  return (
    <div className="min-h-screen bg-gradient-to-br from-base-100 to-base-200 flex flex-col">
      {/* Header */}
      <header className="bg-base-100 border-b border-base-300 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary">
              <span>🏛️</span>
              Smart Municipality
            </Link>

            {isLoaded && (
              <div className="flex items-center gap-4">
                {user ? (
                  <>
                    <span className="text-sm font-medium text-base-content hidden sm:inline">
                      {user.firstName}
                    </span>
                    <UserButton afterSignOutUrl="/" />
                  </>
                ) : (
                  <SignInButton mode="modal">
                    <button className="btn btn-primary btn-sm">เข้าสู่ระบบ</button>
                  </SignInButton>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {title && (
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-base-content">{title}</h1>
              <div className="h-1 w-16 bg-primary mt-2 rounded-full" />
            </div>
          )}

          <div className="space-y-6">
            {children}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-base-200 border-t border-base-300 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-lg mb-4">บริการ</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/complaint" className="link link-hover">
                    ร้องเรียน/ร้องทุกข์
                  </Link>
                </li>
                <li>
                  <Link href="/status" className="link link-hover">
                    ตรวจสอบสถานะ
                  </Link>
                </li>
                <li>
                  <Link href="/" className="link link-hover">
                    หน้าแรก
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">ติดต่อ</h3>
              <p className="text-sm text-base-content/70">
                {/* Phone and email */}
              </p>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">เกี่ยวกับ</h3>
              <p className="text-sm text-base-content/70">
                ระบบจัดการการร้องเรียนและบริการชุมชน
              </p>
            </div>
          </div>

          <div className="border-t border-base-300 pt-8 text-center text-sm text-base-content/60">
            <p>&copy; 2025 Smart Municipality System. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
