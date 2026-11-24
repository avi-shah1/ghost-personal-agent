/**
 * Public demo protections for a hosted copy that runs on the owner's API keys.
 *
 * Off unless POLTY_PUBLIC_DEMO=1. When on:
 *   - /api/agent always uses the Fast brain (Haiku) with a smaller output cap,
 *   - each visitor (by IP) gets a limited number of model turns per hour,
 *   - the whole site gets a daily turn budget, as a backstop against IP rotation,
 *   - the ElevenLabs voice routes get their own per-visitor and daily limits,
 *   - Live voice (the always-listening ElevenLabs agent, billed per minute) gets a small number of
 *     sessions per visitor and per day, and each session is cut off after a few minutes.
 *
 * Counters live in this server process's memory: right for a single instance, and they reset on
 * restart. The provider-side caps (Anthropic workspace spend limit, ElevenLabs plan credits) stay
 * the real hard limits. One "turn" is one model call; a question can take several when Polty uses tools.
 */

export type LimitKind = "agent" | "voice" | "live";

export function demoMode(): boolean {
  return process.env.POLTY_PUBLIC_DEMO === "1";
}

function num(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

export function demoLimits() {
  return {
    agentPerHour: num("DEMO_TURNS_PER_HOUR", 40),
    agentPerDay: num("DEMO_TURNS_PER_DAY", 300),
    voicePerHour: num("DEMO_VOICE_PER_HOUR", 60),
    voicePerDay: num("DEMO_VOICE_PER_DAY", 600),
    livePerHour: num("DEMO_LIVE_PER_HOUR", 3),
    livePerDay: num("DEMO_LIVE_PER_DAY", 30),
    liveMaxSeconds: num("DEMO_LIVE_MAX_SECONDS", 180),
  };
}

const PER_KIND = {
  agent: { hour: "agentPerHour", day: "agentPerDay", visitorMsg: "Polty's public demo allows a limited number of requests per visitor each hour", siteMsg: "Polty's public demo has used today's budget" },
  voice: { hour: "voicePerHour", day: "voicePerDay", visitorMsg: "The demo's voice features are limited per visitor each hour", siteMsg: "The demo's voice features have used today's budget" },
  live: { hour: "livePerHour", day: "livePerDay", visitorMsg: "Live voice on the public demo is limited to a few sessions per visitor each hour", siteMsg: "Live voice on the public demo has used today's sessions" },
} as const;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

interface Bucket {
  count: number;
  resetAt: number;
}
// Next bundles each route handler separately, so a module-level Map would be one per route.
// Keeping it on globalThis gives every route in this process the same counters.
const g = globalThis as typeof globalThis & { __poltyDemoBuckets?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = (g.__poltyDemoBuckets ??= new Map<string, Bucket>());

function bucket(key: string, windowMs: number, now: number): Bucket {
  let b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  return b;
}

/** Drop expired per-visitor buckets now and then so memory stays flat. */
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 10 * 60 * 1000) return;
  lastSweep = now;
  for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k);
}

/** The visitor's IP as reported by the host's proxy (Render, Fly and Vercel set x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim() || "unknown";
}

export interface LimitHit {
  scope: "visitor" | "site";
  retryAfterS: number;
  message: string;
}

const minutes = (s: number) => Math.max(1, Math.ceil(s / 60));

/**
 * Count one use of `kind` for this request. Returns null when allowed (and records it), or why
 * it was refused. Nothing is counted when demo mode is off.
 */
export function takeDemoAllowance(req: Request, kind: LimitKind, now = Date.now()): LimitHit | null {
  if (!demoMode()) return null;
  sweep(now);
  const l = demoLimits();
  const k = PER_KIND[kind];
  const visitor = bucket(`${kind}:ip:${clientIp(req)}`, HOUR, now);
  const site = bucket(`${kind}:site`, DAY, now);

  if (visitor.count >= l[k.hour]) {
    const retryAfterS = Math.ceil((visitor.resetAt - now) / 1000);
    return {
      scope: "visitor",
      retryAfterS,
      message: `${k.visitorMsg} to keep costs down. Try again in about ${minutes(retryAfterS)} min, or run Polty with your own key (see /setup).`,
    };
  }
  if (site.count >= l[k.day]) {
    const retryAfterS = Math.ceil((site.resetAt - now) / 1000);
    return {
      scope: "site",
      retryAfterS,
      message: `${k.siteMsg}. It resets within ${Math.ceil(retryAfterS / 3600)} h, or you can run Polty with your own key (see /setup).`,
    };
  }
  visitor.count++;
  site.count++;
  return null;
}

/** A JSON 429 for routes whose browser code falls back gracefully (voice). */
export function limitResponse(hit: LimitHit): Response {
  return Response.json(
    { error: hit.message, code: "demo_limit", scope: hit.scope },
    { status: 429, headers: { "Retry-After": String(hit.retryAfterS) } },
  );
}

/** For tests: forget all counters. */
export function resetDemoLimits() {
  buckets.clear();
  lastSweep = 0;
}
