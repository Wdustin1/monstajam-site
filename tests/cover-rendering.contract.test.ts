import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

for (const component of ['GenreBrowser', 'SongCard', 'TrackDetail', 'PersistentPlayer']) {
  test(`${component} resolves cover URLs before deciding whether to render Next Image`, () => {
    const source = readFileSync(`src/components/${component}.tsx`, 'utf8');
    assert.match(source, /import \{ proxyCoverUrl \} from ['"]@\/lib\/proxy-cover['"]/);
    assert.match(source, /const coverSrc = proxyCoverUrl\(/);
    assert.match(source, /\{coverSrc \? \(/);
    assert.doesNotMatch(source, /\{track\.coverUrl \? \(\s*<Image/);
  });
}
