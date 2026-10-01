import { createHash } from 'node:crypto';
import { setServers } from 'node:dns';
import { mkdir, open, readFile, realpath, stat } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { BSON, MongoClient, ObjectId, type Collection, type Document, type Filter } from 'mongodb';
import { get, put } from '@vercel/blob';
import { createAudioPreview } from '../src/lib/audio-preview';

// This script deliberately does not load .env files or import Prisma. The caller
// must select a database explicitly in DATABASE_URL; apply requires a second gate.
const PUBLIC_HOST = 'uwuqs1lz48clguif.public.blob.vercel-storage.com';
const MAX_BYTES = 500 * 1024 * 1024;
const REPOSITORY = resolve(__dirname, '..');
const ejson = (value: unknown) => BSON.EJSON.stringify(value, { relaxed: false });
let stage = 'preflight';

function safeDiagnostic(error: unknown) {
  const knownNames = new Set([
    'Error', 'TypeError', 'RangeError', 'SyntaxError', 'AbortError', 'TimeoutError',
    'BlobError', 'BlobAccessError', 'BlobNotFoundError', 'BlobUnknownError', 'BlobRequestAbortedError',
    'BlobServiceNotAvailable', 'BlobServiceRateLimited', 'BlobStoreNotFoundError', 'BlobStoreSuspendedError',
    'BlobPreconditionFailedError', 'MongoServerError', 'MongoNetworkError', 'MongoServerSelectionError',
  ]);
  const record = error && typeof error === 'object' ? error as { name?: unknown; message?: unknown; code?: unknown; cause?: { code?: unknown } } : {};
  const code = record.code ?? record.cause?.code;
  const safeCodes = new Set(['EPIPE', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ENOENT', 'EPERM', 'EACCES', 'ETIMEDOUT', 'ERR_INVALID_ARG_TYPE', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET']);
  // Extract only a status number from the SDK's fixed error wording. Never log
  // the complete message: upstream errors can contain tokens or object URLs.
  const responseStatus = typeof record.message === 'string' ? /Failed to fetch blob: ([1-5]\d{2})\b/.exec(record.message)?.[1] : undefined;
  return {
    stage,
    errorName: typeof record.name === 'string' && knownNames.has(record.name) ? record.name : 'UnknownError',
    ...(typeof code === 'number' || (typeof code === 'string' && safeCodes.has(code)) ? { errorCode: code } : {}),
    ...(responseStatus ? { responseStatus: Number(responseStatus) } : {}),
  };
}

class MigrationError extends Error {
  constructor(readonly code: string) { super(code); }
}

type Options = { apply: boolean; expected?: string; backup?: string; limit?: number; help: boolean };
type Fingerprint = { sha256: string; bytes: number };
type ReadyBlob = { stream: ReadableStream<Uint8Array>; blob: { size: number; contentType: string | null } };
type Asset = Document & {
  _id: ObjectId; key: string; originalPath: string; originalName: string;
  previewPath: string; previewStart: number; previewDuration: number; status: string;
};

function optionsFromArgs(args: string[]): Options {
  const options: Options = { apply: false, help: false };
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (seen.has(argument)) throw new MigrationError('duplicate-option');
    seen.add(argument);
    if (argument === '--apply') options.apply = true;
    else if (argument === '--help') options.help = true;
    else if (['--expect-database', '--backup', '--limit'].includes(argument)) {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new MigrationError('missing-option-value');
      if (argument === '--expect-database') options.expected = value;
      if (argument === '--backup') options.backup = value;
      if (argument === '--limit') {
        if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) throw new MigrationError('invalid-limit');
        options.limit = Number(value);
      }
    } else throw new MigrationError('unknown-option');
  }
  if (options.apply && (!options.expected || !options.backup)) throw new MigrationError('apply-requires-exact-database-and-backup');
  return options;
}

function sourceUrl(value: unknown): URL {
  if (typeof value !== 'string' || /[\s\\]/.test(value)) throw new MigrationError('unapproved-public-source');
  const url = new URL(value);
  const path = decodeURIComponent(url.pathname);
  if (url.protocol !== 'https:' || url.hostname !== PUBLIC_HOST || url.port || url.username || url.password || url.search || url.hash ||
    !path.startsWith('/monstajam/audio/') || path === '/monstajam/audio/' || path.split('/').some((part) => part === '..' || part === '.')) {
    throw new MigrationError('unapproved-public-source');
  }
  return url;
}

