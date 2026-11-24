import type { ReactNode } from "react";
import { ArrowUpRight, Brain, Search } from "lucide";
import { Icon, type IconNode } from "@/components/ui/Icon";
import type { IntegrationId } from "@/lib/setup/status";

/**
 * Content for the /setup page: one entry per integration a person can switch on with their own
 * keys. Text only lives here so the guide can be edited without touching the page logic.
 *
 * Accuracy rules: claim only what the code does (see the file named in each `source` comment),
 * say what happens *without* the key, and keep cost notes general (providers change pricing).
 */

export type { IntegrationId };

/** What the page knows when it renders steps (origin of this tab, redirect URI the server will use). */
export interface GuideContext {
  origin: string;
  expectedRedirect: string;
  serverRedirect: string;
}

export interface Step {
  body: ReactNode;
  /** A value to copy (env lines, a URL). Rendered in a code block with a Copy button. */
  code?: string;
}

export interface Integration {
  id: IntegrationId;
  name: string;
  /** One line: what it is. */
  tagline: string;
  required?: boolean;
  /** Brand mark slug in BRAND_ICONS, or a Lucide icon when the brand isn't in the set. */
  brand?: string;
  icon?: IconNode;
  unlocks: string[];
  without: string;
  cost: string;
  time: string;
  steps(ctx: GuideContext): Step[];
  /** The steps already end with their own restart/connect instruction (otherwise the page adds one). */
  restartInSteps?: boolean;
  /** Something to say or type to Polty to check it works. */
  tryIt: string;
}

export function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-mint underline-offset-2 hover:underline">
      {children}
      <Icon icon={ArrowUpRight} size={12} />
    </a>
  );
}

function B({ children }: { children: ReactNode }) {
  return <b className="font-medium text-fg">{children}</b>;
}

function C({ children }: { children: ReactNode }) {
  return <code className="rounded bg-tint px-1 py-0.5 font-mono text-caption text-fg">{children}</code>;
}

