import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return new NextResponse('Missing url', { status: 400 });

  // 허용된 도메인만 프록시 (보안)
  const allowed = [
    'firebasestorage.googleapis.com',
    'storage.googleapis.com',
    'lh3.googleusercontent.com',
  ];
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return new NextResponse('Invalid url', { status: 400 });
  }
  if (!allowed.some(d => hostname.endsWith(d))) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) return new NextResponse('Fetch failed', { status: res.status });

    const buf = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    console.error('[proxy-image] error:', e);
    return new NextResponse('Error', { status: 500 });
  }
}
