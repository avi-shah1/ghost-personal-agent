// Offline checks for the public-demo limiter (src/lib/demo/limits.ts). No network, no API keys.
// Run: corepack pnpm exec tsx scripts/demo-limits-test.ts
import assert from "node:assert/strict";
import { clientIp, demoLimits, demoMode, resetDemoLimits, takeDemoAllowance } from "../src/lib/demo/limits";

let n = 0;
const check = (ok: unknown, label: string) => {
  assert.ok(ok, label);
  n++;
  console.log(`✓ ${label}`);
};
const req = (ip: string) => new Request("http://x/api/agent", { method: "POST", headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });

delete process.env.POLTY_PUBLIC_DEMO;
resetDemoLimits();
check(!demoMode(), "demo mode is off by default");
check(Array.from({ length: 500 }, () => takeDemoAllowance(req("1.1.1.1"), "agent")).every((r) => r === null), "nothing is limited when demo mode is off");

process.env.POLTY_PUBLIC_DEMO = "1";
process.env.DEMO_TURNS_PER_HOUR = "3";
process.env.DEMO_TURNS_PER_DAY = "5";
resetDemoLimits();
const t0 = Date.UTC(2026, 10, 24, 12);
check(clientIp(req("2.2.2.2")) === "2.2.2.2", "client IP is the first x-forwarded-for entry");
for (let i = 0; i < 3; i++) assert.equal(takeDemoAllowance(req("2.2.2.2"), "agent", t0), null);
const v = takeDemoAllowance(req("2.2.2.2"), "agent", t0);
check(v?.scope === "visitor" && /per visitor/.test(v.message) && /\/setup/.test(v.message), "4th turn in an hour is refused for that visitor, with a pointer to /setup");
check(takeDemoAllowance(req("3.3.3.3"), "agent", t0) === null, "another visitor is still allowed");
check(takeDemoAllowance(req("3.3.3.3"), "agent", t0) === null, "...twice (site total now 5)");
const s = takeDemoAllowance(req("4.4.4.4"), "agent", t0);
check(s?.scope === "site", "a new visitor is refused once the site's daily budget is used");
check(takeDemoAllowance(req("2.2.2.2"), "voice", t0) === null, "voice has its own separate budget");
check(takeDemoAllowance(req("2.2.2.2"), "agent", t0 + 61 * 60 * 1000)?.scope === "site", "after an hour the visitor limit resets but the daily site cap still holds");
check(takeDemoAllowance(req("2.2.2.2"), "agent", t0 + 25 * 60 * 60 * 1000) === null, "after a day everything resets");

// Live voice (ElevenLabs agent, billed per minute): a few sessions per visitor, each time-capped.
resetDemoLimits();
check(demoLimits().livePerHour === 3 && demoLimits().liveMaxSeconds === 180, "Live voice defaults: 3 sessions per visitor per hour, 3 minutes each");
for (let i = 0; i < 3; i++) assert.equal(takeDemoAllowance(req("5.5.5.5"), "live", t0), null);
const lv = takeDemoAllowance(req("5.5.5.5"), "live", t0);
check(lv?.scope === "visitor" && /Live voice/.test(lv.message) && /\/setup/.test(lv.message), "4th Live session in an hour is refused, with a pointer to /setup");
check(takeDemoAllowance(req("5.5.5.5"), "voice", t0) === null, "tap-to-talk voice still works after Live sessions run out");
process.env.DEMO_LIVE_MAX_SECONDS = "90";
check(demoLimits().liveMaxSeconds === 90, "session length is configurable with DEMO_LIVE_MAX_SECONDS");
delete process.env.DEMO_LIVE_MAX_SECONDS;

console.log(`\n${n} demo-limit checks passed`);
