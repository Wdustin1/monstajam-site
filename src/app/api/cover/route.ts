import { NextRequest, NextResponse } from 'next/server';
import { validateCoverUrlForFetch } from '@/lib/coverProxy';
import { isAdminRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getRequestAddress } from '@/lib/rateLimit';
import { consumeSharedRateLimit } from '@/lib/sharedRateLimit';

export const maxDuration = 30;

const MAX_COVER_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

async function consumeCoverRateLimits(
  request: NextRequest,
  consume: typeof consumeSharedRateLimit,
) {
  const clientLimit = await consume({
    namespace: 'cover-proxy-client',
    key: getRequestAddress(request.headers),
    limit: 200,
    windowMs: 10 * 60 * 1000,
  });
  if (!clientLimit.allowed) return clientLimit;

  return consume({
    namespace: 'cover-proxy-global',
    key: 'global',
    limit: 10_000,
    windowMs: 10 * 60 * 1000,
  });
}

export function createCoverHandler(consume: typeof consumeSharedRateLimit = consumeSharedRateLimit) {
  return async function GET(request: NextRequest) {
  const requestedUrl = request.nextUrl.searchParams.get('url');
  if (!requestedUrl) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  const isAdmin = isAdminRequest(request);
  if (!isAdmin) {
    let blockedLimit;
    try {
      const limit = await consumeCoverRateLimits(request, consume);
      blockedLimit = limit.allowed ? null : limit;
    } catch (error) {
      console.error('Cover rate limiter unavailable', error);
      return NextResponse.json({ error: 'Cover unavailable' }, { status: 503 });
    }
    if (blockedLimit) {
      return NextResponse.json(
        { error: 'Too many cover requests' },
        { status: 429, headers: { 'Retry-After': String(blockedLimit.retryAfterSeconds) } },
      );
    }
  }

  let sourceUrl: URL;
  try {
    sourceUrl = await validateCoverUrlForFetch(requestedUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  if (!isAdmin) {
    try {
      const publishedTrack = await prisma.track.findFirst({
        where: { published: true, coverUrl: sourceUrl.toString() },
        select: { id: true },
      });
      if (!publishedTrack) {
        return NextResponse.json({ error: 'Cover not found' }, { status: 404 });
      }
    } catch (error) {
      console.error('Cover authorization error:', error);
      return NextResponse.json({ error: 'Cover unavailable' }, { status: 500 });
    }
  }

  try {
    const upstream = await fetch(sourceUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif' },
    });

    if (upstream.status >= 300 && upstream.status < 400) {
      return NextResponse.json({ error: 'Upstream redirect rejected' }, { status: 502 });
    }
    if (!upstream.ok) {
      return NextResponse.json({ error: 'Upstream failed' }, { status: upstream.status });
    }

    const declaredLength = Number(upstream.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_COVER_BYTES) {
      return NextResponse.json({ error: 'Cover is too large' }, { status: 413 });
    }

    const bytes = await readBoundedBody(upstream, MAX_COVER_BYTES);
    const jpegStart = findJpegStart(bytes);
    const pngStart = findPngStart(bytes);
    const webpStart = findWebPStart(bytes);
    const gifStart = findGifStart(bytes);
    const match = gifStart !== -1
      ? { start: gifStart, contentType: 'image/gif' }
      : jpegStart !== -1
        ? { start: jpegStart, contentType: 'image/jpeg' }
        : pngStart !== -1
          ? { start: pngStart, contentType: 'image/png' }
          : webpStart !== -1
            ? { start: webpStart, contentType: 'image/webp' }
            : null;

    if (!match) {
      return NextResponse.json({ error: 'Upstream did not return a supported image' }, { status: 415 });
    }

    return new NextResponse(bytes.slice(match.start), {
      status: 200,
      headers: {
        'Content-Type': match.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Cover proxy error:', error);
    const status = error instanceof CoverTooLargeError ? 413 : 502;
    const message = status === 413 ? 'Cover is too large' : 'Proxy error';
    return NextResponse.json({ error: message }, { status });
  }
  };
}

export const GET = createCoverHandler();

class CoverTooLargeError extends Error {}

async function readBoundedBody(response: Response, maximumBytes: number): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maximumBytes) {
      await reader.cancel();
      throw new CoverTooLargeError();
    }
    chunks.push(value);
  }

  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function findJpegStart(buf: Uint8Array): number {
  for (let i = 0; i < Math.min(buf.length - 2, 4096); i += 1) {
    if (buf[i] === 0xff && buf[i + 1] === 0xd8 && buf[i + 2] === 0xff) return i;
  }
  return -1;
}

function findPngStart(buf: Uint8Array): number {
  for (let i = 0; i < Math.min(buf.length - 3, 4096); i += 1) {
    if (buf[i] === 0x89 && buf[i + 1] === 0x50 && buf[i + 2] === 0x4e && buf[i + 3] === 0x47) return i;
  }
  return -1;
}

function findWebPStart(buf: Uint8Array): number {
  for (let i = 0; i < Math.min(buf.length - 3, 4096); i += 1) {
    if (buf[i] === 0x52 && buf[i + 1] === 0x49 && buf[i + 2] === 0x46 && buf[i + 3] === 0x46) return i;
  }
  return -1;
}

function findGifStart(buf: Uint8Array): number {
  for (let i = 0; i < Math.min(buf.length - 5, 4096); i += 1) {
    const hasGifPrefix = buf[i] === 0x47 && buf[i + 1] === 0x49 && buf[i + 2] === 0x46 && buf[i + 3] === 0x38;
    const hasVersion = (buf[i + 4] === 0x37 || buf[i + 4] === 0x39) && buf[i + 5] === 0x61;
    if (hasGifPrefix && hasVersion) return i;
  }
  return -1;
}
