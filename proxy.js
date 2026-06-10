import { NextResponse } from 'next/server';

export function proxy(request) {
  const { hostname, pathname } = request.nextUrl;

  if (hostname === 'splitthedistance.com' && pathname !== '/ads.txt') {
    const url = request.nextUrl.clone();
    url.hostname = 'www.splitthedistance.com';
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
