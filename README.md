# Blank

**Interactive code playground for web development — start from blank, experiment instantly, learn by doing.**

Blank is a fast, web-based code playground designed for React and Next.js (frontend/UI focus first), with plans to grow into a full prompt-to-project creation platform.

## What is Blank?

- A zero-setup, browser-native editor + preview environment.
- Built around VS Code OSS for the web (familiar, powerful editing experience).
- Instant live previews, hot-reloading, and shareable playground sessions.
- Embeddable into tutorials, courses, documentation, or learning platforms — so learners can interact with code concepts right where they're reading/watching.
- From a blank canvas → write, tweak, see results immediately — perfect for experimenting with components, hooks, layouts, styling (Tailwind/shadcn/ui), etc.

## Core Goals (Current Phase)

1. **Frictionless Playground Experience**
   Open → code → play → instant feedback. No installs, no local setup.

2. **Great Developer & Learner Experience (DX/LX)**
   - Modern stack: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui (or similar).
   - Responsive editor/preview split-view.
   - Easy sharing of playground links/snippets.

3. **Embeddability for Education**
   Integrate seamlessly into web dev courses, bootcamps, docs, or blogs.
   Learners can:
   - Try examples interactively while following a lesson.
   - Modify code to understand concepts (e.g., state, effects, routing).
   - Experiment safely without breaking anything.

4. **Foundation for Future Features**
   - Chat/prompt interface to generate → edit → run projects (like v0.dev style).
   - Expand to backend (API routes, databases), full-stack apps.
   - Deployment previews, version history, collaboration.

## Why Blank?

- **Play → Learn → Build** flow: Turns passive reading into active coding.
- Starts simple (frontend playground) but scales to powerful creation tool.
- Open, embeddable, and focused on real code (not locked black-box generation).
- Tagline options we're exploring:
  - Play. Code. Learn. Instantly.
  - Interactive Playground. Zero Setup. Endless Learning.
  - Blank to Built, Step by Step.
  - Your Blank Canvas for Real Code.

## Tech Stack

- **Framework:** Next.js 16+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui (Radix UI + Mira style)
- **Font:** Nunito Sans
- **Icons:** Lucide
- **Package Manager:** Bun

## Getting Started

```bash
# Install dependencies
bun install

# Run development server
bun dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Project Structure

```
blank/
├── app/              # Next.js App Router
├── components/       # UI components (shadcn/ui)
├── lib/              # Utility functions
├── public/           # Static assets
├── styles/           # Global styles
└── ...
```

## Roadmap

### MVP Playground
- [ ] Editor + live preview for Next.js/React apps
- [ ] Basic file structure management
- [ ] Hot module replacement

### Embed SDK
- [ ] iframe embed support
- [ ] URL-based playground sharing
- [ ] Embed configuration options

### Persistence
- [ ] Save/load playground sessions
- [ ] Cloud sync
- [ ] Version history

### Prompt Generation
- [ ] AI-powered project generation
- [ ] Natural language to code
- [ ] Component generation

### Backend Integration
- [ ] API routes support
- [ ] Database integration
- [ ] Full-stack playground

## Contributing

Contributions, feedback, and ideas are welcome! Let's build something delightful for learners and builders alike.

---

🚀 From blank → brilliant.
