import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url || !url.startsWith('https://') || !url.includes('blob.vercel-storage.com')) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      return NextResponse.json({ error: 'Upstream failed' }, { status: upstream.status });
    }

    const buffer = await upstream.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Vercel Blob sometimes wraps responses in multipart/form-data even when
    // the Content-Type says image/jpeg. Detect by checking for multipart boundary
    // prefix (------FormBoundary...) or by finding the actual image start bytes.
    const jpegStart = findJpegStart(bytes);
    const pngStart = findPngStart(bytes);
    const webpStart = findWebPStart(bytes);

    if (jpegStart !== -1) {
      return new NextResponse(bytes.slice(jpegStart), {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': '*',
          'Content-Disposition': 'inline',
        },
      });
    }

    if (pngStart !== -1) {
      return new NextResponse(bytes.slice(pngStart), {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': '*',
          'Content-Disposition': 'inline',
        },
      });
    }

    if (webpStart !== -1) {
      return new NextResponse(bytes.slice(webpStart), {
        status: 200,
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': '*',
          'Content-Disposition': 'inline',
        },
      });
    }

    // Fallback: return as-is with inline disposition
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Content-Disposition': 'inline',
      },
    });
  } catch (err) {
    console.error('Cover proxy error:', err);
    return NextResponse.json({ error: 'Proxy error' }, { status: 502 });
  }
}

function findJpegStart(buf: Uint8Array): number {
  for (let i = 0; i < Math.min(buf.length, 4096); i++) {
    if (buf[i] === 0xFF && buf[i + 1] === 0xD8 && buf[i + 2] === 0xFF) return i;
  }
  return -1;
}

function findPngStart(buf: Uint8Array): number {
  for (let i = 0; i < Math.min(buf.length, 4096); i++) {
    if (buf[i] === 0x89 && buf[i + 1] === 0x50 && buf[i + 2] === 0x4E && buf[i + 3] === 0x47) return i;
  }
  return -1;
}

function findWebPStart(buf: Uint8Array): number {
  for (let i = 0; i < Math.min(buf.length, 4096); i++) {
    if (buf[i] === 0x52 && buf[i + 1] === 0x49 && buf[i + 2] === 0x46 && buf[i + 3] === 0x46) return i;
  }
  return -1;
}