export const INTEGRATIONS: Integration[] = [
  {
    // source: src/lib/agent/claude.ts, src/app/api/agent/route.ts
    id: "anthropic",
    name: "Claude (Anthropic)",
    tagline: "Polty's brain. Every reply and every tool call goes through Claude.",
    required: true,
    icon: Brain,
    unlocks: [
      "Talk to Polty by typing (and by voice in Chrome)",
      "Live Caltrans traffic cameras, with in-browser truck and car tracking",
      "NOAA tide stations, weather, news, Wikipedia, BART, flights overhead, earthquakes and crypto prices",
      "Timers and widgets on the canvas",
    ],
    without: "Polty can't reply at all.",
    cost: "Pay as you go. The Fast brain (Haiku) is cheap; the Deep brain (Opus) costs more per message. Set a monthly limit.",
    time: "About 2 minutes",
    steps: () => [
      {
        body: (
          <>
            Sign in to the <A href="https://console.anthropic.com/settings/keys">Anthropic Console</A> and open <B>API keys</B>.
          </>
        ),
      },
      {
        body: (
          <>
            Click <B>Create key</B>, name it something like <C>polty-local</C>, and copy it. It is shown only once.
          </>
        ),
      },
      {
        body: (
          <>
            Recommended: under <A href="https://console.anthropic.com/settings/limits">Limits</A>, set a monthly spend limit so a runaway
            conversation can’t surprise you.
          </>
        ),
      },
      { body: <>Add this line to <C>.env.local</C>:</>, code: "ANTHROPIC_API_KEY=sk-ant-..." },
    ],
    tryIt: "What's the tide in San Francisco right now?",
  },
  {
    // source: src/lib/ghost/server/google/oauth.ts (scopes), src/lib/ghost/server/adapters/services/google.ts
    id: "google",
    name: "Google Workspace",
    tagline: "Your Gmail, Calendar, Drive and Contacts, through your own Google OAuth app.",
    brand: "google",
    unlocks: [
      "Search and read your email (read-only)",
      "See your calendar and create events",
      "Search your Drive files (read-only)",
      "Look up your contacts (read-only)",
    ],
    without: "Polty has no access to your Google account.",
    cost: "Free.",
    time: "About 10 minutes, once",
    restartInSteps: true,
    steps: (ctx) => {
      const mismatch = ctx.expectedRedirect !== ctx.serverRedirect;
      const env = [
        "GOOGLE_CLIENT_ID=....apps.googleusercontent.com",
        "GOOGLE_CLIENT_SECRET=...",
        ...(mismatch ? [`NEXT_PUBLIC_PUBLIC_ORIGIN=${ctx.origin}`] : []),
      ].join("\n");
      return [
        {
          body: (
            <>
              Open the <A href="https://console.cloud.google.com/projectcreate">Google Cloud console</A> and create a project (any name, e.g.{" "}
              <C>polty</C>).
            </>
          ),
        },
        {
          body: (
            <>
              In <A href="https://console.cloud.google.com/apis/library">APIs &amp; Services → Library</A>, enable <B>Gmail API</B>,{" "}
              <B>Google Calendar API</B>, <B>Google Drive API</B> and <B>People API</B>.
            </>
          ),
        },
        {
          body: (
            <>
              Open <A href="https://console.cloud.google.com/auth/overview">Google Auth Platform</A> (formerly “OAuth consent screen”). Choose{" "}
              <B>External</B>, give the app a name and your email, then under <B>Audience → Test users</B> add the Google account you’ll sign in
              with.
            </>
          ),
        },
        {
          body: (
            <>
              Go to <A href="https://console.cloud.google.com/auth/clients">Clients</A> → <B>Create client</B> → type <B>Web application</B>. Under{" "}
              <B>Authorized redirect URIs</B>, add exactly:
            </>
          ),
          code: ctx.expectedRedirect,
        },
        {
          body: (
            <>
              Copy the <B>Client ID</B> and <B>Client secret</B> into <C>.env.local</C>
              {mismatch ? (
                <>
                  . The last line tells the server it runs at <C>{ctx.origin}</C>, so Google sends you back here and not to port 3000
                </>
              ) : null}
              :
            </>
          ),
          code: env,
        },
        {
          body: (
            <>
              Restart the server, press <B>Re-check</B>, then <B>Connect Google</B> on this card. Google will warn that the app isn’t verified:
              that’s expected for your own app in testing, so choose <B>Continue</B>. You’ll land on the Connectors page; come back here to see it
              ticked.
            </>
          ),
        },
      ];
    },
    tryIt: "What's on my calendar tomorrow?",
  },
  {
    // source: src/lib/ghost/server/partners/exa.ts, src/lib/ghost/server/adapters/services/youtube.ts (fallback)
    id: "exa",
    name: "Exa web search",
    tagline: "Lets Polty search the web and read pages.",
    icon: Search,
    unlocks: [
      "Search the web and read pages for you",
      "Find public webcams for a place that isn't in the camera catalog",
      "Video search, if you skip the YouTube key",
    ],
    without: "Polty can't search the web or read pages.",
    cost: "Free starter credits, then pay per search. See exa.ai/pricing.",
    time: "About 2 minutes",
    steps: () => [
      {
        body: (
          <>
            Sign up at <A href="https://dashboard.exa.ai">dashboard.exa.ai</A> and open <B>API Keys</B>.
          </>
        ),
      },
      { body: <>Copy your key (or create a new one) and add it to <C>.env.local</C>:</>, code: "EXA_API_KEY=..." },
    ],
    tryIt: "Search the web for today's top AI news and give me the headlines.",
  },
  {
    // source: src/app/api/tts, src/app/api/stt*, src/app/api/convai, src/lib/voice/listener.ts
    id: "elevenlabs",
    name: "ElevenLabs voice",
    tagline: "Polty's natural voice, and speech recognition that works in any browser.",
    brand: "elevenlabs",
    unlocks: [
      "Polty speaks with a natural voice",
      "Voice input in any browser, with live captions",
      "Hands-free live voice conversation",
    ],
    without: "Polty uses your browser's built-in voice, and voice input only works in Google Chrome. Typing always works.",
    cost: "Free tier with a monthly character allowance; paid plans for more.",
    time: "About 3 minutes",
    steps: () => [
      {
        body: (
          <>
            Sign up at <A href="https://elevenlabs.io/app/settings/api-keys">ElevenLabs</A> and open <B>Developers → API Keys</B>.
          </>
        ),
      },
      {
        body: (
          <>
            Create a key. If you restrict its permissions, allow <B>Text to Speech</B>, <B>Speech to Text</B> and <B>Agents</B>.
          </>
        ),
      },
      { body: <>Add it to <C>.env.local</C>:</>, code: "ELEVENLABS_API_KEY=..." },
      {
        body: (
          <>
            Optional: pick a voice in the ElevenLabs <B>Voices</B> library, copy its ID and add <C>ELEVENLABS_VOICE_ID=...</C>.
          </>
        ),
      },
    ],
    tryIt: "Hold Space (or click Polty) and say “Hi Polty, what can you do?”",
  },
  {
    // source: src/lib/ghost/server/adapters/services/youtube.ts
    id: "youtube",
    name: "YouTube",
    tagline: "Video search and playback on the canvas.",
    brand: "youtube",
    unlocks: ["Search YouTube and play videos on the canvas"],
    without: "Video search falls back to Exa if you've added it; otherwise it's unavailable.",
    cost: "Free daily quota.",
    time: "About 3 minutes",
    steps: () => [
      {
        body: (
          <>
            In the <A href="https://console.cloud.google.com/apis/library/youtube.googleapis.com">Google Cloud console</A>, enable{" "}
            <B>YouTube Data API v3</B> (the same project as Google Workspace is fine).
          </>
        ),
      },
      {
        body: (
          <>
            Go to <A href="https://console.cloud.google.com/apis/credentials">Credentials</A> → <B>Create credentials</B> → <B>API key</B>.
            Recommended: restrict the key to YouTube Data API v3.
          </>
        ),
      },
      { body: <>Add it to <C>.env.local</C>:</>, code: "YOUTUBE_API_KEY=..." },
    ],
    tryIt: "Find a YouTube video that explains how tides work.",
  },
];
