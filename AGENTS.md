# Blank Platform - Agent Guidelines

## Package Manager

**Use Bun, not pnpm/npm/yarn**

```bash
# Install dependencies
bun install

# Add new dependency
bun add <package>

# Add dev dependency
bun add -d <package>

# Run dev server
bun run dev

# Build
bun run build
```

## Tech Stack

- **Framework:** Next.js 16+ (App Router)
- **Auth:** Auth.js v5 (beta)
- **Database:** SQLite with better-sqlite3
- **UI:** shadcn/ui components
- **Styling:** Tailwind CSS v4
- **Language:** TypeScript

## Project Structure

```
app/
  (auth)/          # Auth pages (login, signup)
  api/             # API routes
  dashboard/       # Project dashboard
  projects/[id]/   # Project editor
  layout.tsx       # Root layout
  page.tsx         # Landing page
lib/
  db.ts            # Database exports
  db/              # Database modules
    index.ts       # Connection
    users.ts       # User operations
    projects.ts    # Project operations
    user-sessions.ts # Session tracking
auth.ts            # Auth.js config
proxy.ts           # Auth proxy
```

## Database

SQLite database auto-created in `data/blank.db`.

**Key tables:**
- `users` - User accounts
- `projects` - User projects
- `user_sessions` - Sandbox session tracking

## Environment Variables

Copy `.env.local.example` to `.env.local` and set:
- `AUTH_SECRET` - Generate with `npx auth secret`
- `NEXTAUTH_URL` - Usually http://localhost:3000
- `SANDBOX_API_URL` - blank-sandbox endpoint (http://localhost:3001)

## Important Notes

- All AI logic stays in blank platform
- blank-sandbox is separate service - communicate via API
- Session IDs stored in sessionStorage (browser), project session IDs in SQLite
- File changes sync to S3 via blank-sandbox's entrypoint.sh
- One active session per user at a time (current design)

## Development Workflow

1. Start blank-sandbox first (runs on :3001)
2. Start blank platform: `bun run dev` (runs on :3000)
3. Visit http://localhost:3000

## Related Documentation

- `docs/pendings.md` - Future features
- `docs/blank-ai-powered-platform.md` - AI agent architecture
- `../blank-sandbox/` - Sandbox service (separate project)
