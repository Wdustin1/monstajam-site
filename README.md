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
- Audio and artwork currently use public Blob storage. These checks hide draft records and stop public pages/API responses from revealing their file URLs; they do **not** revoke previously known direct file URLs. Confidential media requires private storage and migration of existing public files.

Run the privacy regression checks with `npm run test:draft-privacy`. Run HTTP checks against an isolated local fixture server with `npm run test:draft-privacy:integration`; after `npm run build`, add `-- --production` to verify the compiled server and production cache headers. These checks use generated local login credentials and a read-only fixture database, never production data. Port 3310 must be free.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
