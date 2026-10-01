import { after, mock } from 'node:test';
import { adminAuthorization } from '../../../src/lib/auth';

// Content-route tests isolate identity lookup, just as they isolate Prisma.
// Named-auth integration tests exercise the real provider and signed cookies.
const originalBaseURL = process.env.BETTER_AUTH_URL;
after(() => {
  if (originalBaseURL === undefined) delete process.env.BETTER_AUTH_URL;
  else process.env.BETTER_AUTH_URL = originalBaseURL;
});

export function mockNamedAdminSession(token: string, active = true) {
  process.env.BETTER_AUTH_URL = 'http://localhost';
  return mock.method(adminAuthorization, 'getIdentity', async (headers: Headers) => {
    const cookie = headers.get('cookie')?.split(';').map(value => value.trim());
    return active && cookie?.includes(`monstajam_auth.session_token=${token}`)
      ? { id: 'fixture-admin', name: 'Fixture Admin', username: 'fixture_admin', role: 'admin' as const }
      : null;
  });
}
