import assert from 'node:assert/strict';
import { randomFillSync } from 'node:crypto';
import { afterEach, before, beforeEach, mock, test } from 'node:test';
import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { GET } from '../../src/app/api/cover/route';
import { parseCoverSource } from '../../src/lib/cover-source';
import { proxyCoverUrl } from '../../src/lib/proxy-cover';

const trustedHost = 'uwuqs1lz48clguif.public.blob.vercel-storage.com';
const trustedUrl = `https://${trustedHost}/monstajam/covers/test.png`;
const imageTypes = ['jpeg', 'png', 'webp', 'gif'] as const;
const images = {} as Record<typeof imageTypes[number], Buffer>;
const downloadLimit = 25 * 1024 * 1024;

before(async () => {
  for (const format of imageTypes) {
    images[format] = await sharp({
      create: { width: 3, height: 2, channels: 3, background: '#335577' },
    }).toFormat(format).toBuffer();
  }
});

beforeEach(() => {
  mock.method(console, 'error', () => {});
});

afterEach(() => {
  mock.restoreAll();
});

function coverRequest(url: string | null = trustedUrl) {
  const query = url === null ? '' : `?url=${encodeURIComponent(url)}`;
  return new NextRequest(`http://localhost/api/cover${query}`);
}

function bodyResponse(body: Uint8Array | string, contentType = 'image/png', headers: Record<string, string> = {}) {
  return new Response(typeof body === 'string' ? body : new Uint8Array(body), {
    headers: { 'Content-Type': contentType, ...headers },
  });
}

async function assertSafeError(response: Response, status?: number) {
  if (status !== undefined) assert.equal(response.status, status);
  assert.equal(response.ok, false);
  assert.match(response.headers.get('Content-Type') ?? '', /^application\/json\b/);
  assert.match(response.headers.get('Cache-Control') ?? '', /\bno-store\b/);
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  const payload = await response.json();
  assert.deepEqual(Object.keys(payload), ['error']);
  assert.equal(typeof payload.error, 'string');
  assert.ok(payload.error.length > 0 && payload.error.length < 150);
  assert.doesNotMatch(payload.error, /secret-upstream|<script|sensitive database|example\.invalid/i);
}

for (const [name, url] of [
  ['missing URL', null],
  ['non-URL value', 'not a URL'],
  ['hostname text in query', 'https://example.invalid/?blob.vercel-storage.com'],
  ['hostname text in path', `https://example.invalid/${trustedHost}/image.png`],
  ['trusted hostname followed by an evil suffix', `https://${trustedHost}.example.invalid/monstajam/covers/image.png`],
  ['trusted hostname in userinfo', `https://${trustedHost}@example.invalid/image.png`],
  ['credentials on the trusted host', `https://user:password@${trustedHost}/monstajam/covers/image.png`],
  ['plain HTTP', trustedUrl.replace('https:', 'http:')],
  ['a non-HTTPS port', trustedUrl.replace('.com/', '.com:444/')],
  ['private IPv4', 'https://127.0.0.1/image.png?blob.vercel-storage.com'],
  ['private IPv6', 'https://[::1]/image.png?blob.vercel-storage.com'],
  ['cloud metadata IP', 'https://169.254.169.254/?blob.vercel-storage.com'],
  ['a private Blob hostname', 'https://uwuqs1lz48clguif.private.blob.vercel-storage.com/monstajam/covers/image.png'],
  ['another public Blob store', 'https://otherstore.public.blob.vercel-storage.com/monstajam/covers/image.png'],
  ['a URL fragment', `${trustedUrl}#ignored`],
  ['an audio path on the trusted host', `https://${trustedHost}/monstajam/audio/song.mp3`],
  ['a misleading covers prefix', `https://${trustedHost}/monstajam/covers-evil/image.png`],
  ['a normalized parent-path escape', `https://${trustedHost}/monstajam/covers/../audio/song.mp3`],
] as const) {
  test(`rejects ${name} before any upstream request`, async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () => {
      assert.fail('An invalid cover URL must never be fetched');
    });

    await assertSafeError(await GET(coverRequest(url)), 400);
    assert.equal(fetchMock.mock.callCount(), 0);
  });
}

