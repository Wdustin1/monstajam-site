import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const layout = read('src/app/layout.tsx');
const globals = read('src/app/globals.css');
const nextConfig = read('next.config.ts');
const hero = read('src/components/Hero.tsx');
const videoGallery = read('src/components/VideoGallery.tsx');
const trackDetail = read('src/components/TrackDetail.tsx');
const notFound = read('src/app/not-found.tsx');
const player = read('src/components/PersistentPlayer.tsx');
const musicLibrary = read('src/components/MusicLibrary.tsx');
const songCard = read('src/components/SongCard.tsx');
const genreBrowser = read('src/components/GenreBrowser.tsx');
const vinyl = read('src/components/VinylRecord.tsx');
const login = read('src/app/upload/login/page.tsx');
const uploadDashboard = read('src/components/UploadDashboard.tsx');
const communityAdmin = read('src/components/CommunityAdminDashboard.tsx');
const auth = read('src/lib/auth.ts');
const trackPage = read('src/app/tracks/[slug]/page.tsx');
const homePage = read('src/app/page.tsx');

test('global metadata and route shells provide a coherent accessible page contract', () => {
  for (const anchor of ['metadataBase', 'openGraph:', 'twitter:', "title: {", "default: 'MonstaJam"] ) {
    assert.ok(layout.includes(anchor), `root metadata should include ${anchor}`);
  }
  assert.ok(globals.includes('overflow-x: clip'), 'the document should prevent decorative 320px horizontal overflow');
  assert.ok(nextConfig.includes("pathname: '/monstajam-logo.png'"), 'the shared logo should remain eligible for image optimization');
  assert.ok(nextConfig.includes("pathname: '/monstajam-record-label.png'"), 'the turntable label should be eligible for image optimization');
  assert.ok(nextConfig.includes("pathname: '/releases/**'"), 'release artwork should remain eligible for image optimization');
  assert.equal(nextConfig.match(/search: ''/g)?.length, 3, 'static image patterns should reject query variants');
  assert.ok(!layout.includes("alternates: { canonical: '/' }"), 'the root layout must not canonicalize every route to the homepage');
  assert.ok(homePage.includes("alternates: { canonical: '/' }"));

  for (const [path, title, canonical] of [
    ['src/app/genres/page.tsx', "title: 'Browse Genres'", "canonical: '/genres'"],
    ['src/app/videos/page.tsx', "title: 'Music Video Gallery'", "canonical: '/videos'"],
    ['src/app/community/page.tsx', "title: 'Community Hub'", "canonical: '/community'"],
  ]) {
    const page = read(path);
    assert.ok(page.includes(title), `${path} should rely on the root title template without duplicating MonstaJam`);
    assert.ok(page.includes(canonical), `${path} should expose its own canonical URL`);
  }
  for (const path of ['src/app/upload/page.tsx', 'src/app/upload/community/page.tsx']) {
    assert.ok(read(path).includes('robots: { index: false, follow: false }'), `${path} should not be indexed`);
  }
  assert.ok(!trackPage.includes('— MonstaJam'), 'dynamic track titles should rely on the root title template');
  assert.ok(trackPage.includes('canonical: `/tracks/${slug}`'));

  for (const path of [
    'src/app/page.tsx',
    'src/app/genres/page.tsx',
    'src/app/videos/page.tsx',
    'src/app/community/page.tsx',
    'src/components/TrackDetail.tsx',
    'src/app/not-found.tsx',
    'src/app/upload/login/page.tsx',
    'src/app/upload/page.tsx',
    'src/app/upload/community/page.tsx',
    'src/app/loading.tsx',
  ]) {
    assert.ok(read(path).includes('id="main-content"'), `${path} should expose the skip-link target`);
  }
});

test('homepage calls to action and current release copy match live content', () => {
  assert.ok(hero.includes("videoCount > 0 ? 'Watch Videos' : 'Join Community'"));
  assert.ok(hero.includes("videoCount > 0 ? '/videos' : '/community'"));
  assert.equal(hero.includes('{trackCount}+'), false, 'exact track count should not be inflated');

  const banner = read('src/components/AlbumReleaseBanner.tsx');
  assert.ok(banner.includes('Latest album'));
  assert.ok(banner.includes('Out now'));
  assert.equal(banner.includes('New album release'), false);
});

test('public empty and error states use visitor-facing language with meaningful actions', () => {
  assert.ok(videoGallery.includes('Videos are on the way'));
  assert.ok(videoGallery.includes('Explore the music library'));
  assert.ok(!videoGallery.includes('admin dashboard'));
  assert.ok(!videoGallery.includes('window.prompt'), 'sharing should never open a blocking browser prompt');
  assert.ok(videoGallery.includes("typeof document.execCommand === 'function'"), 'sharing should feature-detect its non-blocking fallback');
  assert.ok(videoGallery.includes('readOnly'), 'sharing should reveal a selectable URL if clipboard access is unavailable');

  assert.ok(notFound.includes('Page Not Found'));
  assert.ok(notFound.includes('Explore the Library'));
  assert.equal(notFound.includes('Track Not Found'), false);
});