function modeFor(track: Document): 'preview' | 'full' {
  if (track.playbackMode === 'preview' || track.playbackMode === 'full') return track.playbackMode;
  if (track.playbackMode != null) throw new MigrationError('invalid-existing-playback-mode');
  return track.genre === 'Full Songs' ? 'full' : 'preview';
}

function outsideRepository(path: string, repository: string) {
  const difference = relative(repository, path);
  return difference !== '' && (difference === '..' || difference.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(difference));
}

async function openBackup(path: string, database: string) {
  if (!isAbsolute(path)) throw new MigrationError('backup-must-be-absolute-outside-repository');
  const repository = await realpath(REPOSITORY);
  if (!outsideRepository(resolve(path), repository)) throw new MigrationError('backup-must-be-outside-repository');
  // Resolve existing ancestors before creating directories, including Windows
  // junctions, so an apparently external destination cannot write into the repo.
  let ancestor = dirname(path);
  let resolvedAncestor: string;
  while (true) {
    try {
      resolvedAncestor = await realpath(ancestor);
      break;
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error;
      const parent = dirname(ancestor);
      if (parent === ancestor) throw new MigrationError('invalid-backup-target');
      ancestor = parent;
    }
  }
  const destination = resolve(resolvedAncestor, relative(ancestor, dirname(path)), basename(path));
  if (!outsideRepository(destination, repository)) throw new MigrationError('backup-must-be-outside-repository');
  await mkdir(dirname(path), { recursive: true });
  const resolvedParent = await realpath(dirname(path));
  const resolvedPath = resolve(resolvedParent, basename(path));
  if (!outsideRepository(resolvedPath, repository)) throw new MigrationError('backup-must-be-outside-repository');
  const backedUp = new Set<string>();
  let handle: FileHandle;
  try {
    handle = await open(resolvedPath, 'wx', 0o600);
    await handle.writeFile(`${ejson({ type: 'audio-migration-manifest', version: 1, database, createdAt: new Date() })}\n`);
    await handle.sync();
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')) throw error;
    const existingPath = await realpath(resolvedPath);
    if (!outsideRepository(existingPath, repository) || !(await stat(existingPath)).isFile()) throw new MigrationError('invalid-backup-target');
    const lines = (await readFile(existingPath, 'utf8')).split('\n').filter(Boolean);
    const entries = lines.map((line) => BSON.EJSON.parse(line, { relaxed: false }));
    if (entries[0]?.type !== 'audio-migration-manifest' || Number(entries[0].version) !== 1 || entries[0].database !== database) {
      throw new MigrationError('backup-manifest-does-not-match-database');
    }
    for (const entry of entries) if (entry.type === 'track-backup' && entry.track) backedUp.add(backupKey(entry.track));
    handle = await open(existingPath, 'a');
  }
  return {
    async append(entry: unknown) {
      await handle.writeFile(`${ejson(entry)}\n`);
      await handle.sync();
    },
    async saveTrack(track: Document) {
      const key = backupKey(track);
      if (backedUp.has(key)) return;
      await handle.writeFile(`${ejson({ type: 'track-backup', capturedAt: new Date(), track })}\n`);
      await handle.sync();
      backedUp.add(key);
    },
    close: () => handle.close(),
  };
}

function backupKey(track: Document) {
  return createHash('sha256').update(ejson({ id: track._id, audioUrl: track.audioUrl, updatedAt: track.updatedAt })).digest('hex');
}

async function blob(path: string, access: 'public' | 'private', token: string): Promise<ReadyBlob | null> {
  if (access === 'public') {
    // Legacy public objects reject the SDK's authenticated cache-bypass query.
    // Download only an approved public URL; do not forward credentials or follow
    // redirects to an unapproved host.
    const response = await fetch(sourceUrl(path).href, {
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(240_000),
    });
    if (response.status === 404) {
      void response.body?.cancel().catch(() => {});
      return null;
    }
    const size = Number(response.headers.get('content-length'));
    if (response.status !== 200 || response.headers.has('content-range') || !response.body || !Number.isSafeInteger(size) || size <= 0 || size > MAX_BYTES) {
      void response.body?.cancel().catch(() => {});
      throw new MigrationError(`invalid-public-audio-response-${response.status}`);
    }
    return { stream: response.body, blob: { size, contentType: response.headers.get('content-type') } };
  }
  const result = await get(path, { access, token, useCache: false, abortSignal: AbortSignal.timeout(240_000) });
  if (!result) return null;
  if (result.statusCode !== 200 || result.headers.has('content-range') || result.blob.size <= 0 || result.blob.size > MAX_BYTES) {
    if (result.stream) void result.stream.cancel().catch(() => {});
    throw new MigrationError('invalid-audio-object');
  }
  return result;
}