for (const status of [301, 302, 307, 308]) {
  test(`an upstream ${status} redirect cannot reach an untrusted host`, async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
      assert.ok(init?.redirect === 'error' || init?.redirect === 'manual', 'automatic redirects must be disabled');
      return new Response(null, { status, headers: { Location: 'https://example.invalid/secret-upstream' } });
    });

    await assertSafeError(await GET(coverRequest()), 502);
    assert.equal(fetchMock.mock.callCount(), 1);
  });
}

for (const [name, content, mime] of [
  ['HTML', '<html><script>secret-upstream</script></html>', 'text/html'],
  ['SVG', '<svg xmlns="http://www.w3.org/2000/svg"><script>secret-upstream</script></svg>', 'image/svg+xml'],
  ['JSON', '{"secret-upstream":true}', 'application/json'],
  ['audio', 'RIFF\u0000\u0000\u0000\u0000WAVEfmt secret-upstream', 'audio/wav'],
  ['generic binary', '\u0000\u0001\u0002secret-upstream', 'application/octet-stream'],
] as const) {
  for (const type of [mime, 'image/png']) {
    test(`rejects ${name} bytes with ${type} MIME`, async () => {
      mock.method(globalThis, 'fetch', async () => bodyResponse(content, type));

      await assertSafeError(await GET(coverRequest()), 415);
    });
  }
}

for (const [name, data, mime] of [
  ['JPEG signature only', Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg'],
  ['PNG signature only', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png'],
  ['invalid WebP container', Buffer.from('RIFF\u0000\u0000\u0000\u0000WEBP'), 'image/webp'],
] as const) {
  test(`rejects malformed ${name}`, async () => {
    mock.method(globalThis, 'fetch', async () => bodyResponse(data, mime));

    await assertSafeError(await GET(coverRequest()), 415);
  });
}

for (const format of imageTypes) {
  test(`serves a genuine ${format} with a verified image type and safe headers`, async () => {
    mock.method(globalThis, 'fetch', async () => bodyResponse(images[format], `image/${format}`));

    const response = await GET(coverRequest());

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(response.headers.get('Content-Disposition'), 'inline');
    assert.match(response.headers.get('Content-Security-Policy') ?? '', /default-src 'none'/);
    assert.match(response.headers.get('Content-Security-Policy') ?? '', /sandbox/);
    const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    assert.equal(metadata.width, 3);
    assert.equal(metadata.height, 2);
    assert.equal(response.headers.get('Content-Type'), `image/${metadata.format}`);
  });
}

test('re-encodes a genuine image instead of returning an appended HTML payload', async () => {
  const appended = Buffer.concat([images.png, Buffer.from('<script>secret-upstream</script>')]);
  mock.method(globalThis, 'fetch', async () => bodyResponse(appended));

  const response = await GET(coverRequest());

  assert.equal(response.status, 200);
  const output = Buffer.from(await response.arrayBuffer());
  assert.equal(output.includes(Buffer.from('secret-upstream')), false);
  assert.equal((await sharp(output).metadata()).width, 3);
});

test('does not scan arbitrary HTML for embedded image magic bytes', async () => {
  const embedded = Buffer.concat([Buffer.from('<html>secret-upstream'), images.png, Buffer.from('</html>')]);
  mock.method(globalThis, 'fetch', async () => bodyResponse(embedded));

  await assertSafeError(await GET(coverRequest()), 415);
});

test('upstream fetch failures return a generic uncached JSON error', async () => {
  mock.method(globalThis, 'fetch', async () => {
    throw new Error('secret-upstream connection to https://example.invalid failed');
  });

  await assertSafeError(await GET(coverRequest()), 502);
});

test('upstream error bodies are never forwarded to the browser', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('<script>secret-upstream</script>', {
    status: 500, headers: { 'Content-Type': 'text/html' },
  }));

  await assertSafeError(await GET(coverRequest()), 502);
});

test('a missing upstream object returns only a generic uncached not-found error', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('secret-upstream missing object', { status: 404 }));

  await assertSafeError(await GET(coverRequest()), 404);
});

