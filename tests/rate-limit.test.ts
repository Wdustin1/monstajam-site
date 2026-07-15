import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createFixedWindowRateLimiter, getRequestAddress } from '../src/lib/rateLimit';

test('fixed-window limiter blocks excess attempts and resets after the window', () => {
  const limiter = createFixedWindowRateLimiter({ limit: 3, windowMs: 1_000, maxEntries: 10 });

  assert.equal(limiter.consume('client-a', 0).allowed, true);
  assert.equal(limiter.consume('client-a', 1).allowed, true);
  assert.equal(limiter.consume('client-a', 2).allowed, true);
  const blocked = limiter.consume('client-a', 3);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 1);
  assert.equal(limiter.consume('client-b', 3).allowed, true);
  assert.equal(limiter.consume('client-a', 1_001).allowed, true);
});

test('fixed-window limiter can clear failures after successful authentication', () => {
  const limiter = createFixedWindowRateLimiter({ limit: 1, windowMs: 60_000, maxEntries: 10 });
  assert.equal(limiter.consume('client-a', 0).allowed, true);
  assert.equal(limiter.consume('client-a', 1).allowed, false);
  limiter.clear('client-a');
  assert.equal(limiter.consume('client-a', 2).allowed, true);
});

test('request address prefers the Vercel-managed forwarding header', () => {
  const headers = new Headers({
    'x-vercel-forwarded-for': '203.0.113.20, 10.0.0.1',
    'x-forwarded-for': '198.51.100.9',
    'x-real-ip': '192.0.2.7',
  });
  assert.equal(getRequestAddress(headers), '203.0.113.20');
});

test('request address fails closed when the Vercel-managed header is absent', () => {
  const headers = new Headers({
    'x-forwarded-for': '198.51.100.9',
    'x-real-ip': '192.0.2.7',
  });
  assert.equal(getRequestAddress(headers), 'unknown');
});

test('security-sensitive routes use the shared Mongo limiter instead of process-local maps', () => {
  const paths = [
    '../src/app/api/auth/login/route.ts',
    '../src/app/api/community/featured-vote/route.ts',
    '../src/app/api/cover/route.ts',
  ];
  for (const path of paths) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /consumeSharedRateLimit/);
    assert.doesNotMatch(source, /createFixedWindowRateLimiter/);
  }

  const voteSource = readFileSync(new URL('../src/app/api/community/featured-vote/route.ts', import.meta.url), 'utf8');
  for (const anchor of [
    'consumeVoteRateLimits',
    'if (!clientLimit.allowed) return clientLimit',
    'if (!visitorLimit.allowed) return visitorLimit',
  ]) {
    assert.ok(voteSource.includes(anchor), `featured vote limits should include ${anchor}`);
  }

  const coverSource = readFileSync(new URL('../src/app/api/cover/route.ts', import.meta.url), 'utf8');
  for (const anchor of [
    "namespace: 'cover-proxy-global'",
    'consumeCoverRateLimits',
    'if (!clientLimit.allowed) return clientLimit',
  ]) {
    assert.ok(coverSource.includes(anchor), `cover limits should include ${anchor}`);
  }
  const coverHandlerStart = coverSource.indexOf('return async function GET');
  const coverLimitCall = coverSource.indexOf('await consumeCoverRateLimits', coverHandlerStart);
  const coverValidationCall = coverSource.indexOf('await validateCoverUrlForFetch', coverHandlerStart);
  assert.ok(coverLimitCall > coverHandlerStart && coverLimitCall < coverValidationCall, 'cover limits must run before DNS validation');

  const sharedSource = readFileSync(new URL('../src/lib/sharedRateLimit.ts', import.meta.url), 'utf8');
  for (const anchor of ["findAndModify: 'rate_limits'", 'upsert: true', '$inc', "createHash('sha256')"]) {
    assert.ok(sharedSource.includes(anchor), `shared limiter should include ${anchor}`);
  }
});
