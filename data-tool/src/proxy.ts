import { NextRequest, NextResponse } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export default async function proxy(request: NextRequest) {
  // 1. Bypass auth in development for convenience (optional, user can toggle)
  // Or better, check if we are in a preview/production environment
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // In dev, we can pretend to be authenticated
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-email', 'dev@example.com');
    requestHeaders.set('x-user-id', 'dev-user-id');
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // 2. Get the Cloudflare Access Token
  const token = request.cookies.get('CF_Authorization')?.value || request.headers.get('CF-Access-Jwt-Assertion');

  if (!token) {
    return new NextResponse('Unauthorized: No token found', { status: 401 });
  }

  // 3. Verify Token
  const teamDomain = process.env.CLOUDFLARE_TEAM_DOMAIN;
  if (!teamDomain) {
    return new NextResponse('Server Configuration Error: CLOUDFLARE_TEAM_DOMAIN not set', { status: 500 });
  }

  const JWKS = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${teamDomain}`,
      audience: process.env.CLOUDFLARE_AUDIENCE_TAG,
    });

    // 4. Success - pass user info to headers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-email', payload.email as string);
    requestHeaders.set('x-user-id', payload.sub as string);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

  } catch (error) {
    console.error('JWT Verification Failed:', error);
    return new NextResponse('Forbidden: Invalid token', { status: 403 });
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/public (if any)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/public|_next/static|_next/image|favicon.ico).*)',
  ],
};