test('a partial upstream response is rejected instead of being treated as a complete image', async () => {
  mock.method(globalThis, 'fetch', async () => new Response(new Uint8Array(images.png), { status: 206 }));

  await assertSafeError(await GET(coverRequest()), 502);
});

test('rejects an oversized advertised body without decoding it', async () => {
  mock.method(globalThis, 'fetch', async () => bodyResponse(images.png, 'image/png', {
    'Content-Length': String(downloadLimit + 1),
  }));

  await assertSafeError(await GET(coverRequest()), 413);
});

for (const contentLength of [undefined, '1']) {
  test(`bounds streamed bytes even when Content-Length is ${contentLength ?? 'missing'}`, async () => {
    let sent = 0;
    const chunk = new Uint8Array(1024 * 1024);
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent > downloadLimit + chunk.length) {
          controller.close();
          return;
        }
        sent += chunk.length;
        controller.enqueue(chunk);
      },
    });
    mock.method(globalThis, 'fetch', async () => new Response(stream, {
      headers: contentLength ? { 'Content-Length': contentLength } : undefined,
    }));

    await assertSafeError(await GET(coverRequest()), 413);
  });
}

test('an image larger than the 4MiB sanitized-output limit is rejected', async () => {
  const noisyPixels = randomFillSync(Buffer.alloc(1600 * 1600 * 3));
  const largePng = await sharp(noisyPixels, { raw: { width: 1600, height: 1600, channels: 3 } }).png().toBuffer();
  assert.ok(largePng.length > 4 * 1024 * 1024 && largePng.length < downloadLimit);
  mock.method(globalThis, 'fetch', async () => bodyResponse(largePng));

  await assertSafeError(await GET(coverRequest()), 413);
});

test('rejects images exceeding the decoded pixel limit', async () => {
  const hugePixels = await sharp({
    create: { width: 6500, height: 6500, channels: 3, background: '#445566' },
  }).png().toBuffer();
  assert.ok(hugePixels.length < downloadLimit);
  mock.method(globalThis, 'fetch', async () => bodyResponse(hugePixels));

  await assertSafeError(await GET(coverRequest()), 415);
});

function multipart(body: Uint8Array, options: { headers?: string; closing?: string } = {}) {
  const boundary = '----FormBoundarysecuritytest';
  const headers = options.headers ?? 'Content-Disposition: form-data; name="file"; filename="cover.png"\r\nContent-Type: image/png';
  const closing = options.closing ?? `\r\n--${boundary}--\r\n`;
  return Buffer.concat([Buffer.from(`--${boundary}\r\n${headers}\r\n\r\n`), body, Buffer.from(closing)]);
}

for (const contentType of ['image/png', 'multipart/form-data; boundary=----FormBoundarysecuritytest']) {
  test(`cleans a legacy single-file multipart image labeled ${contentType}`, async () => {
    mock.method(globalThis, 'fetch', async () => bodyResponse(multipart(images.png), contentType));

    const response = await GET(coverRequest());

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'image/png');
    const output = Buffer.from(await response.arrayBuffer());
    assert.equal(output.includes(Buffer.from('Content-Disposition')), false);
    assert.equal((await sharp(output).metadata()).width, 3);
  });
}

for (const [name, options] of [
  ['without filename', { headers: 'Content-Disposition: form-data; name="file"\r\nContent-Type: image/png' }],
  ['with oversized part headers', { headers: `Content-Disposition: form-data; name="file"; filename="${'a'.repeat(4096)}.png"` }],
  ['without closing boundary', { closing: '' }],
  ['with mismatched closing boundary', { closing: '\r\n--different--\r\n' }],
  ['with bytes after the closing boundary', { closing: '\r\n------FormBoundarysecuritytest--\r\n<script>secret-upstream</script>' }],
] as const) {
  test(`rejects a multipart wrapper ${name}`, async () => {
    mock.method(globalThis, 'fetch', async () => bodyResponse(multipart(images.png, options)));

    await assertSafeError(await GET(coverRequest()), 415);
  });
}

