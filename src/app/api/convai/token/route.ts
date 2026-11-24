import { conversationToken } from "@/lib/agent/convai-agent";
import { limitResponse, takeDemoAllowance } from "@/lib/demo/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST -> {token}: WebRTC conversation token for the hosted Polty agent (key stays server-side). */
export async function POST(req: Request) {
  if (!process.env.ELEVENLABS_API_KEY) return Response.json({ error: "ElevenLabs not configured" }, { status: 503 });
  const hit = takeDemoAllowance(req, "voice");
  if (hit) return limitResponse(hit);
  try {
    return Response.json({ token: await conversationToken() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
