import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware();

export const config = {
  matcher: [
    "/admin/:path*",
    "/user/:path*",
    "/api/:path*",
  ],
};