test('rejects multipart data containing multiple files', async () => {
  const secondPart = Buffer.concat([
    Buffer.from('\r\n------FormBoundarysecuritytest\r\nContent-Disposition: form-data; name="extra"; filename="second.png"\r\nContent-Type: image/png\r\n\r\n'),
    images.png,
  ]);
  mock.method(globalThis, 'fetch', async () => bodyResponse(multipart(Buffer.concat([images.png, secondPart]))));

  await assertSafeError(await GET(coverRequest()), 415);
});

test('a valid multipart wrapper cannot disguise an active-content payload', async () => {
  mock.method(globalThis, 'fetch', async () => bodyResponse(multipart(Buffer.from('<script>secret-upstream</script>'))));

  await assertSafeError(await GET(coverRequest()), 415);
});

test('a ten-second fetch timeout produces a generic uncached gateway-timeout response', async () => {
  const timedOut = AbortSignal.abort(new DOMException('secret-upstream timeout', 'TimeoutError'));
  const deadline = mock.method(AbortSignal, 'timeout', (milliseconds: number) => {
    assert.equal(milliseconds, 10_000);
    return timedOut;
  });
  mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
    assert.equal(init?.signal, timedOut);
    throw timedOut.reason;
  });

  await assertSafeError(await GET(coverRequest()), 504);
  assert.equal(deadline.mock.callCount(), 1);
});

test('a body stream failure does not expose upstream details', async () => {
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.error(new Error('secret-upstream stream failure'));
    },
  });
  mock.method(globalThis, 'fetch', async () => new Response(stream));

  await assertSafeError(await GET(coverRequest()), 502);
});

test('the download deadline also stops a stalled response body', { timeout: 1000 }, async () => {
  const controller = new AbortController();
  mock.method(AbortSignal, 'timeout', () => controller.signal);
  const stream = new ReadableStream<Uint8Array>({
    pull() {
      return new Promise<void>((resolve) => {
        setImmediate(() => {
          controller.abort(new DOMException('secret-upstream stalled download', 'TimeoutError'));
          resolve();
        });
      });
    },
  });
  mock.method(globalThis, 'fetch', async () => new Response(stream));

  await assertSafeError(await GET(coverRequest()), 504);
});

test('cover source parsing keeps percent-encoded path and query data intact', () => {
  const encoded = `https://${trustedHost}/monstajam/covers/cold%20world%2525.png?name=A%26B&download=1`;

  assert.equal(parseCoverSource(encoded)?.href, encoded);
  const proxy = new URL(proxyCoverUrl(encoded), 'http://localhost');
  assert.equal(proxy.pathname, '/api/cover');
  assert.equal(proxy.searchParams.get('url'), encoded);
  assert.equal(proxy.searchParams.get('v'), '2');
  assert.equal(proxy.searchParams.size, 2);
});

test('the versioned proxy URL fetches the exact stored encoded source', async () => {
  const encoded = `https://${trustedHost}/monstajam/covers/file%20with%25characters.png?original=A%26B`;
  const fetchMock = mock.method(globalThis, 'fetch', async (url: unknown) => {
    assert.equal(url, encoded);
    return bodyResponse(images.png);
  });

  const response = await GET(new NextRequest(new URL(proxyCoverUrl(encoded), 'http://localhost')));

  assert.equal(response.status, 200);
  assert.equal(fetchMock.mock.callCount(), 1);
});

for (const value of [null, undefined, '']) {
  test(`empty artwork value ${String(value)} remains empty`, () => {
    assert.equal(parseCoverSource(value), null);
    assert.equal(proxyCoverUrl(value), '');
  });
}

test('other image sources are not rewritten through the trusted artwork proxy', () => {
  for (const source of ['/monstajam-logo.png', 'https://example.invalid/image.png?blob.vercel-storage.com']) {
    assert.equal(parseCoverSource(source), null);
    assert.equal(proxyCoverUrl(source), source);
  }
});

test('an explicit default HTTPS port is accepted while credentials remain disallowed', () => {
  const defaultPort = trustedUrl.replace('.com/', '.com:443/');

  assert.equal(parseCoverSource(defaultPort)?.href, trustedUrl);
  assert.equal(parseCoverSource(trustedUrl.replace('https://', 'https://user@')), null);
});
