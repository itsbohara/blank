# Project knowledge

**Blank** - An interactive code playground for web development with AI-powered sandbox environments.

## What This Project Is

- **Purpose:** Web-based code playground for React/Next.js experimentation with zero setup
- **Core Flow:** Users create projects → get a sandbox environment with VS Code in browser → live preview
- **Key Feature:** Embeddable sandbox for education/tutorials with instant feedback

## Quickstart

```bash
# Setup (package manager: Bun)
bun install

# Dev (requires blank-sandbox running on :9099)
bun dev

# Build
bun run build

# Lint
bun run lint

# No test runner configured yet
```

## Architecture

### Key Directories

```
app/
  (auth)/          # Login/signup pages (NextAuth)
  api/             # API routes
    auth/          # NextAuth handlers
    projects/      # CRUD for projects
    sandbox/session/  # Sandbox lifecycle management
  dashboard/       # Project list view
  projects/[projectId]/  # Sandbox editor view

lib/
  db/              # SQLite database layer
    index.ts       # better-sqlite3 connection
    users.ts       # User CRUD
    projects.ts    # Project CRUD
    user-sessions.ts # Active sandbox session tracking

components/
  ui/              # shadcn/ui components (radix-mira style)
```

### Data Flow

1. **User creates project** → Stored in SQLite (`projects` table)
2. **Opens project** → POST `/api/sandbox/session` → talks to blank-sandbox API
3. **Session lifecycle** → One active session per user (kills old if switching projects)
4. **File persistence** → blank-sandbox syncs to S3; session IDs link project ↔ sandbox

## Conventions

### Formatting/Linting
- ESLint via `eslint.config.mjs`
- Tailwind CSS v4 with `@tailwindcss/postcss`
- TypeScript strict mode enabled

### Patterns to Follow
- **Auth:** Use `auth.ts` config with Credentials provider (email/password)
- **DB:** All DB operations go through `lib/db/*.ts` modules
- **Components:** shadcn/ui pattern with `class-variance-authority` for variants
- **Fonts:** Nunito Sans primary, Geist for monospace
- **Paths:** Use `@/*` alias for imports

### Things to Avoid
- **No test runner yet** - don't add tests without jest/vitest setup
- **One session per user** - session switching kills the old sandbox container
- **Never use `any` type** - strict TypeScript enforcement
- **Don't add excessive comments** - prefer clean, self-explanatory code
- **Never assume packages exist** - check `package.json` first

## Important Context

### External Dependencies
- **blank-sandbox** - Separate service (port 9099) that manages Docker containers with VS Code web
- **SQLite** - Auto-creates `data/blank.db` on first run
- **S3** - For file persistence between sessions (handled by blank-sandbox)

### Auth & Sessions
- NextAuth v5 (beta) with JWT strategy
- 30-day session expiry
- Session ID stored in browser sessionStorage, project session ID in SQLite

### Environment Variables (`.env.local`)
```
AUTH_SECRET=          # npx auth secret
NEXTAUTH_URL=         # http://localhost:3000
SANDBOX_API_URL=      # http://localhost:9099
```

### Related Documentation
- `docs/blank-ai-powered-platform.md` - AI agent architecture
- `docs/sandbox-architecture.md` - blank-sandbox integration
- `docs/pendings.md` - Feature roadmap
- `AGENTS.md` - Full agent guidelines
