# Sandbox Architecture

## Overview

The playground/editor environment is a **separate project** (`blank-sandbox`) from the main platform (`blank`). This mirrors how v0.dev separates its chat/platform (`v0.dev`) from the actual editor/execution environment (`v0.app`).

```
blank/          ← Main platform (this repo)
                  Marketing, auth, project management, AI chat UI

blank-sandbox/  ← Separate project (to be built)
                  IDE (openvscode-server) + execution environment
```

v0.app confirmed to run **code-server v0.0.59** in the browser, with Vercel Sandbox (Firecracker microVMs) as the real execution backend.

---

## Execution Tier Decision

### Tier 1 — Fully Browser-Native (MVP / Embeds)

No server infrastructure. Runs entirely in the browser.

| Option | Best For | Notes |
|--------|----------|-------|
| **WebContainers** (`@webcontainer/api`) | Full dev env in browser | Real Node.js via WASM. Best Next.js support. Requires `COOP`/`COEP` headers. Chrome-first. |
| **Nodebox / Sandpack** (`@codesandbox/nodebox`) | Embeds, wide browser support | No `SharedArrayBuffer` requirement → works in Safari/Firefox. ~500ms cold start. Good for embed widget use case. |
| **almostnode.dev** (`almostnode` npm) | Ultra-light instant previews | ~250KB gzipped, instant start. Experimental. Good for docs/tutorial embeds where simplicity matters more than full compatibility. |

**MVP recommendation:** Start with **WebContainers** or **Sandpack/Nodebox** — both are production-ready and give you the editor + browser runtime without any server infra. Use almostnode for the lightweight embed widget.

### Tier 2 — Server-Backed Full IDE (Production)

Real Linux VM per session. Full Node.js, real filesystem, no compatibility shims.

| Component | Technology | Notes |
|-----------|------------|-------|
| **IDE in browser** | `openvscode-server` (MIT) | VS Code for the web. Connects to backend VM. |
| **Execution / VM** | Fly.io Machines, Firecracker microVMs, or Vercel Sandbox | Ephemeral Linux VMs. Snapshots eliminate cold-start. |
| **Local dev** | OrbStack Linux machine | See below. |

This is the target for the full `blank-sandbox` project — matches v0.app's architecture.

---

## Local Development with OrbStack

On macOS, **OrbStack Linux machines** are the ideal local stand-in for cloud VMs:

1. Create a Linux machine in OrbStack
2. Install `openvscode-server` inside it:
   ```bash
   # Inside OrbStack Linux machine
   curl -fsSL https://code-server.dev/install.sh | sh
   # or download openvscode-server directly from github.com/gitpod-io/openvscode-server/releases
   ```
3. Run it:
   ```bash
   code-server --host 0.0.0.0 --port 3030 --auth none
   ```
4. Access from your Mac browser at `http://<machine-name>.orb.local:3030`

OrbStack gives each machine a `.orb.local` domain automatically — no port-forwarding needed. The machine behaves like the production Fly.io VM, so your local setup maps 1:1 to production.

**openvscode-server vs code-server:**
- `openvscode-server` (Gitpod, MIT) — upstream VS Code with minimal patches. Recommended.
- `code-server` (Coder, MIT) — more opinionated, adds auth/proxy layers. Also fine.

---

## blank-sandbox: The Wrapper App

`openvscode-server` is just a process running on a VM — it serves VS Code at a port. `blank-sandbox` is a **separate Next.js app** that wraps it, owns the outer UI shell, and orchestrates everything around it.

```
blank-sandbox (Next.js app)
├── Top bar        — logo, share, publish, controls
├── Left panel     — iframe → openvscode-server URL (the editor)
│                    e.g. http://<vm>.orb.local:3030  (local)
│                         https://<session-id>.blank.app (production)
└── Right panel    — iframe → running dev server URL (the preview)
                     e.g. http://<vm>.orb.local:3000
```

### Responsibilities

| Layer | Owned by |
|-------|----------|
| VM lifecycle (spin up, tear down, snapshots) | `blank-sandbox` |
| Session + auth (which user owns which VM) | `blank-sandbox` |
| Outer UI shell (toolbar, split view, preview pane) | `blank-sandbox` |
| Editor UI | `openvscode-server` (iframed, not built by you) |
| Code execution / file system | VM running openvscode-server |
| Preview | Running dev server on the VM (iframed) |

You don't build openvscode-server — you just run it on the VM and point an iframe at its URL. Same for the Next.js dev server on port 3000 — a second iframe. This is exactly how v0.app works: their outer shell is their own app; code-server and the live preview are both embedded inside it.

### Project Split

| Repo | Purpose |
|------|---------|
| `blank` | Main platform — landing, auth, project list, AI chat |
| `blank-sandbox` | Wrapper app — VM management + outer IDE shell UI |
| `openvscode-server` | Just a process on the VM, not a repo you maintain |

---

## Other Technologies Evaluated

### lifo.sh (`@lifo-sh/core`)

Browser-native OS/shell library. Runs in the browser using Web APIs as syscalls (not a server). Shimmed POSIX shell + 60+ commands + IndexedDB filesystem + isomorphic-git.

**Fits Blank as:** AI agent code-execution sandbox — when the AI generates code, lifo.sh can safely run it in the browser without any VM. Perfect for the Phase 3 AI prompt-to-project feature.

**Does NOT fit:** as a replacement execution layer inside openvscode-server — code-server connects to a real server PTY; lifo.sh is browser JS. They operate at completely different layers and cannot be bridged.

### almostnode.dev (`almostnode` npm)

Browser-native Node.js runtime using esbuild-wasm + Service Worker (simulates HTTP server). ~250KB gzipped, instant startup.

**Fits Blank as:** the ultra-lightweight embed widget runtime. When a learner on a docs page wants to run a Next.js snippet without spinning up a full WebContainer.

**Does NOT fit:** inside openvscode-server for the same reason as lifo.sh — they operate at different layers.

---

## Architecture by Use Case

| Use Case | Approach |
|----------|----------|
| MVP browser playground | WebContainers or Sandpack (Nodebox) |
| Embeddable widget in docs/courses | almostnode.dev or Sandpack |
| Full IDE experience (target) | openvscode-server + Fly.io VMs |
| AI-generated code execution (Phase 3) | lifo.sh (safe browser sandbox) |
| Local dev on Mac | OrbStack Linux machine + openvscode-server |

---

## References

- [WebContainers API](https://webcontainers.io/) — StackBlitz
- [Sandpack / Nodebox](https://sandpack.codesandbox.io/) — CodeSandbox
- [almostnode.dev](https://almostnode.dev/) / [github.com/macaly/almostnode](https://github.com/macaly/almostnode)
- [lifo.sh](https://lifo.sh) / [github.com/lifo-sh/lifo](https://github.com/lifo-sh/lifo)
- [openvscode-server](https://github.com/gitpod-io/openvscode-server) — Gitpod (MIT)
- [code-server](https://github.com/coder/code-server) — Coder (MIT)
- [Vercel Sandbox](https://vercel.com/docs/vercel-sandbox)
- [OrbStack](https://orbstack.dev/)
