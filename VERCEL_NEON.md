# Vercel + Neon setup

## 1. Neon

Create a Neon project, then copy the pooled PostgreSQL connection string.

Example:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST.neon.tech/DBNAME?sslmode=require"
```

The API creates these tables automatically on first request:

- `oh_events`
- `oh_guests`

## 2. Vercel

Add the project to Vercel and set this environment variable:

```env
DATABASE_URL=your_neon_connection_string
```

Build command:

```bash
npm run build
```

Output directory:

```bash
dist
```

## 3. Local API testing

Vite can run the frontend, but Vercel serverless API routes need Vercel's runtime:

```bash
vercel dev
```

Then open:

```text
http://localhost:3000
```

## 4. Realtime note

Neon on Vercel does not provide browser realtime channels like Supabase Realtime.
This project now syncs in the background every 2.5 seconds through `/api/sync`.
For true push realtime, add a realtime transport such as Ably, Pusher, or a dedicated WebSocket server.
