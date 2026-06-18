import React, { ReactNode } from 'react';
import Link from 'next/link';

interface LayoutPublicProps {
  children: ReactNode;
}

export const LayoutPublic: React.FC<LayoutPublicProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-base-100 to-base-100 flex flex-col">
      {/* Hero Header */}
      <header className="bg-gradient-to-r from-primary to-primary/80 text-primary-content">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">🏛️ Smart Municipality</h1>
              <p className="text-lg opacity-90">
                ระบบบริการชุมชนและจัดการการร้องเรียน
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Quick Links */}
      <nav className="bg-base-100 border-b border-base-300 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center gap-2 sm:gap-4 py-4 flex-wrap">
            <Link href="/" className="btn btn-ghost btn-sm">
              หน้าแรก
            </Link>
            <Link href="/complaint" className="btn btn-primary btn-sm">
              ร้องเรียน
            </Link>
            <Link href="/status" className="btn btn-ghost btn-sm">
              ตรวจสอบสถานะ
            </Link>
            <Link href="/activities" className="btn btn-ghost btn-sm">
              กิจกรรม
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-base-200 border-t border-base-300 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <div>
              <h3 className="font-bold text-base mb-3">บริการ</h3>
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
                  <Link href="/activities" className="link link-hover">
                    กิจกรรมชุมชน
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-base mb-3">ติดต่อเรา</h3>
              <p className="text-sm text-base-content/70">
                โทรศัพท์: 000-000-0000<br />
                อีเมล: info@smart.local
              </p>
            </div>
            <div>
              <h3 className="font-bold text-base mb-3">ชั่วโมงการให้บริการ</h3>
              <p className="text-sm text-base-content/70">
                จันทร์ - ศุกร์ 08:30 - 16:30<br />
                วันหยุดตามกำหนดของรัฐ
              </p>
            </div>
            <div>
              <h3 className="font-bold text-base mb-3">ข้อมูลเพิ่มเติม</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="link link-hover">
                    นโยบายความเป็นส่วนตัว
                  </a>
                </li>
                <li>
                  <a href="#" className="link link-hover">
                    เงื่อนไขการใช้งาน
                  </a>
                </li>
                <li>
                  <a href="#" className="link link-hover">
                    สอบถามข้อมูล
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-base-300 pt-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-base-content/60">
                &copy; 2025 Smart Municipality System. All rights reserved.
              </p>
              <div className="flex gap-4">
                <a href="#" className="link link-hover text-sm">
                  Facebook
                </a>
                <a href="#" className="link link-hover text-sm">
                  Line
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
