/**
 * Startup report of which integration keys this server process can see: names only, never values.
 * When a key was added on the host but doesn't work, the deploy logs say why: missing (not deployed
 * yet, or added somewhere else), empty, or saved under a slightly different name.
 */
const KEYS = ["ANTHROPIC_API_KEY", "ELEVENLABS_API_KEY", "EXA_API_KEY", "YOUTUBE_API_KEY", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"];
const ALSO_VALID = new Set(["ANTHROPIC_AUTH_TOKEN"]);

const letters = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, "");

export function keyReport(env: Record<string, string | undefined> = process.env): string[] {
  const state = (k: string) => (env[k] === undefined ? "missing" : env[k]!.trim() ? "set" : "EMPTY");
  const lines = [`> keys: ${KEYS.map((k) => `${k} ${state(k)}`).join(" · ")}${env.POLTY_PUBLIC_DEMO === "1" ? " · public demo ON" : ""}`];
  for (const name of Object.keys(env)) {
    if (KEYS.includes(name) || ALSO_VALID.has(name)) continue;
    // Same letters (a stray space, lower case, ELEVEN_LABS_…) or the same service with a different suffix.
    const near = KEYS.find((k) => letters(name) === letters(k) || (letters(name).startsWith(letters(k.replace(/_(API_KEY|CLIENT_ID|CLIENT_SECRET)$/, ""))) && /KEY|SECRET/i.test(name)));
    if (near) lines.push(`> warning: found a variable named ${JSON.stringify(name)} — did you mean ${near}? The app only reads the exact name.`);
  }
  return lines;
}