async function fingerprint(stream: ReadableStream<Uint8Array>): Promise<Fingerprint> {
  const reader = stream.getReader();
  const hash = createHash('sha256');
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BYTES) throw new MigrationError('audio-exceeds-size-limit');
      hash.update(chunk.value);
    }
    if (bytes === 0) throw new MigrationError('empty-audio-object');
    return { sha256: hash.digest('hex'), bytes };
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function sameBytes(first: Fingerprint, second: Fingerprint) {
  if (first.sha256 !== second.sha256 || first.bytes !== second.bytes) throw new MigrationError('sha256-verification-failed');
}

async function verifiedOriginal(source: URL, path: string, publicToken: string, privateToken: string) {
  stage = 'read-public-original';
  const original = await blob(source.href, 'public', publicToken);
  if (!original) throw new MigrationError('public-original-not-found');
  stage = 'read-existing-private-original';
  const existing = await blob(path, 'private', privateToken);
  if (existing) {
    stage = 'verify-existing-original-hashes';
    const [sourceHash, storedHash] = await Promise.all([fingerprint(original.stream), fingerprint(existing.stream)]);
    sameBytes(sourceHash, storedHash);
    return { ...sourceHash, reused: true };
  }
  const hash = createHash('sha256');
  let bytes = 0;
  const counted = original.stream.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      if (bytes > MAX_BYTES) throw new MigrationError('audio-exceeds-size-limit');
      hash.update(chunk);
      controller.enqueue(chunk);
    },
  }));
  stage = 'upload-private-original';
  await put(path, counted, {
    access: 'private', token: privateToken, multipart: true, addRandomSuffix: false, allowOverwrite: false,
    contentType: original.blob.contentType || 'application/octet-stream', abortSignal: AbortSignal.timeout(240_000),
  });
  const sourceHash = { sha256: hash.digest('hex'), bytes };
  if (bytes === 0 || bytes !== original.blob.size) throw new MigrationError('original-length-verification-failed');
  stage = 'verify-uploaded-original-hash';
  const copied = await blob(path, 'private', privateToken);
  if (!copied) throw new MigrationError('private-original-not-found');
  sameBytes(sourceHash, await fingerprint(copied.stream));
  return { ...sourceHash, reused: false };
}

async function verifiedPreview(path: string, bytes: Buffer, token: string) {
  const expected = { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
  stage = 'read-existing-private-preview';
  let existing = await blob(path, 'private', token);
  const reused = Boolean(existing);
  if (!existing) {
    stage = 'upload-private-preview';
    await put(path, bytes, {
      access: 'private', token, contentType: 'audio/mpeg', addRandomSuffix: false,
      allowOverwrite: false, abortSignal: AbortSignal.timeout(30_000),
    });
    stage = 'verify-uploaded-preview-hash';
    existing = await blob(path, 'private', token);
  }
  if (!existing) throw new MigrationError('private-preview-not-found');
  sameBytes(expected, await fingerprint(existing.stream));
  return { ...expected, reused };
}

async function ensureUniqueKey(assets: Collection<Asset>) {
  let indexes;
  try { indexes = await assets.listIndexes().toArray(); }
  catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 26)) throw error;
    indexes = [];
  }
  if (indexes.some((index) => index.unique && index.key?.key === 1 && Object.keys(index.key).length === 1)) return;
  await assets.createIndex({ key: 1 }, { unique: true });
}

function validAsset(asset: Asset, originalPath: string) {
  if (!(asset._id instanceof ObjectId) || asset.originalPath !== originalPath || asset.previewStart !== 0 || asset.status !== 'ready' ||
    !/^monstajam\/previews\/[a-zA-Z0-9._-]+\.mp3$/.test(asset.previewPath) ||
    !Number.isFinite(asset.previewDuration) || asset.previewDuration <= 0 || asset.previewDuration > 45) {
    throw new MigrationError('existing-asset-is-not-safe-to-reuse');
  }
}

