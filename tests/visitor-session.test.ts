import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { createVisitorSessionToken, verifyVisitorSessionToken } from '../src/lib/community/visitorSession';

const secret = 'community-test-secret-long-enough';
const visitorId = 'a2540c24-cfc1-4406-91c4-b0f86093325a';

test('visitor sessions are signed, canonical, and bound to one server-issued UUID', () => {
  const token = createVisitorSessionToken(visitorId, secret);
  assert.equal(verifyVisitorSessionToken(token, secret), visitorId);

  const [version, encodedId, signature] = token.split('.');
  assert.equal(version, 'v1');
  assert.equal(signature.length, 43);
  assert.equal(verifyVisitorSessionToken(`${version}.${encodedId}.${signature.slice(0, -1)}A`, secret), null);
  assert.equal(verifyVisitorSessionToken(`${version}.${encodedId}x.${signature}`, secret), null);
  assert.equal(verifyVisitorSessionToken('not-a-token', secret), null);
});

test('visitor sessions never reuse the admin password as their signing secret', () => {
  const previousVisitorSecret = process.env.COMMUNITY_VISITOR_SECRET;
  const previousAdminSecret = process.env.ADMIN_SECRET;
  delete process.env.COMMUNITY_VISITOR_SECRET;
  process.env.ADMIN_SECRET = 'admin-password-must-not-sign-public-cookies';

  try {
    assert.throws(() => createVisitorSessionToken(visitorId), /COMMUNITY_VISITOR_SECRET/);
  } finally {
    if (previousVisitorSecret === undefined) delete process.env.COMMUNITY_VISITOR_SECRET;
    else process.env.COMMUNITY_VISITOR_SECRET = previousVisitorSecret;
    if (previousAdminSecret === undefined) delete process.env.ADMIN_SECRET;
    else process.env.ADMIN_SECRET = previousAdminSecret;
  }
});

test('featured vote client relies only on the signed HTTP-only visitor cookie', () => {
  const source = readFileSync(new URL('../src/components/FeaturedVote.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bvisitorId\b/);
  assert.doesNotMatch(source, /\bSTORAGE_KEY\b|localStorage/);
  assert.match(source, /JSON\.stringify\(\{ optionId: option\.id \}\)/);
});

test('rewards client relies only on the signed HTTP-only visitor cookie', () => {
  const source = readFileSync(new URL('../src/components/CommunityRewards.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bvisitorId\b|getOrCreateCommunityVisitorId|localStorage/);
  assert.match(source, /fetch\('\/api\/community\/rewards'/);
});

test('the community page establishes one visitor cookie before client API requests', () => {
  const proxySource = readFileSync(new URL('../src/proxy.ts', import.meta.url), 'utf8');
  const routeSource = readFileSync(new URL('../src/app/api/community/featured-vote/route.ts', import.meta.url), 'utf8');
  for (const anchor of ["req.nextUrl.pathname === '/community'", 'getOrCreateVisitorSession', 'attachVisitorSession']) {
    assert.ok(proxySource.includes(anchor), `community proxy should include ${anchor}`);
  }
  assert.match(proxySource, /matcher:[^\]]*['"]\/community['"]/);
  assert.ok(routeSource.includes('getExistingVisitorSession(request)'));
  assert.ok(routeSource.includes('Load the vote before submitting'));
});

test('the retired caller-controlled visitor helper is absent', () => {
  assert.equal(existsSync(new URL('../src/lib/community/visitor.ts', import.meta.url)), false);
  const source = readFileSync(new URL('../src/lib/community/featuredVote.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /CommunityVisitorIdSchema/);
});
