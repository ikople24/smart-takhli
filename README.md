This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/pages/api-reference/create-next-app).

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

You can start editing the page by modifying `pages/index.tsx`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.ts`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/pages/building-your-application/routing/api-routes) instead of React pages.

This project uses [`next/font`](https://nextjs.org/docs/pages/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn-pages-router) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Google Sheet sync (Smart Papar • Water Quality)

This project includes a server endpoint that can **sync Google Form responses (Google Sheets)** into MongoDB (collection: `smart_papar_water_quality_daily`) by **upserting per-day** using `recordDate` (Bangkok date).

### Setup

- Create a Google Cloud project
- Enable **Google Sheets API**
- Create a **Service Account**
- Share your Google Sheet with the service account email (Editor or Viewer)
- Copy `.env.example` → `.env.local` and fill:
  - `GOOGLE_SHEETS_SPREADSHEET_ID`
  - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
  - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

> If your Google Sheet is shared as **"anyone with the link"**, you can set only:
> - `GOOGLE_SHEETS_SPREADSHEET_ID`
> - (optional) `GOOGLE_SHEETS_SHEET_NAME` (default: `Form_Responses 1`)

### Run sync

- Endpoint: `POST /api/smart-papar/water-quality/sync-sheet`
- Auth: uses the same Smart Papar admin permission as the Water Quality page (Clerk session)
- Optional query: `maxRows` (process only the last N rows)

Example:

```bash
curl -X POST "http://localhost:3000/api/smart-papar/water-quality/sync-sheet?maxRows=200" \
  -H "Content-Type: application/json"
```

### Auto sync (Railway Cron)

Use a cron-only endpoint protected by a secret:

- Endpoint: `POST /api/cron/smart-papar/water-quality-sync`
- Auth: query `?secret=<CRON_SECRET>` or header `x-cron-secret`
- Optional query: `maxRows` (default 200)

Example:

```bash
curl -X POST "https://<your-domain>/api/cron/smart-papar/water-quality-sync?secret=<CRON_SECRET>&maxRows=200"
```

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/pages/building-your-application/deploying) for more details.
