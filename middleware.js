import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware();

export const config = {
  matcher: [
    // ตรวจสอบเฉพาะเส้นทางที่ไม่ใช่ public
    '/((?!_next|favicon.ico|register-user|api/users/create).*)',
  ],
};