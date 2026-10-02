/* Local-only in-memory Prisma fixture. It never connects to a database. */
'use strict';
/* eslint-disable @typescript-eslint/no-require-imports -- Node preload must use CommonJS. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomBytes } = require('node:crypto');
const { Prisma } = require('@prisma/client');

const database = new URL(process.env.DATABASE_URL || 'file:///missing');
const controlPath = process.env.MONSTAJAM_ADMIN_SAVE_CONTROL || '';
const temporaryRoot = path.resolve(os.tmpdir()) + path.sep;
if (
  process.env.MONSTAJAM_ADMIN_SAVE_FIXTURES !== '1' ||
  !(process.env.NODE_ENV === 'development' || (process.env.NODE_ENV === 'production' && process.env.MONSTAJAM_ADMIN_SAVE_PRODUCTION === '1')) ||
  database.protocol !== 'mongodb:' || !['127.0.0.1', 'localhost', '[::1]'].includes(database.hostname) ||
  database.pathname !== '/monstajam_admin_save_test' || database.username || database.password ||
  !path.resolve(controlPath).startsWith(temporaryRoot) || !fs.existsSync(controlPath) ||
  process.env.MONSTAJAM_NAMED_AUTH_FIXTURES !== '1'
) throw new Error('Admin save fixture requires explicit local-only configuration and its temporary control file.');

let controls = {};
let consumedFailure = 0;
let consumedReadFailure = 0;
let appliedReset = -1;
let tracks;
let videos;
let audioAssets;

function resetRows() {
  const common = {
    artist: 'Fixture Artist', genre: 'Hip-Hop', bpm: 105, mood: 'Original fixture mood',
    color: 'bg-gradient-to-br from-purple-600 to-blue-500', accentCyan: false,
    subtitle: 'Local test subtitle', story: 'Original fixture story for clearing and saving.',
    spotifyUrl: 'https://example.invalid/spotify', appleMusicUrl: 'https://example.invalid/apple',
    audioUrl: null, coverUrl: null, credits: [],
    createdAt: new Date('2026-01-01T12:00:00Z'), updatedAt: new Date('2026-01-01T12:00:00Z'),
  };
  tracks = [
    { ...common, id: '000000000000000000000001', slug: 'admin-save-live', title: 'Fixture Live Track', number: 1, published: true, playbackMode: 'preview', audioAssetId: '000000000000000000000004' },
    { ...common, id: '000000000000000000000002', slug: 'admin-save-draft', title: 'Fixture Draft Track', number: 2, published: false, genre: 'Full Songs', playbackMode: null, audioAssetId: null },
  ];
  videos = [{ id: '000000000000000000000003', title: 'Fixture Video', artist: 'Fixture Video Artist',
    youtubeUrl: 'https://www.youtube.com/watch?v=LOCAL000001', youtubeId: 'LOCAL000001', duration: '3:45',
    published: true, order: 0, createdAt: common.createdAt, updatedAt: common.updatedAt }];
  audioAssets = [{ id: '000000000000000000000004', key: 'local-fixture-only',
    originalPath: 'monstajam/originals/local-fixture.wav', originalName: 'Local fixture.wav',
    previewPath: 'monstajam/previews/local-fixture.mp3', previewStart: 12.5, previewDuration: 45,
    status: 'ready', error: null, createdAt: common.createdAt, updatedAt: common.updatedAt }];
}

function refreshControls() {
  try {
    const updated = JSON.parse(fs.readFileSync(controlPath, 'utf8'));
    controls = updated;
    if ((updated.resetGeneration ?? 0) !== appliedReset) {
      appliedReset = updated.resetGeneration ?? 0;
      resetRows();
    }
  } catch { /* A partial editor write must not interrupt a running request. */ }
}
refreshControls();
fs.watchFile(controlPath, { persistent: false, interval: 100 }, refreshControls);

function matches(row, where = {}) {
  const equal = (left, right) => left instanceof Date || right instanceof Date
    ? new Date(left).getTime() === new Date(right).getTime() : left === right;
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND') return (Array.isArray(value) ? value : [value]).every((part) => matches(row, part));
    if (key === 'OR') return value.some((part) => matches(row, part));
    if (key === 'NOT') return (Array.isArray(value) ? value : [value]).every((part) => !matches(row, part));
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      return Object.entries(value).every(([operator, expected]) => {
        if (operator === 'isSet') return Object.hasOwn(row, key) === expected;
        if (operator === 'equals') return equal(row[key], expected);
        if (operator === 'not') return Object.hasOwn(row, key) && !equal(row[key], expected);
        if (operator === 'in') return expected.includes(row[key]);
        throw new Error('Unsupported local fixture filter: ' + operator);
      });
    }
    return equal(row[key], value);
  });
}

