import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';

const componentPath = 'src/components/AmbientMotionBackground.tsx';
const webmPath = 'public/media/monstajam-ambient-motion.webm';
const mp4Path = 'public/media/monstajam-ambient-motion.mp4';
const posterPath = 'public/media/monstajam-ambient-motion-poster.webp';

test('the root layout owns one decorative ambient motion background', () => {
  assert.equal(existsSync(componentPath), true);
  const layout = readFileSync('src/app/layout.tsx', 'utf8');
  assert.match(layout, /import AmbientMotionBackground from "@\/components\/AmbientMotionBackground"/);
  assert.equal((layout.match(/<AmbientMotionBackground \/>/g) ?? []).length, 1);
});

test('ambient motion is silent, inline, lazy, decorative, and format-fallback safe', () => {
  const source = readFileSync(componentPath, 'utf8');
  for (const anchor of ['autoPlay', 'muted', 'loop', 'playsInline', 'preload="none"', 'aria-hidden="true"', 'tabIndex={-1}']) {
    assert.ok(source.includes(anchor), `missing ${anchor}`);
  }
  assert.match(source, /monstajam-ambient-motion\.webm/);
  assert.match(source, /video\/webm/);
  assert.match(source, /monstajam-ambient-motion\.mp4/);
  assert.match(source, /video\/mp4/);
  assert.match(source, /monstajam-ambient-motion-poster\.webp/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /document\.hidden/);
  assert.match(source, /video\.pause\(\)/);
  assert.match(source, /video\.play\(\)/);
});

test('ambient motion assets are present and remain lightweight enough for a background', () => {
  for (const path of [webmPath, mp4Path, posterPath]) assert.equal(existsSync(path), true, `${path} missing`);
  assert.ok(statSync(webmPath).size <= 4_000_000, 'WebM should stay at or below 4 MB');
  assert.ok(statSync(mp4Path).size <= 5_000_000, 'MP4 should stay at or below 5 MB');
  assert.ok(statSync(posterPath).size <= 250_000, 'poster should stay at or below 250 KB');
});

test('mobile motion stays clearly perceptible beneath the darker hero surface', () => {
  const css = readFileSync('src/app/globals.css', 'utf8');
  assert.match(css, /@media \(max-width:\s*640px\)[\s\S]*?\[data-ambient-motion\]\s*\{[\s\S]*?opacity:\s*0\.42/);
  assert.match(css, /@media \(max-width:\s*640px\)[\s\S]*?\[data-ambient-motion\]\s*\{[\s\S]*?mix-blend-mode:\s*normal/);
  assert.match(css, /@media \(max-width:\s*640px\)[\s\S]*?\[data-ambient-motion\] video\s*\{[\s\S]*?brightness\(0\.95\)[\s\S]*?saturate\(1\.22\)[\s\S]*?contrast\(1\.12\)/);
  assert.match(css, /@media \(max-width:\s*640px\)[\s\S]*?\[data-ambient-motion-vignette\][\s\S]*?transparent 28%/);
});

test('motion remains restrained and falls back to a static atmosphere for reduced motion', () => {
  const css = readFileSync('src/app/globals.css', 'utf8');
  assert.match(css, /\[data-ambient-motion\][\s\S]*opacity:\s*0\.1[02468]/);
  assert.match(css, /\[data-ambient-motion\][\s\S]*mix-blend-mode:\s*screen/);
  assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*\[data-ambient-motion\][\s\S]*display:\s*none/);
}
);
