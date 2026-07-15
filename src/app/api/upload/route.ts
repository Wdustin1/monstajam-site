import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { isAdminRequest } from '@/lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const bodySizeLimit = '50mb';

const AUDIO_CONTENT_TYPES = [
  'audio/*',
  'application/octet-stream',
];

const COVER_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/octet-stream',
];

function uploadLimitsForPath(pathname: string) {
  if (pathname.startsWith('monstajam/audio/')) {
    return {
      allowedContentTypes: AUDIO_CONTENT_TYPES,
      maximumSizeInBytes: 500 * 1024 * 1024,
    };
  }

  if (pathname.startsWith('monstajam/covers/')) {
    return {
      allowedContentTypes: COVER_CONTENT_TYPES,
      maximumSizeInBytes: 25 * 1024 * 1024,
    };
  }

  throw new Error('Invalid upload path');
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = (await req.json()) as HandleUploadBody;

      const jsonResponse = await handleUpload({
        body,
        request: req,
        onBeforeGenerateToken: async (pathname) => ({
          ...uploadLimitsForPath(pathname),
          allowOverwrite: false,
          addRandomSuffix: false,
          validUntil: Date.now() + 10 * 60 * 1000,
        }),
      });

      return NextResponse.json(jsonResponse);
    }

    return NextResponse.json({ error: 'Unsupported upload request' }, { status: 415 });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