function read(model, args = {}) {
  refreshControls();
  if ((model === 'track' && controls.failTrackReads) || (model === 'video' && controls.failVideoReads) || (model === 'audioAsset' && controls.failAudioReads)) {
    throw new Error(`Intentional local fixture ${model} read failure`);
  }
  const failure = Number(controls.failReadGeneration || 0);
  if (failure > consumedReadFailure) {
    consumedReadFailure = failure;
    throw new Error('Intentional local fixture read failure');
  }
  const assetRows = controls.audioStatus === 'missing' ? [] : audioAssets.map((row) => ({ ...row,
    ...(controls.audioStatus ? { status: controls.audioStatus } : {}),
    ...(controls.previewDuration !== undefined ? { previewDuration: controls.previewDuration } : {}),
  }));
  let result = (model === 'track' ? tracks : model === 'video' ? videos : assetRows).filter((row) => matches(row, args.where));
  const orderBy = args.orderBy ? (Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy]) : [];
  result.sort((a, b) => {
    for (const order of orderBy) for (const [field, direction] of Object.entries(order)) {
      const comparison = a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0;
      if (comparison) return direction === 'desc' ? -comparison : comparison;
    }
    return 0;
  });
  if (args.skip) result = result.slice(args.skip);
  if (args.take !== undefined) result = result.slice(0, args.take);
  return result.map((row) => structuredClone(args.select
    ? Object.fromEntries(Object.entries(args.select).filter(([, enabled]) => enabled).map(([field]) => [field, row[field]]))
    : row));
}

async function mutate(model, operation, args) {
  if (model === 'audioAsset') throw new Error('This UI fixture does not prepare or write real audio assets.');
  refreshControls();
  const failure = Number(controls.failMutationGeneration || 0);
  const shouldFail = failure > consumedFailure;
  if (shouldFail) consumedFailure = failure;
  const delayMs = Math.min(10000, Math.max(0, Number(controls.delayMs || 0)));
  if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
  if (shouldFail) throw new Error('Intentional local fixture mutation failure');
  const rows = model === 'track' ? tracks : videos;
  const data = Object.fromEntries(Object.entries(args.data || {}).filter(([, value]) => value !== undefined));
  if (operation === 'create') {
    if (model === 'track' && rows.some((row) => row.slug === data.slug)) throw new Error('Duplicate fixture slug');
    const row = { id: randomBytes(12).toString('hex'), credits: [], published: false, createdAt: new Date(), updatedAt: new Date(), ...data };
    rows.push(row);
    return structuredClone(row);
  }
  const index = rows.findIndex((row) => matches(row, args.where));
  if (index < 0) throw new Prisma.PrismaClientKnownRequestError('Fixture record not found', { code: 'P2025', clientVersion: Prisma.prismaVersion.client });
  if (operation === 'delete') throw new Error('Permanent deletion is forbidden in the trash/restore fixture.');
  rows[index] = { ...rows[index], ...data, updatedAt: new Date() };
  return structuredClone(rows[index]);
}

function model(name) {
  const methods = {
    findMany: async (args) => read(name, args),
    findFirst: async (args) => read(name, args)[0] ?? null,
    findUnique: async (args) => read(name, args)[0] ?? null,
    count: async (args) => read(name, args).length,
    create: async (args) => mutate(name, 'create', args),
    update: async (args) => mutate(name, 'update', args),
    delete: async (args) => mutate(name, 'delete', args),
  };
  return new Proxy(methods, { get(target, key) {
    if (key in target) return target[key];
    return async () => { throw new Error('Unsupported local fixture operation: ' + String(key)); };
  } });
}

globalThis.prisma = new Proxy({ track: model('track'), video: model('video'), audioAsset: model('audioAsset') }, {
  get(target, key) {
    if (key in target) return target[key];
    if (key === '$connect' || key === '$disconnect') return async () => undefined;
    return async () => { throw new Error('No real database access is permitted by this fixture: ' + String(key)); };
  },
});
