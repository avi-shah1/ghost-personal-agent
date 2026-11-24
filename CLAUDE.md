@AGENTS.md

# Polty (GHOST hackathon version) — project notes

## What this is
- The user's fork of MartinPuli/augment ("GHOST"), at https://github.com/avi-shah1/ghost-personal-agent.
- This folder is a **git worktree** on branch `polty-hackathon`, pinned from commit `c11acf7` (4 Oct 2026): the
  Polty voice/chat agent with the generative canvas. The fork's `main` (hardware-only MCP broker, the authors'
  later pivot) is checked out separately in the sibling folder `../ghost-personal-agent`.
- Goal: a public portfolio piece. Visitors set it up with **their own keys**; a demo video goes in the README.
  Hardware features are out of scope for now.

## Run (Windows)
- `pnpm` is not on PATH: use `corepack pnpm <cmd>`.
- Port 3000 is often taken by another project's dev server, so run on 3200:
  `$env:PORT = 3200; corepack pnpm dev` then open http://localhost:3200 (setup guide at /setup).
- Keys live in `.env.local` (git-ignored). Never commit keys or print their values.

## Checks before saying "done"
- `node_modules\.bin\tsc.cmd --noEmit`, `node_modules\.bin\eslint.cmd src` (one pre-existing warning in
  `canvas/widgets/core.tsx` is expected), `node_modules\.bin\next.cmd build`.
- Use `next build`, not `pnpm build`: the build script first downloads illustrations from an external CDN.
- A build can run while `pnpm dev` is up (dev writes to `.next/dev`).
- UI changes: check in a browser. If the Chrome extension isn't connected, screenshot with playwright-core
  and the local Chrome (`C:/Program Files/Google/Chrome/Application/chrome.exe`); `scripts/ui-shot.mts` is Mac-only.
- Never call paid APIs (Anthropic, ElevenLabs, Exa, ...) from tests or checks.

## Setup guide (/setup)
- Page: `src/app/setup/page.tsx` → `src/components/setup/SetupGuide.tsx`.
- Content (steps, unlocks, cost, try-it prompt per integration): `src/components/setup/integrations.tsx`.
- Status: `GET /api/v1/setup/status` (`src/lib/ghost/server/routes/setup.ts`) returns booleans only.
- Shared client logic (status fetch/hook, ABILITIES list, ready checks): `src/lib/setup/status.ts`. Used by
  `/setup`, the home intro (`src/components/hud/Hero.tsx`: "Here's what I can do so far", ability chips,
  "Unlock N more" button, suggestions limited to ready integrations) and the top-bar Set up button.
- The home page already POSTs `/api/stt-token` on load when ElevenLabs is set (pre-existing); block
  `/api/agent|stt|stt-token|convai` in any headless screenshot script so checks never spend credits.
- Google OAuth redirect defaults to `http://localhost:3000/...`; on another port set
  `NEXT_PUBLIC_PUBLIC_ORIGIN=http://localhost:<port>` (the page detects the mismatch and says so).
- `/media/nature.mp4` and `.jpg` 404 locally: the background video is not in the repo (pre-existing).

## Plan
1. Setup page with Claude, Google Workspace, Exa, ElevenLabs, YouTube cards. **Done 2026-11-24** (not committed).
2. Same guides as Markdown in `docs/setup/` + README link; add Kernel / AgentMail / Executor cards.
3. Deploy. The custom Node server (`server.ts`, WebSockets) does not run on Vercel as-is; Fly.io/Render
   (Dockerfile + fly.toml exist) are easier. A public deploy needs spend protection (dedicated key, spend
   limit, cheaper model, rate limit or passcode) because `/api/agent` uses the server's Claude key with no auth.
- Undecided: which branch becomes the fork's default; whether to push `polty-hackathon`.
