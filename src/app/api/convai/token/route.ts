import { conversationToken } from "@/lib/agent/convai-agent";
import { demoLimits, demoMode, limitResponse, takeDemoAllowance } from "@/lib/demo/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST -> {token, max_seconds}: WebRTC conversation token for the hosted Polty agent (key stays
 * server-side). On the public demo each token is one Live session, counted against the visitor's
 * hourly allowance, and `max_seconds` tells the browser when to end it.
 */
export async function POST(req: Request) {
  if (!process.env.ELEVENLABS_API_KEY) return Response.json({ error: "ElevenLabs not configured" }, { status: 503 });
  const hit = takeDemoAllowance(req, "live");
  if (hit) return limitResponse(hit);
  try {
    return Response.json(
      { token: await conversationToken(), max_seconds: demoMode() ? demoLimits().liveMaxSeconds : null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
