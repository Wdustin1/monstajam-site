// Explicitly opted-in browser fixture. The connection database is replaced
// before importing an auth module or constructing any database client.
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { setServers } from 'node:dns';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const port = 3399;
const origin = `http://localhost:${port}`;
const transport = `http://127.0.0.1:${port}`;
let child: ChildProcess | undefined;
let stopped = false;
let requestStop: (() => void) | undefined;

async function stopChild() {
  if (!child || stopped || child.exitCode !== null) return;
  stopped = true;
  if (process.platform === 'win32') {
    await new Promise<void>((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child!.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
      killer.once('exit', () => resolve());
      killer.once('error', () => resolve());
    });
  } else {
    try { process.kill(-child.pid!, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
  }
}

async function main() {
  if (!process.argv.includes('--isolated-database')) throw new Error('Explicit isolated-database option is required.');
  const uri = new URL(process.env.DATABASE_URL || 'file:///missing');
  if (!['mongodb:', 'mongodb+srv:'].includes(uri.protocol)) throw new Error('MongoDB environment connection required.');
  const databaseName = `monstajam_auth_test_${randomBytes(8).toString('hex')}`;
  uri.pathname = '/' + databaseName;
  process.env.DATABASE_URL = uri.toString();
  process.env.BETTER_AUTH_URL = origin;
  process.env.BETTER_AUTH_SECRET = randomBytes(48).toString('base64url');
  Object.assign(process.env, { NODE_ENV: 'development' });
  setServers(['1.1.1.1', '8.8.8.8']);
  await new Promise<void>((resolve, reject) => {
    const listener = net.createServer();
    listener.once('error', () => reject(new Error('Port 3399 is already in use.')));
    listener.listen(port, '127.0.0.1', () => listener.close(() => resolve()));
  });
  const store = await import('../../src/lib/auth-store');
  const provider = await import('../../src/lib/auth-provider');
  const client = store.getAuthMongoClient();
  const db = store.getAuthDatabase();
  assert.equal(db.databaseName, databaseName);
  let ownsDatabase = false;
  let interval: ReturnType<typeof setInterval> | undefined;
  const finish = new Promise<void>((resolve) => { requestStop = resolve; });
  try {
    assert.equal((await db.listCollections().toArray()).length, 0, 'Refuse to reuse any existing database.');
    ownsDatabase = true;
    await store.ensureAuthIndexes();
    await provider.getAuth().api.createUser({ body: {
      name: 'Local fixture owner', email: 'owner@fixture.invalid',
      password: 'local-browser-fixture-2026!', role: 'owner', data: { accessStatus: 'active' },
    } });
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'monstajam-mongo-browser-'));
    const stopFile = path.join(directory, 'stop');
    const dnsPreload = path.join(directory, 'dns.cjs');
    await fs.writeFile(dnsPreload, "require('node:dns').setServers(['1.1.1.1','8.8.8.8']);\n");
    const env = { ...process.env };
    for (const key of Object.keys(env)) {
      if (/ADMIN_SECRET|BLOB.*TOKEN|AUDIO.*TOKEN|SUPABASE|^NODE_OPTIONS$|MONSTAJAM_.*FIXTURE/.test(key)) delete env[key];
    }
    Object.assign(env, {
      DATABASE_URL: uri.toString(), BETTER_AUTH_URL: origin,
      NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1',
      BLOB_READ_WRITE_TOKEN: 'disabled-local-browser-fixture', AUDIO_READ_WRITE_TOKEN: 'disabled-local-browser-fixture',
      NODE_OPTIONS: `--require="${dnsPreload.replaceAll('\\', '/')}"`,
    });
    child = spawn(process.execPath, [path.join(process.cwd(), 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], {
      cwd: process.cwd(), env, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.once('exit', () => requestStop?.());
    // Drain logs without printing bodies, credentials, or activation links.
    child.stdout?.on('data', () => {});
    child.stderr?.on('data', () => {});
    const deadline = Date.now() + 120_000;
    let ready = false;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error('Local Next fixture exited before becoming ready.');
      try {
        const response = await fetch(transport + '/upload/login', { signal: AbortSignal.timeout(30_000) });
        if (response.status === 200) { await response.body?.cancel(); ready = true; break; }
      } catch { /* Wait for this isolated local server to compile. */ }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.ok(ready, 'Local Next fixture did not become ready.');
    interval = setInterval(() => { void fs.access(stopFile).then(() => requestStop?.()).catch(() => {}); }, 500);
    console.log(JSON.stringify({ ready: true, url: origin + '/upload/login', email: 'owner@fixture.invalid', isolatedDatabase: databaseName, stopFile, nextPid: child.pid }));
    await finish;
  } finally {
    if (interval) clearInterval(interval);
    await stopChild();
    try {
      if (ownsDatabase) {
        assert.equal(client.db().databaseName, databaseName);
        assert.ok(/^monstajam_auth_test_[a-f0-9]{16}$/.test(databaseName));
        const collections = await db.listCollections().toArray();
        for (const { name } of collections) if (name.startsWith('auth_')) await db.collection(name).deleteMany({});
        let remaining = 0;
        for (const { name } of collections) if (name.startsWith('auth_')) remaining += await db.collection(name).countDocuments();
        assert.equal(remaining, 0, 'All isolated auth documents must be removed.');
        console.log(JSON.stringify({ cleaned: true, isolatedDatabase: databaseName, remainingAuthDocuments: remaining }));
      }
    } finally { await client.close(); }
  }
}
process.on('SIGINT', () => requestStop?.());
process.on('SIGTERM', () => requestStop?.());
main().catch((error: unknown) => {
  // Error strings from database drivers may include connection details.
  console.error(`Local browser fixture failed (${error instanceof Error ? error.name : 'unknown error'}).`);
  process.exitCode = 1;
});
