import assert from 'node:assert/strict';
import test from 'node:test';
import { proxyCoverUrl } from '../src/lib/proxy-cover';

test('cover proxy accepts only Next-allowed local covers and trusted Vercel Blob sources', () => {
  assert.equal(proxyCoverUrl('/releases/local-cover.jpg'), '/releases/local-cover.jpg');
  assert.equal(proxyCoverUrl('/monstajam-logo.png'), '/monstajam-logo.png');
  assert.equal(
    proxyCoverUrl('https://assets.blob.vercel-storage.com/covers/album.jpg'),
    '/api/cover?url=https%3A%2F%2Fassets.blob.vercel-storage.com%2Fcovers%2Falbum.jpg',
  );
  assert.equal(
    proxyCoverUrl('https://assets.blob.vercel-storage.com/%'),
    '/api/cover?url=https%3A%2F%2Fassets.blob.vercel-storage.com%2F%25',
  );
  assert.equal(
    proxyCoverUrl(' https://ASSETS.blob.vercel-storage.com:443/covers/../cover%20art.jpg '),
    '/api/cover?url=https%3A%2F%2Fassets.blob.vercel-storage.com%2Fcover%2520art.jpg',
  );
});

test('cover proxy fails closed for unrenderable paths, untrusted hosts, and malformed values', () => {
  assert.equal(proxyCoverUrl('/covers/not-in-next-allowlist.jpg'), '');
  assert.equal(proxyCoverUrl('https://images.example.com/covers/album.jpg'), '');
  assert.equal(proxyCoverUrl('http://assets.blob.vercel-storage.com/cover.jpg'), '');
  assert.equal(proxyCoverUrl('https://example.com/blob.vercel-storage.com/cover.jpg'), '');
  assert.equal(proxyCoverUrl('javascript:alert(1)'), '');
  assert.equal(proxyCoverUrl('data:image/svg+xml,<svg/>'), '');
  assert.equal(proxyCoverUrl('not a url'), '');
  assert.equal(proxyCoverUrl(null), '');
});
