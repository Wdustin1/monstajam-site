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
