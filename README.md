This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Draft track access

- Public track pages and their metadata only return published tracks.
- In the admin track library, **Preview saved version** opens `/upload/preview/[slug]` in a new tab. This requires an admin session and is excluded from search indexing.
- The track detail API only includes a draft when both `?preview=true` and a valid admin session are supplied. Authenticated track responses must not be cached publicly.
- Artwork remains in public Blob storage. Managed audio originals and generated previews use a separate private store; `/api/audio/[slug]` checks publication and playback mode on every request. Legacy tracks keep their old URLs until explicitly migrated. Previously public URLs are not revoked by hiding a draft or changing its playback mode.

Run the privacy regression checks with `npm run test:draft-privacy`. Run HTTP checks against an isolated local fixture server with `npm run test:draft-privacy:integration`; after `npm run build`, add `-- --production` to verify the compiled server and production cache headers. These checks use generated local login credentials and a read-only fixture database, never production data. Port 3310 must be free.

## Artwork proxy

Artwork remains public. `/api/cover` only downloads HTTPS artwork from this project's public Blob store and the `/monstajam/covers/` path, as configured in `src/lib/cover-source.ts`. It refuses redirects, limits downloads to 25 MiB and 10 seconds, and decodes/reencodes JPEG, PNG, WebP, or GIF pixels before serving them. Processing is limited to 40 million pixels and 5 seconds; output is capped at 4 MiB. Unsupported or damaged files return a non-cacheable error. A bounded, single-file multipart wrapper is supported for legacy uploads.

Run `npm run test:cover-proxy` for source restrictions, unsafe-content rejection, image compatibility, timeout/size limits, and URL-encoding regression checks. Tests use generated images and mocked downloads, with no production writes.

## Admin save protection

- Track and video editors track unsaved changes independently. Switching dashboard tabs preserves both forms. Replacing an edited item, starting another item, or leaving requires a discard decision; opening a saved preview in another tab preserves the editor.
- Saves, publication changes, deletion, reload, and sign-out share a per-dashboard request lock. Controls remain disabled until the request finishes. Small metadata requests time out after 30 seconds; an uncertain save retains edits and asks the admin to check the library before retrying.
- Empty optional metadata is sent as explicit `null`, so clearing BPM, mood, story, streaming links, video artist, or video duration persists. Omitted API fields remain unchanged.
- Failed saves retain form values and selected files. Already-uploaded files are reused when retrying the same form. Session expiry offers sign-in in a separate tab. Successful responses update the library directly, without depending on a second refresh request.
- Navigation protection uses a custom discard dialog for in-app actions and browser history where supported, plus the browser's native unload warning for refresh/close. Older browsers enter and leave the dashboard through document navigation. Browser shutdown or forced mobile app termination cannot be guaranteed to show an unload warning. Draft edits are held in memory, not autosaved to storage.

Run `npm run test:admin-save` for schema/API and response-handling regressions, and `npm run test:admin-editor` for the real React editor with simulated DOM, network failures, and Blob uploads. `npm run test:admin-save:fixture` starts the real dashboard/API on `http://127.0.0.1:3311` using in-memory data and a generated test password; its temporary control file can inject delay, failure, and session expiry for manual browser checks. None of these tests write to production.

### Dashboard connection and sign-in recovery

- Each library distinguishes loading, a successful empty result, and a failed request. Failed refreshes retain the last successful rows and clearly label them as old results; unavailable counts are shown as unknown rather than zero.
- A persistent notice explains an expired sign-in or a connection failure. Sign in in a separate tab when needed, then use **Retry connection** in the original editor. Retrying checks the current account and both libraries without resetting forms, selected files, or completed uploads. Account controls reflect the newly verified identity.
- **Last full check** advances only when sign-in and both libraries are successfully checked together. Partial refreshes and individual saves do not claim a complete check. Release-readiness indicators use confirmed data and show when a check is unavailable.
- Once a sign-in is known to have expired, save/publish/delete actions wait for successful sign-in recovery. Edits remain available in the open editor; refreshing or closing the page still loses unsaved browser-memory work.

## Upload experience

- Audio and artwork transfers show separate percentage progress. Audio preparation and the final save show their own status; a completed transfer does not imply that the track has been saved.
- Selected audio can be played locally and selected artwork can be previewed before saving. Replacing or clearing a selection releases its browser object URL, and leaving the track editor stops its audio. Saved audio and artwork remain available until a successful save replaces them.
- New tracks are checked for a conflicting title-derived URL in the loaded library and again through the authenticated `/api/admin/track-title` endpoint before any new files upload. Drafts and tracks in Trash also reserve their URLs. The final create request handles a concurrent duplicate with a useful conflict message. Edit or restore the existing track, or choose a distinct title; existing track URLs are not renamed.
- Failed checks and saves retain the form and selected files. While the editor remains open, retries reuse successfully uploaded files and prepared audio. A page reload does not preserve local file selections or this retry cache.

