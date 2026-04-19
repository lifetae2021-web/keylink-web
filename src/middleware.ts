import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This is a basic edge middleware. 
// Note: We can't use full Firebase Admin SDK here usually, 
// so we rely on client-side checks in the layout for deep role-based auth,
// but we can do basic session check or path protection here.

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /admin routes
  if (pathname.startsWith('/admin')) {
    // If it's the login page, allow
    if (pathname === '/admin/login') {
      return NextResponse.next();
    }

    // In a real app, we would check for a session cookie here.
    // For now, we'll let the client-side layout handle the deep auth check
    // but we could redirect to login if no session is present.
    // const session = request.cookies.get('session');
    // if (!session) return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
