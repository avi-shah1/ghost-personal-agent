"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Which integrations this server has keys for, shared by the home page intro, the top bar and
 * /setup. Mirrors GET /api/v1/setup/status (src/lib/ghost/server/routes/setup.ts): booleans only.
 */

export type IntegrationId = "anthropic" | "google" | "exa" | "elevenlabs" | "youtube";
export const INTEGRATION_IDS: IntegrationId[] = ["anthropic", "google", "exa", "elevenlabs", "youtube"];
export const SHORT_NAMES: Record<IntegrationId, string> = {
  anthropic: "Claude",
  google: "Google",
  exa: "Exa",
  elevenlabs: "ElevenLabs",
  youtube: "YouTube",
};

export interface SetupStatus {
  anthropic: { configured: boolean; via: string | null };
  google: { configured: boolean; connected: boolean; email: string | null; redirect_uri: string };
  exa: { configured: boolean };
  elevenlabs: { configured: boolean };
  youtube: { configured: boolean };
  /** Present when the server runs as a public demo on its owner's keys (POLTY_PUBLIC_DEMO=1). */
  demo?: { enabled: boolean; turns_per_hour: number };
}

export type IntegrationState = "ready" | "connect" | "required" | "missing";

export function integrationState(id: IntegrationId, s: SetupStatus | null): IntegrationState | null {
  if (!s) return null;
  if (id === "google") return s.google.configured && s.google.connected ? "ready" : s.google.configured ? "connect" : "missing";
  if (id === "anthropic") return s.anthropic.configured ? "ready" : "required";
  return s[id].configured ? "ready" : "missing";
}

export const isReady = (id: IntegrationId, s: SetupStatus | null) => integrationState(id, s) === "ready";

export interface Ability {
  label: string;
  /** Chip text on the home page. */
  short: string;
  /** Every one of these must be ready... */
  needs: IntegrationId[];
  /** ...plus at least one of these, if given. */
  oneOf?: IntegrationId[];
}

export const ABILITIES: Ability[] = [
  { label: "Chat with Polty", short: "Chat", needs: ["anthropic"] },
  { label: "Live traffic cameras with object tracking", short: "Live cameras", needs: ["anthropic"] },
  { label: "Tides, weather, news, transit, flights and more", short: "Tides, weather & news", needs: ["anthropic"] },
  { label: "Natural voice and voice input in any browser", short: "Natural voice", needs: ["anthropic", "elevenlabs"] },
  { label: "Web search and reading pages", short: "Web search", needs: ["anthropic", "exa"] },
  { label: "Gmail, Calendar, Drive and Contacts", short: "Gmail & Calendar", needs: ["anthropic", "google"] },
  { label: "YouTube video search", short: "YouTube", needs: ["anthropic"], oneOf: ["youtube", "exa"] },
];

export function abilityOn(a: Ability, s: SetupStatus | null): boolean {
  return !!s && a.needs.every((id) => isReady(id, s)) && (!a.oneOf || a.oneOf.some((id) => isReady(id, s)));
}

/** Names of what's still missing for an ability, e.g. ["Exa"] or ["YouTube or Exa"]. */
export function abilityMissing(a: Ability, s: SetupStatus | null): string[] {
  const missing = a.needs.filter((id) => !isReady(id, s)).map((id) => SHORT_NAMES[id]);
  if (a.oneOf && !a.oneOf.some((id) => isReady(id, s))) missing.push(a.oneOf.map((id) => SHORT_NAMES[id]).join(" or "));
  return missing;
}

/* One request serves every component mounted together (top bar + intro); older than 5 s refetches. */
let cached: { at: number; p: Promise<SetupStatus> } | null = null;

export function fetchSetupStatus(force = false): Promise<SetupStatus> {
  if (!force && cached && Date.now() - cached.at < 5000) return cached.p;
  const p = fetch("/api/v1/setup/status", { credentials: "include", cache: "no-store" }).then(async (r) => {
    if (!r.ok) throw new Error(`status ${r.status}`);
    return (await r.json()) as SetupStatus;
  });
  cached = { at: Date.now(), p };
  p.catch(() => {
    if (cached?.p === p) cached = null;
  });
  return p;
}

/** Status for a component; `status` is null while loading and `error` is true if the server can't be reached. */
export function useSetupStatus() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    fetchSetupStatus()
      .then((s) => live && setStatus(s))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, []);
  const refresh = useCallback(async () => {
    try {
      const s = await fetchSetupStatus(true);
      setStatus(s);
      setError(false);
      return s;
    } catch {
      setError(true);
      return null;
    }
  }, []);
  return { status, error, refresh };
}
