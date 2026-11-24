// Offline checks for the Live voice agent setup (src/lib/agent/convai-agent.ts).
// fetch is replaced by a stub, so nothing reaches ElevenLabs; the key is fake.
// Run: corepack pnpm exec tsx scripts/convai-agent-test.ts
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let n = 0;
const check = (ok: unknown, label: string) => {
  assert.ok(ok, label);
  n++;
  console.log(`✓ ${label}`);
};

type Call = { method: string; url: string; body?: Record<string, unknown> };
let calls: Call[] = [];
let existing: { agent_id: string; name: string; archived?: boolean }[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const method = init?.method ?? "GET";
  assert.ok(url.startsWith("https://api.elevenlabs.io/v1/convai/"), `unexpected request: ${url}`);
  calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
  const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200 });
  if (method === "GET" && url.includes("/agents?")) return json({ agents: existing, has_more: false });
  if (method === "POST" && url.endsWith("/agents/create")) return json({ agent_id: "agent_new" });
  if (method === "PATCH") return json({});
  if (url.includes("/conversation/token")) return json({ token: "tok" });
  throw new Error(`unhandled ${method} ${url}`);
}) as typeof fetch;

// The agent id cache lives in <cwd>/.ghost; use a throwaway folder so the real one is untouched.
const dir = mkdtempSync(path.join(tmpdir(), "convai-test-"));
process.chdir(dir);
process.env.ELEVENLABS_API_KEY = "test-not-a-real-key";
process.env.POLTY_PUBLIC_DEMO = "1";
delete process.env.ELEVENLABS_AGENT_ID;
delete process.env.DEMO_LIVE_MAX_SECONDS;

(async () => {
  const { ensureAgent } = await import("../src/lib/agent/convai-agent");

  // 1. Demo, nothing cached, no agent yet: creates one named for the demo, with a session cap.
  existing = [{ agent_id: "agent_local", name: "Polty · GHOST" }];
  let id = await ensureAgent();
  const create = calls.find((c) => c.method === "POST");
  check(id === "agent_new" && create, "demo with no matching agent creates a new one");
  check(create?.body?.name === "Polty · GHOST (public demo)", "the demo agent has its own name (the local agent is left alone)");
  const conv = (create?.body?.conversation_config as { conversation?: { max_duration_seconds?: number } }).conversation;
  check(conv?.max_duration_seconds === 195, "ElevenLabs ends demo sessions after 3 min + 15 s");

  // 2. Cached: no API calls at all.
  calls = [];
  id = await ensureAgent();
  check(id === "agent_new" && calls.length === 0, "a cached agent is reused without calling ElevenLabs");

  // 3. Fresh container (cache gone), agent already exists: reuse it by name and update it.
  rmSync(path.join(dir, ".ghost"), { recursive: true, force: true });
  existing = [{ agent_id: "agent_demo", name: "Polty · GHOST (public demo)" }, { agent_id: "agent_local", name: "Polty · GHOST" }];
  calls = [];
  id = await ensureAgent();
  check(id === "agent_demo" && !calls.some((c) => c.method === "POST"), "after a redeploy the existing demo agent is reused, not duplicated");
  check(calls.some((c) => c.method === "PATCH" && c.url.endsWith("/agents/agent_demo")), "...and updated with the current settings");

  // 4. A fixed ELEVENLABS_AGENT_ID would skip the session cap, so demo mode ignores it.
  process.env.ELEVENLABS_AGENT_ID = "agent_fixed";
  check((await ensureAgent()) !== "agent_fixed", "demo mode ignores ELEVENLABS_AGENT_ID");
  delete process.env.POLTY_PUBLIC_DEMO;
  check((await ensureAgent()) === "agent_fixed", "outside demo mode ELEVENLABS_AGENT_ID is used as before");

  process.chdir(tmpdir());
  rmSync(dir, { recursive: true, force: true });
  console.log(`\n${n} Live voice agent checks passed (no network)`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