async function migrateTrack(track: Document, tracks: Collection<Document>, assets: Collection<Asset>, tokens: { public: string; private: string }) {
  stage = 'validate-track-source';
  const source = sourceUrl(track.audioUrl);
  const mode = modeFor(track);
  const sourceId = createHash('sha256').update(source.href).digest('hex');
  const extension = extname(source.pathname).slice(1);
  const suffix = /^[a-zA-Z0-9]{1,8}$/.test(extension) ? extension.toLowerCase() : 'bin';
  const originalPath = `monstajam/originals/legacy-${sourceId}.${suffix}`;
  // Same key contract as src/lib/audio-assets.ts, without importing Prisma.
  const key = createHash('sha256').update(`${originalPath}\n0`).digest('hex');
  stage = 'read-existing-audio-asset';
  let asset = await assets.findOne({ key });
  if (asset) validAsset(asset, originalPath);
  const original = await verifiedOriginal(source, originalPath, tokens.public, tokens.private);
  stage = 'read-private-original-for-preview';
  const privateOriginal = await blob(originalPath, 'private', tokens.private);
  if (!privateOriginal) throw new MigrationError('private-original-not-found');
  stage = 'generate-preview';
  const generated = await createAudioPreview(privateOriginal.stream, 0);
  const previewPath = asset?.previewPath ?? `monstajam/previews/legacy-${sourceId}-0.mp3`;
  const preview = await verifiedPreview(previewPath, generated.bytes, tokens.private);
  if (!asset) {
    const now = new Date();
    const candidate: Asset = {
      _id: new ObjectId(), key, originalPath, originalName: decodeURIComponent(basename(source.pathname)),
      previewPath, previewStart: 0, previewDuration: generated.duration, status: 'ready', error: null,
      createdAt: now, updatedAt: now,
    };
    try {
      stage = 'insert-ready-audio-asset';
      await assets.insertOne(candidate);
      asset = candidate;
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 11000)) throw error;
      asset = await assets.findOne({ key });
      if (!asset) throw new MigrationError('asset-resume-conflict');
      validAsset(asset, originalPath);
      // A concurrently-created record may reference another valid preview path.
      await verifiedPreview(asset.previewPath, generated.bytes, tokens.private);
    }
  }
  const filter: Filter<Document> = {
    _id: track._id,
    audioUrl: track.audioUrl,
    audioAssetId: null,
    updatedAt: Object.hasOwn(track, 'updatedAt') ? track.updatedAt : { $exists: false },
  };
  stage = 'attach-audio-asset';
  const result = await tracks.updateOne(filter, {
    $set: { audioAssetId: asset._id, audioUrl: null, playbackMode: mode, updatedAt: new Date() },
  });
  if (result.matchedCount !== 1) throw new MigrationError('track-changed-before-attach');
  stage = 'verify-track-attachment';
  const attached = await tracks.findOne({ _id: track._id });
  if (!(attached?.audioAssetId instanceof ObjectId) || !attached.audioAssetId.equals(asset._id) || attached.audioUrl !== null || attached.playbackMode !== mode) {
    throw new MigrationError('track-attach-readback-failed');
  }
  return { original, preview, assetId: asset._id, mode };
}