Upload regressions are included in `scripts/tests/admin-audio-editor.test.cjs`, `scripts/tests/selected-media-preview.test.cjs`, and `scripts/tests/track-title-api.test.ts`. The local admin-save fixture exercises title-check authorization, draft conflicts, and failed-check recovery without production data.

## Review before publishing

- New songs and videos are saved as drafts. Use **Review & publish** in the library to open the saved details and media, or enable **Review after saving** in the editor to open that step after a successful draft save. Closing the review keeps the draft and any unrelated unsaved work.
- Song reviews show artwork, metadata, credits, the saved playback mode, and a player using the same full-song or preview selection visitors will receive. The existing saved-page preview remains available for an admin's full-song audition. Confirm the preview and playback setting, then choose **Publish track**. Video reviews show the saved YouTube embed and require a separate **Publish video** confirmation.
- Required metadata and ready managed audio are checked on the server. Missing, processing, failed, or incomplete audio blocks publication. Missing artwork is a warning because the site has a default cover. The video URL must match its YouTube ID; availability and embedding permissions still need to be checked by playing the preview.
- Publishing rechecks readiness and the exact saved revision. A change by another admin requires reloading and reviewing again. Publication requests cannot include new metadata: save those changes as a draft first. Failed or uncertain publication keeps the review open and offers **Reload review** to check the saved status before retrying.
- Existing live edits keep their normal save workflow and are checked for media readiness; unpublishing remains a single action. Already-live legacy audio can stay unchanged while metadata is edited, but legacy drafts need a processed upload before publication. No existing content is republished, unpublished, or migrated by this release.
- Private review endpoints live under `/api/admin/publishing/tracks/[slug]` and `/api/admin/publishing/videos/[id]`. They require a current admin session, return uncached responses, and exclude trashed items. New-content APIs always create drafts and reject direct create-and-publish requests.

## Trash and Restore

- **Move to Trash** hides a song or video from the active library and website after confirmation. Saved details, credits, artwork and audio references remain intact. Unsaved edits to that item are discarded only after the move succeeds; unrelated editor work stays in place.
- Any active admin can open **Trash**, see when each item was removed and by whom, and use **Restore as draft**. Review the restored item in Tracks or Videos, then publish it when ready. A repeated restore does not unpublish an item another admin has already restored and published.
- Trashed tracks are unavailable through public pages, lists, metadata, playback and saved admin previews. A stale editor cannot save or publish an item while it is in Trash. Save requests also check the version originally opened, so another admin's trash/restore cycle cannot be overwritten by old edits. A conflict preserves the form; reload the library, then choose Edit on the changed item to review its current saved version. Restoration preserves the track URL, audio playback mode and preview settings.
- There is no automatic expiration or permanent-delete control. Trash protects new deletions after this release; it cannot recover records permanently deleted before this feature existed. Existing public artwork URLs remain public.
- `deletedAt` and `deletedBy` are optional MongoDB fields. Active-content queries include both a missing `deletedAt` and explicit `null`, so existing records need no data rewrite or database migration. Generate the updated Prisma client with the build; do not run a destructive schema reset.
- `GET /api/admin/trash` and the track/video restore routes require an active admin. Restore and move requests enforce the existing same-origin mutation rule, and Trash responses are private and uncached. Deletion still uses the existing `DELETE` URLs but now changes status instead of removing records or media.

Trash regressions run with `npx tsx --test scripts/tests/content-trash.test.ts` alongside the editor and privacy suites. For a real MongoDB rehearsal, supply `DATABASE_URL` through the environment and run `npx tsx scripts/tests/content-trash.mongo.integration.ts --isolated-database`. This rewrites the database path to a fresh random `monstajam_trash_test_*` database before connecting and removes only its fixture records afterward. It never reads or changes production content; empty test collections/indexes can remain when the database role cannot drop databases.

## Individual admin accounts

Admins sign in at `/upload/login` with their own username and password. Better Auth stores password hashes, opaque sessions and account state in separate `auth_*` MongoDB collections alongside the existing catalog. There is no public signup. The old shared `ADMIN_SECRET` and `admin_session` cookie grant no access in this version.

