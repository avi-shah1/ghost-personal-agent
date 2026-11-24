import type { Hono } from "hono";
import { getPrincipalOptional } from "../auth";
import { getTokens, googleConfigured, redirectUri } from "../google/oauth";
import { env } from "../partners/common";

/**
 * GET /api/v1/setup/status — which integrations this server has keys for, for the /setup page.
 *
 * Only booleans (plus the Google redirect URI, which is not a secret and the guide needs it).
 * Key values never leave the server. "configured" means the variable is present, not that the
 * provider accepted it: the guide says so and gives each integration a prompt to try.
 */
export function mountSetupRoutes(app: Hono) {
  app.get("/setup/status", async (c) => {
    const direct = !!(env("ANTHROPIC_API_KEY") || env("ANTHROPIC_AUTH_TOKEN"));
    const gateway = !!(
      (env("NEON_AI_GATEWAY_BASE_URL") || env("NEON_AI_GATEWAY_URL")) &&
      (env("NEON_AI_GATEWAY_TOKEN") || env("NEON_AI_GATEWAY_KEY"))
    );
    const p = await getPrincipalOptional(c);
    const tokens = p ? await getTokens(p.principal_id).catch(() => null) : null;
    return c.json({
      anthropic: { configured: direct || gateway, via: direct ? "anthropic" : gateway ? "neon-ai-gateway" : null },
      google: {
        configured: googleConfigured(),
        connected: !!tokens,
        email: tokens?.email ?? null,
        redirect_uri: redirectUri(),
      },
      exa: { configured: !!env("EXA_API_KEY") },
      elevenlabs: { configured: !!env("ELEVENLABS_API_KEY") },
      youtube: { configured: !!env("YOUTUBE_API_KEY") },
    });
  });
}
