import assert from 'node:assert/strict';
import test from 'node:test';
import { tryCopyText } from '../src/lib/copyText';

test('copy helper prefers the clipboard and skips the fallback on success', async () => {
  let fallbackCalls = 0;
  const copied = await tryCopyText('https://example.com', {
    clipboardWrite: async () => undefined,
    fallbackCopy: () => {
      fallbackCalls += 1;
      return true;
    },
  });

  assert.equal(copied, true);
  assert.equal(fallbackCalls, 0);
});

test('copy helper uses a non-blocking fallback when clipboard access fails', async () => {
  const copied = await tryCopyText('https://example.com', {
    clipboardWrite: async () => { throw new Error('denied'); },
    fallbackCopy: () => true,
  });

  assert.equal(copied, true);
});

test('copy helper fails closed when the fallback is unavailable or throws', async () => {
  assert.equal(await tryCopyText('https://example.com', { fallbackCopy: () => false }), false);
  assert.equal(await tryCopyText('https://example.com', { fallbackCopy: () => { throw new Error('unsupported'); } }), false);
});
