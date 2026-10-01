import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { isAdminRequest } from '@/lib/auth';
import { audioToken, isOriginalPath, MAX_AUDIO_BYTES } from '@/lib/audio-storage';

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
  if (isOriginalPath(pathname)) {
    return {
      allowedContentTypes: AUDIO_CONTENT_TYPES,
      maximumSizeInBytes: MAX_AUDIO_BYTES,
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
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = (await req.json()) as HandleUploadBody;
      if (body.type !== 'blob.generate-client-token') {
        return NextResponse.json({ error: 'Invalid upload request' }, { status: 400 });
      }
      const pathname = body.payload.pathname;
      uploadLimitsForPath(pathname);

      const jsonResponse = await handleUpload({
        body,
        request: req,
        token: isOriginalPath(pathname) ? audioToken() : process.env.BLOB_READ_WRITE_TOKEN,
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
    if (folder !== 'covers') {
      return NextResponse.json({ error: 'Use private direct uploads for audio.' }, { status: 422 });
    }

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!(file instanceof File) || file.size > 25 * 1024 * 1024 || !COVER_CONTENT_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Choose an image of 25 MB or less.' }, { status: 422 });
    }

    const ext = file.name.split('.').pop() || 'bin';
    const path = `monstajam/${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const blob = await put(path, file, {
      access: 'public',
      contentType: file.type || 'application/octet-stream',
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error('Upload failed', err instanceof Error ? err.name : 'Unknown error');
    return NextResponse.json({ error: 'Upload could not start. Check your file and try again. Your saved track has not changed.' }, { status: 500 });
  }
}