- The **owner** can invite/remove admins at `/upload/admins`. Each admin can manage the song/video catalog and change their own password at `/upload/account`. Only the owner can manage account access; owner access cannot be removed through the website.
- Usernames are immutable, case-insensitive and unique: 3–30 ASCII letters, numbers, dots or underscores. Surrounding whitespace is trimmed and usernames are stored in lowercase. The separate display name preserves capitalization and does not need to be unique. Email addresses are not used for sign-in; the provider's internal aliases are not contact addresses.
- Invitations and password resets produce one-use, one-hour links. The owner copies and shares them directly. **The application does not send invitation emails.** A new link replaces the previous one. Removed accounts require a fresh invitation and password setup.
- Activation, reset and password-change forms require 12–128 characters. The explicit offline initial-owner option below is the only exception. Sessions expire server-side after seven days, with no client-side session cache. Removal invalidates sessions and links immediately; resetting a password revokes existing sessions. Changing a password signs out other sessions and invalidates older reset links.
- Every private page and API checks the live account/session. Cross-origin mutations are rejected. Private responses are not cached; expired account access returns an explicit error so the content editor retains unsaved work.
- Login attempts and activation probes have database-backed limits. Account invitations, link issuance, removals and completed resets are recorded in `auth_audit`; this is an access log, not a history of song edits. MFA and email delivery are not part of this release.

### Environment and owner setup

Configure `DATABASE_URL`, a fresh random `BETTER_AUTH_SECRET` of at least 32 characters, and the exact canonical `BETTER_AUTH_URL` (production: `https://www.monstajamproductions.com`). Local development may use `http://localhost:<port>`. Production requires HTTPS. Use separate databases, secrets and origins for preview deployments; never attach a test preview to the production database.

The offline owner commands require database credentials from the environment, `OWNER_USERNAME`, and an exact database-name gate. `OWNER_NAME` is the optional display name at initial setup; it defaults to the supplied username. Supply credentials through the process environment, never command arguments or committed files. The commands default to a read-only check:

```bash
npm run admin:bootstrap -- --expect-database <exact-database-name>
npm run admin:bootstrap -- --expect-database <exact-database-name> --apply --output <absolute-private-output-file>
```

The output must be a new file in an existing directory **outside the repository**. It is restricted to the current Windows principal (or mode 0600 on POSIX). Passwords and links are never printed to the console. The command creates the required indexes, including unique owner and username constraints.

There are two initial-owner setup modes:

- With `OWNER_INITIAL_PASSWORD` absent, bootstrap creates a pending owner and writes a private activation link to the output file. The owner opens that one-hour link, chooses a 12–128 character password and then signs in normally.
- With `OWNER_INITIAL_PASSWORD` explicitly supplied, bootstrap creates an active owner with that password and writes only setup confirmation to the output file. This offline exception accepts 1–128 characters; it has no default, issues no activation link and never writes the plaintext password to the file. **It does not force a first-login password change or automatically expire the initial password.** Later changes and resets still require 12–128 characters. Remove the variable from the operator environment after initial provisioning.

Both modes apply only when no owner exists. Repeating bootstrap with the same owner is a no-op, even when `OWNER_INITIAL_PASSWORD` is supplied; it does not reset passwords or links. A different existing owner causes an error.

For an expired setup link or forgotten owner password, run the explicit recovery command with the same environment and exact existing owner username:

```bash
npm run admin:recover-owner -- --expect-database <exact-database-name>
npm run admin:recover-owner -- --expect-database <exact-database-name> --apply --output <new-absolute-private-output-file>
```

Recovery replaces the old link, without changing the owner's identity. It issues an activation link for a pending owner or a reset link for an active owner; both require a new 12–128 character password. `OWNER_INITIAL_PASSWORD` has no effect on recovery. Password operations use a per-account lock to prevent late password writes from overwriting newer credentials. A process crash can leave that lock in place; recovery intentionally refuses to clear it. An operator must first establish that the original request has ended before repairing such a lock. Do not clear a lock merely because a browser timed out.

### Release and verification

Before replacing shared-password authentication in production, confirm the owner's username and display name, verify the new flow against an isolated database, configure the production auth environment and bootstrap the owner. For link-based setup, securely provide the setup file and complete activation after deploying the account release. For explicit initial-password setup, the owner is already active and signs in with the supplied credentials. Verify owner sign-in and an invitation, then retire the obsolete shared-password environment value. Do not switch production before the owner setup is ready. An application rollback requires its matching auth configuration; the catalog/audio migration does not need to be undone.

Run `npm run test:admin-accounts`, the existing content/audio/editor suites, lint and build. After the build, `npm run test:admin-accounts:integration` checks signed cookies, server pages, RSC/prefetch, revocation, API guards and cache behavior on a local compiled server (port 3312). The regular HTTP tests inject a real Better Auth memory adapter through trusted Node test code and do not connect to a real database.

`npm run test:admin-accounts:mongo` is an explicit network integration test. Supply a MongoDB connection through the environment. It rewrites the database path to a fresh random `monstajam_auth_test_*` database before opening a connection, then verifies real indexes, invitations, activation, resets, removal and reinvitation. It removes all fixture documents afterward. The application's database role cannot drop databases, so empty test collections/indexes remain. It never reads or changes the production catalog or production accounts. The manual content smoke script requires `ADMIN_SMOKE_BASE_URL`, `ADMIN_SMOKE_USERNAME` and `ADMIN_SMOKE_PASSWORD`; it creates and edits one synthetic draft in its configured environment, moves it to Trash, and verifies its saved metadata is preserved. That draft remains in Trash for review or restoration; this script does not permanently remove it.

