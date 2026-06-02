import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
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

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('bucket') as string) || 'covers';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'bin';
    const path = `monstajam/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const blob = await put(path, file, {
      access: 'public',
      contentType: file.type || 'application/octet-stream',
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error('Upload error:', err);
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
