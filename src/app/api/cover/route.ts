import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { parseCoverSource } from '@/lib/cover-source';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;
// Leave room under the hosting platform's response-size limit.
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
} as const;
type ImageFormat = keyof typeof IMAGE_TYPES;

class CoverError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

async function readImage(response: Response, signal: AbortSignal): Promise<Buffer> {
  const length = Number(response.headers.get('content-length'));
  if (length > MAX_DOWNLOAD_BYTES) {
    void response.body?.cancel().catch(() => {});
    throw new CoverError(413, 'Artwork is too large');
  }
  if (!response.body) throw new CoverError(415, 'Unsupported artwork');

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      // Keep the deadline active for the entire body, including a stalled stream.
      let onAbort: () => void = () => {};
      const aborted = new Promise<never>((_, reject) => {
        onAbort = () => reject(signal.reason);
        signal.addEventListener('abort', onAbort, { once: true });
      });
      const { done, value } = await Promise.race([reader.read(), aborted])
        .finally(() => signal.removeEventListener('abort', onAbort));
      if (done) break;
      size += value.byteLength;
      if (size > MAX_DOWNLOAD_BYTES) throw new CoverError(413, 'Artwork is too large');
      chunks.push(value);
    }
    return Buffer.concat(chunks, size);
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function unwrapLegacyUpload(input: Buffer): Buffer {
  if (input[0] !== 45 || input[1] !== 45) return input;

  // Some historic uploads stored one multipart file part instead of raw image
  // bytes. Recognize only that complete wrapper, never an arbitrary image prefix.
  const boundary = /^--([A-Za-z0-9'()+_,./:=?-]{1,70})\r\n/.exec(input.subarray(0, 76).toString('ascii'));
  const headerEnd = input.indexOf('\r\n\r\n');
  if (!boundary || headerEnd < 0 || headerEnd > 4096) {
    throw new CoverError(415, 'Unsupported artwork');
  }
  const headers = input.subarray(boundary[0].length, headerEnd).toString('utf8').split('\r\n');
  const disposition = headers.filter((line) => /^content-disposition:/i.test(line));
  if (
    disposition.length !== 1 ||
    !/^content-disposition:\s*form-data\s*;/i.test(disposition[0]) ||
    !/;\s*filename="[^"\r\n]+"(?:;|$)/i.test(disposition[0]) ||
    headers.some((line) => !/^[A-Za-z0-9-]+:[^\r\n]*$/.test(line))
  ) throw new CoverError(415, 'Unsupported artwork');

  const marker = Buffer.from(`\r\n--${boundary[1]}`);
  const closing = Buffer.from(`\r\n--${boundary[1]}--`);
  const end = input.subarray(-2).equals(Buffer.from('\r\n')) ? input.length - 2 : input.length;
  const bodyEnd = end - closing.length;
  if (
    bodyEnd <= headerEnd + 4 ||
    !input.subarray(bodyEnd, end).equals(closing) ||
    input.indexOf(marker, headerEnd + 4) !== bodyEnd
  ) throw new CoverError(415, 'Unsupported artwork');

  return input.subarray(headerEnd + 4, bodyEnd);
}

function imageFormat(input: Buffer): ImageFormat | null {
  if (input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (input[0] === 255 && input[1] === 216 && input[2] === 255) return 'jpeg';
  if (input.toString('ascii', 0, 4) === 'RIFF' && input.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (['GIF87a', 'GIF89a'].includes(input.toString('ascii', 0, 6))) return 'gif';
  return null;
}

export async function GET(request: NextRequest) {
  const source = parseCoverSource(request.nextUrl.searchParams.get('url'));
  if (!source) return errorResponse(400, 'Invalid artwork URL');

  const signal = AbortSignal.timeout(10_000);
  try {
    signal.throwIfAborted();
    const upstream = await fetch(source.href, {
      redirect: 'manual',
      cache: 'no-store',
      signal,
    });
    if (upstream.status !== 200) {
      void upstream.body?.cancel().catch(() => {});
      throw new CoverError(upstream.status === 404 ? 404 : 502, 'Artwork unavailable');
    }

    const input = unwrapLegacyUpload(await readImage(upstream, signal));
    const format = imageFormat(input);
    if (!format) throw new CoverError(415, 'Unsupported artwork');

    let output: Buffer;
    try {
      // Fully decode and reencode raster pixels. This strips metadata, wrappers,
      // and appended active content instead of trusting a MIME or signature alone.
      output = await sharp(input, { failOn: 'warning', limitInputPixels: 40_000_000, animated: true })
        .autoOrient()
        .timeout({ seconds: 5 })
        .toFormat(format)
        .toBuffer();
    } catch {
      throw new CoverError(415, 'Unsupported artwork');
    }
    if (output.length > MAX_OUTPUT_BYTES) throw new CoverError(413, 'Artwork is too large');

    return new NextResponse(new Uint8Array(output), {
      headers: {
        'Content-Type': IMAGE_TYPES[format],
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    if (error instanceof CoverError) return errorResponse(error.status, error.message);
    if (signal.aborted) return errorResponse(504, 'Artwork request timed out');
    return errorResponse(502, 'Artwork unavailable');
  }
}