test('track detail presents the story once and every music action remains explicit', () => {
  assert.equal(trackDetail.includes('Read Story'), false);
  assert.equal(trackDetail.includes('Hide Story'), false);
  assert.equal(trackDetail.includes('Exclusive Content'), false);
  assert.ok(trackDetail.includes('Lyrics'));
  assert.ok(!trackDetail.includes('The Story'));
  assert.ok(trackDetail.includes('Play on MonstaJam'));
});

test('audio and browse controls have names, state, keyboard semantics, and mobile-sized targets', () => {
  for (const anchor of [
    'role="region"',
    'aria-label="Audio player"',
    'role="slider"',
    'aria-valuenow',
    'onKeyDown={handleSeekKeyDown}',
    '-top-5',
    'h-6 w-full',
    'aria-pressed={shuffleOn}',
    'aria-pressed={repeatOn}',
  ]) assert.ok(player.includes(anchor), `player should include ${anchor}`);
  assert.equal(player.includes('<footer'), false, 'the player should not create a second contentinfo landmark');

  for (const anchor of ['aria-expanded={open}', 'aria-haspopup="listbox"', 'role="listbox"', 'role="option"', "e.key === 'Escape'"]) {
    assert.ok(musicLibrary.includes(anchor), `library dropdown should include ${anchor}`);
  }

  assert.ok(songCard.includes('alt={`${title} cover art`}'));
  assert.ok(songCard.includes('aria-label={`${isActive ? \'Pause\' : \'Play\'} ${track.title}`}'));
  assert.ok(songCard.includes('h-11 w-11'), 'song-card actions should expose 44px tap targets');
  assert.ok(trackDetail.includes('min-h-11'), 'track-detail navigation should expose a 44px tap target');
  assert.ok(videoGallery.includes('min-h-11'), 'video actions should expose 44px tap targets');
  assert.ok(vinyl.includes('data-turntable-id="hero-turntable"'));
  assert.ok(vinyl.includes('width: TURNTABLE_WIDTH'));
  assert.ok(vinyl.includes('height: TURNTABLE_HEIGHT'));
  assert.ok(hero.includes('transform: scale(0.50);'), 'the full-deck control should remain large on a 320px screen');
  assert.ok(genreBrowser.includes('md:opacity-0'));
  assert.ok(genreBrowser.includes('group-focus-within:opacity-100'));
  assert.ok(genreBrowser.includes('min-h-11'), 'genre-card links should remain tap sized');
  assert.ok(vinyl.includes('aria-label={ariaLabel}'));
  assert.ok(vinyl.includes('disabled={!hasPlayableTrack}'));
  assert.ok(vinyl.includes('onKeyDown={handleKeyStart}'));
});

test('admin feedback, destructive actions, and toggles expose accessible semantics', () => {
  assert.ok(login.includes('autoComplete="current-password"'));
  assert.ok(login.includes('role="alert"'));
  assert.ok(login.includes('aria-describedby'));

  for (const anchor of [
    'role="status"',
    'aria-live="polite"',
    'role="dialog"',
    'aria-modal="true"',
    'aria-labelledby="delete-dialog-title"',
    'aria-pressed={checked}',
  ]) assert.ok(uploadDashboard.includes(anchor), `admin dashboard should include ${anchor}`);
  assert.ok(uploadDashboard.includes('[&_button]:min-h-11'));

  assert.ok(communityAdmin.includes('role="alert"'));
  assert.ok(communityAdmin.includes('role="status"'));
  assert.ok(communityAdmin.includes('[&_button]:min-h-11'));
});

test('admin sessions are signed and Proxy enforces them without storing the raw secret', () => {
  assert.ok(auth.includes('createAdminSessionToken'));
  assert.ok(auth.includes('verifyAdminSessionToken'));
  assert.ok(auth.includes('timingSafeEqual'));
  assert.ok(auth.includes('createHmac'));

  assert.ok(existsSync(join(root, 'src/proxy.ts')), 'Next 16 should use the proxy file convention');
  assert.equal(existsSync(join(root, 'src/middleware.ts')), false, 'deprecated middleware file should be removed');

  const loginRoute = read('src/app/api/auth/login/route.ts');
  assert.ok(loginRoute.includes('createAdminSessionToken'));
  assert.equal(loginRoute.includes("res.cookies.set('admin_session', process.env.ADMIN_SECRET!"), false);
});