async function main() {
  const options = optionsFromArgs(process.argv.slice(2));
  if (options.help) {
    console.log('Dry run: tsx scripts/migrate-audio.ts [--expect-database NAME] [--limit N]\nApply: add --apply --expect-database EXACT_NAME --backup ABSOLUTE_OUTSIDE_REPO.ejsonl\nRequires explicit DATABASE_URL; apply additionally requires BLOB_READ_WRITE_TOKEN and AUDIO_READ_WRITE_TOKEN. Public blobs are never deleted.');
    return;
  }
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new MigrationError('database-url-required');
  const parsed = new URL(uri);
  const databaseName = decodeURIComponent(parsed.pathname.slice(1));
  if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) || !databaseName || databaseName.includes('/')) throw new MigrationError('explicit-database-name-required');
  if (options.expected && options.expected !== databaseName) throw new MigrationError('database-name-does-not-match');
  const tokens = { public: process.env.BLOB_READ_WRITE_TOKEN ?? '', private: process.env.AUDIO_READ_WRITE_TOKEN ?? '' };
  if (options.apply) {
    const publicStore = tokens.public.split('_')[3]?.toLowerCase();
    const privateStore = tokens.private.split('_')[3]?.toLowerCase();
    if (`${publicStore}.public.blob.vercel-storage.com` !== PUBLIC_HOST || !privateStore || publicStore === privateStore) {
      throw new MigrationError('distinct-public-and-private-store-tokens-required');
    }
  }
  setServers(['1.1.1.1', '8.8.8.8']);
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15_000, connectTimeoutMS: 15_000, writeConcern: { w: 'majority' } });
  let backup: Awaited<ReturnType<typeof openBackup>> | undefined;
  const counts = { selected: 0, eligible: 0, migrated: 0, failed: 0, originalsReused: 0, previewsReused: 0 };
  try {
    await client.connect();
    const database = client.db();
    if (database.databaseName !== databaseName || (options.expected && database.databaseName !== options.expected)) throw new MigrationError('connected-database-does-not-match');
    const tracks = database.collection('tracks');
    const assets = database.collection<Asset>('audio_assets');
    const cursor = tracks.find({ audioUrl: { $type: 'string', $ne: '' }, audioAssetId: null }).sort({ _id: 1 });
    if (options.limit) cursor.limit(options.limit);
    const candidates = await cursor.toArray();
    counts.selected = candidates.length;
    const eligible: Document[] = [];
    for (const track of candidates) {
      try {
        if (!(track._id instanceof ObjectId)) throw new MigrationError('invalid-track-identity');
        sourceUrl(track.audioUrl);
        modeFor(track);
        eligible.push(track);
      } catch {
        counts.failed++;
        console.log(JSON.stringify({ slug: track.slug ?? '<missing>', status: 'ineligible', checks: { approvedSourceAndMode: false } }));
      }
    }
    counts.eligible = eligible.length;
    if (options.apply && eligible.length) {
      backup = await openBackup(options.backup!, databaseName);
      // Every candidate is durable in the manifest before any database/blob write.
      for (const track of eligible) await backup.saveTrack(track);
      stage = 'ensure-asset-key-unique-index';
      await ensureUniqueKey(assets);
    }
    for (const track of eligible) {
      if (!options.apply) {
        console.log(JSON.stringify({ slug: track.slug ?? '<missing>', status: 'dry-run', checks: { approvedSourceAndMode: true, wouldPreservePlaybackMode: true, publicOriginalRetained: true } }));
        continue;
      }
      try {
        const migrated = await migrateTrack(track, tracks, assets, tokens);
        counts.migrated++;
        counts.originalsReused += Number(migrated.original.reused);
        counts.previewsReused += Number(migrated.preview.reused);
        await backup!.append({ type: 'track-migrated', at: new Date(), trackId: track._id, assetId: migrated.assetId, original: migrated.original, preview: migrated.preview, playbackMode: migrated.mode });
        console.log(JSON.stringify({ slug: track.slug ?? '<missing>', status: 'migrated', checks: { originalSha256Verified: true, previewSha256Verified: true, attachmentReadbackVerified: true, publicOriginalRetained: true } }));
      } catch (error) {
        counts.failed++;
        const reason = error instanceof MigrationError ? error.code : 'migration-operation-failed';
        const diagnostic = safeDiagnostic(error);
        await backup!.append({ type: 'track-failed', at: new Date(), trackId: track._id, reason, ...diagnostic });
        console.log(JSON.stringify({ slug: track.slug ?? '<missing>', status: 'failed', checks: { completed: false }, reason, ...diagnostic }));
      }
    }
    console.log(JSON.stringify({ dryRun: !options.apply, counts, checks: { databaseMatchVerified: true, publicOriginalsRetained: true } }));
    if (counts.failed) process.exitCode = 1;
  } finally {
    await backup?.close();
    await client.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  void main().catch((error: unknown) => {
    // Never print driver/SDK errors, connection strings, tokens, or private URLs.
    console.error(JSON.stringify({ failed: 1, reason: error instanceof MigrationError ? error.code : 'migration-preflight-or-execution-failed', ...safeDiagnostic(error) }));
    process.exitCode = 1;
  });
}
