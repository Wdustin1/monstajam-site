import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const contextSource = readFileSync('src/context/PlayerContext.tsx', 'utf8');

test('player context exposes the active queue for Up Next', () => {
  assert.match(contextSource, /queue:\s*PlayerTrack\[\]/);
  assert.match(contextSource, /const \[queue, setQueueState\] = useState<PlayerTrack\[\]>/);
  assert.match(contextSource, /queue,\s*\n\s*shuffleOn/);
});

test('player context restores and saves a guarded browser-local listening snapshot', () => {
  assert.match(contextSource, /readPlayerSnapshot/);
  assert.match(contextSource, /writePlayerSnapshot/);
  assert.doesNotMatch(contextSource, /localStorage\.(getItem|setItem)/);
  assert.match(contextSource, /restoredSnapshot\.currentTime/);
});

test('pause and page exit flush the exact current resume position', () => {
  assert.match(contextSource, /const persistSnapshot = useCallback/);
  assert.match(contextSource, /const pause = useCallback\([\s\S]*?persistSnapshot\(\)/);
  assert.match(contextSource, /addEventListener\('pagehide', persistSnapshot\)/);
  assert.match(contextSource, /removeEventListener\('pagehide', persistSnapshot\)/);
});

test('restore metadata listeners are cancelled before source changes and on cleanup', () => {
  assert.match(contextSource, /pendingRestoreRef/);
  assert.match(contextSource, /clearPendingRestore/);
  assert.match(contextSource, /clearPendingRestore\(audio\)[\s\S]*?audio\.src = track\.audioUrl/);
  assert.match(contextSource, /clearPendingRestore[\s\S]*?hasRestoredRef\.current = true/);
  assert.match(contextSource, /const handleError = \(\) => \{[\s\S]*?clearPendingRestore\(audio\)/);
});

test('short previews rely on one natural ending while longer sources use the preview cap', () => {
  assert.match(contextSource, /audio\.duration > playbackDuration \+ 0\.05[\s\S]*?audio\.dispatchEvent\(new Event\('ended'\)\)/);
});

test('restoration cannot overwrite a saved checkpoint before metadata applies it', () => {
  assert.match(contextSource, /const restorePosition = \(\) => \{[\s\S]*?hasRestoredRef\.current = true;[\s\S]*?persistSnapshot\(\)/);
});

test('media events and failed starts keep the visible playback state truthful', () => {
  assert.match(contextSource, /addEventListener\('play', handlePlay\)/);
  assert.match(contextSource, /addEventListener\('pause', handlePause\)/);
  assert.match(contextSource, /addEventListener\('emptied', handleEmptied\)/);
  assert.match(contextSource, /removeEventListener\('emptied', handleEmptied\)/);
  assert.match(contextSource, /addEventListener\('error', handleError\)/);
  assert.match(contextSource, /\.play\(\)\.catch\(\(\) => setIsPlaying\(false\)\)/);
  assert.match(contextSource, /if \(track\.audioUrl\) \{[\s\S]*?\} else \{\s*setIsPlaying\(false\)/);
  assert.doesNotMatch(contextSource, /\.then\(\(\) => setIsPlaying/);
});

test('next and previous playback avoid side effects inside React state updaters', () => {
  assert.match(contextSource, /getNextTrack/);
  assert.doesNotMatch(contextSource, /setQueueState\(\(activeQueue\)/);
  assert.doesNotMatch(contextSource, /setTimeout\(\(\) => play/);
});

test('player context uses the effective playback duration for preview progress and seeking', () => {
  assert.match(contextSource, /getPlaybackDuration/);
  assert.match(contextSource, /getPlaybackProgress/);
  assert.match(contextSource, /Math\.max\(0, Math\.min\(1, fraction\)\) \* playbackDuration/);
});
