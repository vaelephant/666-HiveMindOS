import { NextResponse } from 'next/server';
import { auth } from '@/auth';

const PUBLIC_PREFIXES = ['/', '/auth/login', '/auth/register', '/auth/invite'];
const AUTH_ONLY_PREFIXES = ['/auth/login', '/auth/register'];

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_PREFIXES.some(
    (p) => p !== '/' && (pathname === p || pathname.startsWith(`${p}/`)),
  );
}

function isAuthPage(pathname: string): boolean {
  return AUTH_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isProtectedPath(pathname: string): boolean {
  if (pathname.startsWith('/api/auth')) return false;
  if (pathname.startsWith('/api/kb/')) return true;
  if (
    pathname.startsWith('/home') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/tasks') ||
    pathname.startsWith('/knowledge-base') ||
    pathname.startsWith('/hivemind') ||
    pathname.startsWith('/hivemind-memories') ||
    pathname.startsWith('/workflows') ||
    pathname.startsWith('/tools') ||
    pathname.startsWith('/integrations') ||
    pathname.startsWith('/audit') ||
    pathname.startsWith('/chat') ||
    pathname.startsWith('/agent-tasks') ||
    pathname.startsWith('/automations') ||
    pathname.startsWith('/human-review') ||
    pathname.startsWith('/account') ||
    pathname.startsWith('/ipfs-monitor') ||
    pathname.startsWith('/annotation') ||
    pathname.startsWith('/inbound') ||
    pathname.startsWith('/outbound') ||
    pathname.startsWith('/inventory') ||
    pathname.startsWith('/master') ||
    pathname.startsWith('/devices') ||
    pathname.startsWith('/stocktake') ||
    pathname.startsWith('/analytics') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/slot-ai') ||
    pathname.startsWith('/ai-brain')
  ) {
    return true;
  }
  return false;
}

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const loggedIn = !!session?.user?.id;

  const kbMatch = pathname.match(/^\/api\/kb\/([^/]+)/);
  if (kbMatch) {
    const orgId = decodeURIComponent(kbMatch[1]);
    if (!loggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session!.user!.orgId !== orgId) {
      return NextResponse.json({ error: 'Forbidden: org mismatch' }, { status: 403 });
    }
  }

  if (loggedIn && isAuthPage(pathname)) {
    return NextResponse.redirect(new URL('/home', req.url));
  }

  if (!loggedIn && isProtectedPath(pathname) && !isPublicPath(pathname)) {
    const login = new URL('/auth/login', req.url);
    login.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Page routes: login guard + auth-page redirect (exclude API so NextAuth handlers work)
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|ico)$).*)',
    // KB API: org-id guard
    '/api/kb/:path*',
  ],
};