For browser and cross-route integration checks, start `tsx scripts/tests/admin-accounts.mongo.fixture.ts --isolated-database` with a connection supplied through the environment. This also uses a fresh isolated database, serves localhost:3399 and prints a stop-file path. Run `node scripts/tests/admin-accounts.mongo.http.cjs --local-fixture` against it to verify the actual Next HTTP invitation/activation flow across separately loaded route modules. Create the printed stop file when finished; the parent process stops its own Next child and removes/verifies all fixture account documents. Test identities use fixture usernames and a local-only password defined in the fixture source. Stop this server before `npm run build` on Windows because Prisma's native library cannot be regenerated while loaded by the dev server.

## Private originals and song previews

- Upload the full song once. New tracks default to **45-second preview**. **Allow full-song playback** controls public access independently of genre and Published/Draft. Existing tracks without an explicit mode retain their former genre-based playback behavior until saved or migrated.
- The original uploads directly to the private Blob store. The server creates an actual MP3 clip, starting at the selected time (0 by default, up to 7200 seconds). Short originals produce a shorter clip. Common MP3, WAV, M4A/AAC, FLAC, Ogg, AIFF and WebM audio containers are supported; damaged or unsupported files fail without changing the saved track.
- Preparation runs after the API response, with a database status and a bounded worker lease. The editor polls status; a failed or timed-out job can be retried using the uploaded original. Track metadata only attaches a ready asset. Changing the preview start creates a separate asset, so an existing published song stays available until the new version is ready and saved.
- Full originals and previews are accessed through the server, with byte-range support for seeking and private/no-store caching. Public pages and API responses serialize only permitted track metadata and the controlled playback URL. Admin audition requires authentication. There is no purchase checkout or entitlement system in this release.
- File selection and unsaved forms remain in browser memory. Keep the editor open while a new upload is being prepared; a forced close can lose the unsaved form, although an existing saved song is unaffected.

### Hosting and validation

Keep `BLOB_READ_WRITE_TOKEN` connected to the existing **public artwork** store. Connect a separate **private** Vercel Blob store with prefix `AUDIO`, which supplies `AUDIO_READ_WRITE_TOKEN`. Never replace the artwork store token with the private one. The audio preparation route needs the Node runtime, a 300-second duration, and the bundled platform-specific `ffmpeg-static` executable; Next's trace configuration includes that binary. Originals are capped at 500 MiB and use a bounded temporary file for seekable decoding. The worker gives headers/download 120 seconds, encoding 90 seconds, and preview upload 30 seconds. A temporary-storage or conversion failure leaves the saved track unchanged.

Create the unique `audio_assets.key` database index before allowing preparation jobs (the migration command does this in apply mode). Prisma client generation alone does not create MongoDB indexes. All schema additions are nullable on existing tracks.

Run `npm run test:audio`, the existing privacy/artwork/admin suites, `npm run lint`, and `npm run build`. The audio suite includes real encoded clips, M4A compatibility, private access, byte ranges, publication/mode changes, safe public serialization, job retries, and admin/player component flows. Hosted verification must additionally exercise a real private client upload and conversion; a build alone does not verify the Linux binary or storage credentials.

### Existing audio migration and rollback

Use an isolated database for rehearsal. `npm run migrate:audio -- --expect-database <name>` defaults to a read-only inventory. To apply, also supply `--apply --backup <absolute-path-outside-repository.ejsonl>`; `--limit 1` supports a first-song rehearsal. Select credentials through the environment, never in arguments or committed files.

The migration records an EJSON backup of each original track, copies originals into the private store, verifies SHA-256 after copying, generates/verifies a preview, then atomically attaches the ready asset while preserving publication, genre and playback mode. Concurrent edits cause that track to be skipped rather than overwritten. Repeated runs reuse verified copies. It never deletes public originals.

Release order: verify a preview deployment and migration rehearsal, deploy the compatible application to production, then migrate the production records with the exact-database and backup gates. Do not migrate production records while the old application still serves them, because it cannot resolve managed audio. Retire the old public audio objects only after verifying the new files, playback, and backups. Until those objects are retired, their old direct URLs remain accessible. Previously downloaded copies cannot be revoked.

For rollback after records have been migrated, prefer fixing/rolling back to a build that understands managed audio. Rolling back to the earlier application also requires restoring the original track fields from the migration backup; its player cannot read `audioAssetId`. Retaining old public objects during the initial cutover preserves this recovery path. Do not delete private originals as part of a metadata rollback.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
