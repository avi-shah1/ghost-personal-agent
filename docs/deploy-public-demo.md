# Hosting a public Polty demo

This runs the whole app (website, Polty's agent route and the coordinator) as **one always-on
Docker service**. It uses the repo's `Dockerfile`; `railway.json` configures Railway.

Vercel alone can't host this version: the coordinator is a long-running process with WebSockets,
in-memory state and an embedded database, and Vercel only runs short-lived functions.

## Before you start: protect your Claude credits

A public demo runs on **your** Anthropic key, so anyone who opens the link spends your credits.

1. In the [Anthropic Console](https://console.anthropic.com), create a separate **workspace** for the
   demo (e.g. `polty-public-demo`) and set a **monthly spend limit** on it. This is the hard cap:
   if it's reached, the demo pauses until next month instead of costing more.
2. Create an API key **inside that workspace**. Use it only for the demo, so you can revoke it any
   time without touching your other projects.
3. Set `POLTY_PUBLIC_DEMO=1` on the host (below). That turns on the app's own protections:
   - Polty always uses the Fast brain (Claude Haiku); the Deep toggle is disabled,
   - each visitor gets a limited number of model requests per hour (`DEMO_TURNS_PER_HOUR`, default 40),
   - the whole site gets a daily budget (`DEMO_TURNS_PER_DAY`, default 300),
   - the ElevenLabs voice routes get their own limits (`DEMO_VOICE_PER_HOUR` 60, `DEMO_VOICE_PER_DAY` 600).

   One question can use several requests when Polty calls tools. Counters live in memory and reset
   when the server restarts; the Anthropic spend limit is what actually caps cost.

## Environment variables on the host

| Variable | Set it? | Why |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | **Yes** | The dedicated demo key from step 2. |
| `POLTY_PUBLIC_DEMO` | **Yes**, `1` | Turns on the protections above. |
| `DEMO_TURNS_PER_HOUR`, `DEMO_TURNS_PER_DAY` | Optional | Tighten or loosen the limits. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | **No** | Visitors would connect *their* Gmail and Calendar to *your* server. |
| `EXA_API_KEY`, `YOUTUBE_API_KEY` | Not at first | Their API routes aren't rate-limited by demo mode; strangers could use up your quota. |
| `ELEVENLABS_API_KEY` | Optional | Visitors get the natural voice, limited per visitor; without it Polty uses the browser's voice. |
| `DATABASE_URL` | Optional | Without it the embedded database starts empty on each deploy, which is fine for a demo. |

Never put keys in the repo. Hosts store them as encrypted variables.

## Railway (recommended)

The server needs roughly 400–450 MB of memory, so plans capped at 512 MB are too tight.
Railway bills for actual usage instead; check [railway.com/pricing](https://railway.com/pricing).

1. Sign up at [railway.com](https://railway.com) with GitHub.
2. **New Project → Deploy from GitHub repo**, pick this repository, then in the service's
   **Settings → Source** choose the branch to deploy (e.g. `polty-hackathon`).
3. In **Variables**, add `ANTHROPIC_API_KEY` and `POLTY_PUBLIC_DEMO=1`.
4. In **Settings → Networking**, click **Generate Domain** to get a public `https://….up.railway.app` address.
5. The first build takes several minutes. When it's live, open the address:
   - `/api/v1/health` should return `{"ok":true,...}`,
   - the home page should say "Here's what I can do so far" with a "Public demo" note,
   - the **Deep** brain toggle should be greyed out.

Every push to that branch redeploys automatically.

## Other hosts

- **Render**: works with the same Dockerfile, but needs a plan with more than 512 MB of memory.
- **Fly.io**: the original authors' setup (`fly.toml`, `docs/deploy.md`); use a machine with 1 GB.

## Checking the protections locally

```sh
pnpm exec tsx scripts/demo-limits-test.ts   # offline, no API calls
```
