"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { Check, ChevronDown, Copy, Info, Lock, RefreshCw, ShieldCheck, TriangleAlert } from "lucide";
import { BRAND_ICONS } from "@/lib/connectors/brand-icons";
import { Icon } from "@/components/ui/Icon";
import { duration, ease, haptic } from "@/components/ui/motion";
import {
  ABILITIES,
  abilityMissing,
  abilityOn,
  fetchSetupStatus,
  integrationState as stateOf,
  type IntegrationId,
  type IntegrationState as CardState,
  type SetupStatus,
} from "@/lib/setup/status";
import { A, INTEGRATIONS, type GuideContext, type Integration, type Step } from "./integrations";

const REPO_URL = "https://github.com/avi-shah1/ghost-personal-agent";
const fetchStatus = (force = false) => fetchSetupStatus(force);

const noopSubscribe = () => () => {};
/** This tab's origin, without a hydration mismatch (empty during server render). */
function useOrigin(): string {
  return useSyncExternalStore(noopSubscribe, () => window.location.origin, () => "");
}

export default function SetupGuide() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [open, setOpen] = useState<Set<IntegrationId>>(() => new Set());
  const origin = useOrigin();

  // First load: fetch status, then open the card the URL points at (#google) or Claude if it's missing.
  useEffect(() => {
    let live = true;
    fetchStatus()
      .then((s) => {
        if (!live) return;
        setStatus(s);
        const hash = window.location.hash.slice(1) as IntegrationId;
        const first = new Set<IntegrationId>();
        if (INTEGRATIONS.some((i) => i.id === hash)) first.add(hash);
        if (!s.anthropic.configured) first.add("anthropic");
        if (first.size) setOpen(first);
      })
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, []);

  const recheck = useCallback(async () => {
    haptic();
    setChecking(true);
    try {
      setStatus(await fetchStatus(true));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setChecking(false);
    }
  }, []);

  const toggle = (id: IntegrationId) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const serverRedirect = status?.google.redirect_uri ?? "";
  const expectedRedirect = origin ? `${origin}/api/v1/google/callback` : serverRedirect;
  const ctx: GuideContext = { origin, expectedRedirect, serverRedirect: serverRedirect || expectedRedirect };
  const hosted = !!origin && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(origin).hostname);
  const readyCount = INTEGRATIONS.filter((i) => stateOf(i.id, status) === "ready").length;

  return (
    <div className="space-y-4">
      <section className="ghost-glass rounded-card px-4 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="text-label font-medium uppercase text-fg-3">Setup</p>
            <h1 className="mt-1 font-display text-title">Bring Polty to life with your own keys</h1>
            <p className="mt-2 text-body-sm text-fg-2">
              Polty runs on your machine with your own accounts. Start with Claude, then add the rest whenever you like. Each card says what it
              unlocks, what it costs, and exactly how to set it up.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-caption text-fg-3" aria-live="polite">
              {status ? `${readyCount} of ${INTEGRATIONS.length} ready` : error ? "Status unavailable" : "Checking…"}
            </span>
            <button
              type="button"
              onClick={recheck}
              disabled={checking}
              className="ghost-chip inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-caption font-medium text-fg-2 transition-colors hover:text-fg disabled:opacity-60"
            >
              <Icon icon={RefreshCw} size={14} className={checking ? "animate-spin" : undefined} />
              Re-check
            </button>
          </div>
        </div>

        {hosted && (
          <Notice tone="info">
            You’re viewing a hosted copy, so it uses whatever keys its owner added. To use your own accounts, run Polty on your computer: follow{" "}
            <b className="font-medium text-fg">Before you start</b> below, or see the <A href={REPO_URL}>GitHub repo</A>.
          </Notice>
        )}
        {error && (
          <Notice tone="warn">
            Couldn’t reach the server’s status check. Make sure the server is running, then press Re-check.
          </Notice>
        )}

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="min-w-0 rounded-tile bg-tint/70 p-4">
            <h2 className="font-serif text-heading">What Polty can do right now</h2>
            <ul className="mt-3 space-y-2">
              {ABILITIES.map((a) => {
                const on = abilityOn(a, status);
                const need = abilityMissing(a, status);
                return (
                  <li key={a.label} className="flex items-start gap-2.5 text-body-sm">
                    <span
                      className={clsx(
                        "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full",
                        on ? "bg-mint/15 text-mint" : "bg-tint text-fg-3",
                      )}
                    >
                      <Icon icon={on ? Check : Lock} size={10} strokeWidth={2.6} />
                    </span>
                    <span className={on ? "text-fg" : "text-fg-3"}>
                      {a.label}
                      {status && !on && <span className="text-caption"> · needs {need.join(", ")}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="min-w-0 rounded-tile bg-tint/70 p-4">
            <h2 className="font-serif text-heading">Before you start</h2>
            <ol className="mt-3 space-y-3">
              <StepItem n={1} step={{ body: <>Get the code and install it (needs Node 20+ and pnpm):</>, code: `git clone -b polty-hackathon ${REPO_URL}\ncd ghost-personal-agent\npnpm install` }} />
              <StepItem
                n={2}
                step={{
                  body: <>Create your private key file in the project folder. Git ignores it, so keys are never committed:</>,
                  code: "# macOS / Linux\ncp .env.example .env.local\n# Windows PowerShell\nCopy-Item .env.example .env.local",
                }}
              />
              <StepItem n={3} step={{ body: <>Start Polty, then open the address it prints and come back to this page:</>, code: "pnpm dev" }} />
            </ol>
          </div>
        </div>
      </section>

      {INTEGRATIONS.map((i) => (
        <IntegrationCard
          key={i.id}
          i={i}
          state={stateOf(i.id, status)}
          status={status}
          ctx={ctx}
          open={open.has(i.id)}
          onToggle={() => toggle(i.id)}
        />
      ))}

      <section className="ghost-glass flex items-start gap-3 rounded-card px-4 py-4 text-body-sm text-fg-2 sm:px-6">
        <Icon icon={ShieldCheck} size={18} className="mt-0.5 shrink-0 text-mint" />
        <p>
          Keys stay in <code className="font-mono text-caption">.env.local</code> on your computer and are never shown on this page; the status
          check only reports whether each one exists. “Key added” means the server found it. To confirm a provider accepted it, try the prompt on
          its card.
        </p>
      </section>
    </div>
  );
}

const PILL: Record<CardState, string> = {
  ready: "bg-mint/12 text-mint",
  connect: "bg-amber/12 text-amber",
  required: "bg-coral/10 text-coral",
  missing: "bg-tint text-fg-3",
};

function pillLabel(id: IntegrationId, s: CardState): string {
  if (s === "ready") return id === "google" ? "Connected" : "Key added";
  if (s === "connect") return "Connect account";
  if (s === "required") return "Required";
  return "Not set up";
}

function IntegrationCard({
  i,
  state,
  status,
  ctx,
  open,
  onToggle,
}: {
  i: Integration;
  state: CardState | null;
  status: SetupStatus | null;
  ctx: GuideContext;
  open: boolean;
  onToggle(): void;
}) {
  const steps: Step[] = i.steps(ctx);
  if (!i.restartInSteps)
    steps.push({
      body: (
        <>
          Restart the server so it reads the key: press <b className="font-medium text-fg">Ctrl+C</b> in its terminal, run it again, then press{" "}
          <b className="font-medium text-fg">Re-check</b> at the top.
        </>
      ),
      code: "pnpm dev",
    });
  const google = i.id === "google" ? status?.google : undefined;
  const redirectMismatch = !!google && !!ctx.origin && ctx.expectedRedirect !== ctx.serverRedirect && state !== "ready";
  const panelId = `guide-${i.id}`;

  return (
    <section id={i.id} className="ghost-glass scroll-mt-6 rounded-card px-4 py-5 sm:px-6">
      <div className="flex items-start gap-3">
        <Mark i={i} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="font-serif text-heading">{i.name}</h2>
            {i.required && <span className="rounded-full bg-fg px-2 py-0.5 text-micro font-medium uppercase text-fg-inverse">Start here</span>}
          </div>
          <p className="mt-0.5 text-body-sm text-fg-2">{i.tagline}</p>
        </div>
        {state ? (
          <span className={clsx("shrink-0 rounded-full px-2.5 py-1 text-caption font-medium", PILL[state])}>{pillLabel(i.id, state)}</span>
        ) : (
          <span className="h-6 w-20 shrink-0 animate-pulse rounded-full bg-tint" aria-label="Checking" />
        )}
      </div>

      <div className="mt-4 grid gap-4 text-body-sm sm:grid-cols-2">
        <div>
          <p className="text-label font-medium uppercase text-fg-3">Unlocks</p>
          <ul className="mt-1.5 space-y-1 text-fg">
            {i.unlocks.map((u) => (
              <li key={u} className="flex gap-2">
                <span aria-hidden className="mt-[0.45em] h-1 w-1 shrink-0 rounded-full bg-fg-3" />
                {u}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2.5">
          <div>
            <p className="text-label font-medium uppercase text-fg-3">Without it</p>
            <p className="mt-1 text-fg-2">{i.without}</p>
          </div>
          <div>
            <p className="text-label font-medium uppercase text-fg-3">Cost</p>
            <p className="mt-1 text-fg-2">{i.cost}</p>
          </div>
        </div>
      </div>

      {google?.connected && google.email && <p className="mt-4 text-body-sm text-fg-2">Signed in as {google.email}.</p>}
      {redirectMismatch && (
        <Notice tone="warn">
          This page is at <code className="font-mono text-caption">{ctx.origin}</code>, but the server will send Google sign-in back to{" "}
          <code className="break-all font-mono text-caption">{ctx.serverRedirect}</code>. Step 5 includes the line that fixes this.
        </Notice>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-fg px-4 text-body-sm font-medium text-fg-inverse shadow-pop transition-transform active:scale-[0.97]"
        >
          {state === "ready" ? "Setup guide" : "Set it up"}
          <span className="text-fg-inverse/70">· {i.time}</span>
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: duration.fast, ease: ease.standard }} className="grid place-items-center">
            <Icon icon={ChevronDown} size={15} />
          </motion.span>
        </button>
        {google && state === "connect" && (
          <a
            href="/api/v1/google/connect"
            className="inline-flex h-10 items-center rounded-full bg-mint px-4 text-body-sm font-medium text-fg-inverse shadow-pop transition-transform active:scale-[0.97]"
          >
            Connect Google
          </a>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            key="guide"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: duration.base, ease: ease.standard }}
            className="overflow-hidden"
          >
            <ol className="mt-5 space-y-3.5">
              {steps.map((s, n) => (
                <StepItem key={n} n={n + 1} step={s} />
              ))}
            </ol>
            <div className="mt-5 rounded-tile bg-mint/10 px-4 py-3 text-body-sm">
              <p className="text-label font-medium uppercase text-mint">Try it</p>
              <p className="mt-1 font-serif text-fg">“{i.tryIt}”</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function StepItem({ n, step }: { n: number; step: Step }) {
  return (
    <li className="flex gap-3 text-body-sm text-fg-2">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/80 text-micro font-semibold text-fg shadow-card">{n}</span>
      <div className="min-w-0 flex-1">
        {step.body}
        {step.code && <CodeBlock code={step.code} />}
      </div>
    </li>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      haptic();
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked: the text is still selectable */
    }
  };
  return (
    <div className="mt-1.5 flex items-start gap-2 rounded-lg bg-white/70 py-1.5 pl-3 pr-1.5 shadow-card">
      <pre className="min-w-0 flex-1 select-all overflow-x-auto whitespace-pre py-0.5 font-mono text-caption text-fg">{code}</pre>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy"}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-fg-3 transition-colors hover:bg-tint hover:text-fg"
      >
        <Icon icon={copied ? Check : Copy} size={14} spring="snappy" className={copied ? "text-mint" : undefined} />
      </button>
    </div>
  );
}

function Notice({ tone, children }: { tone: "info" | "warn"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "warn" ? "alert" : "note"}
      className={clsx(
        "mt-4 flex items-start gap-2.5 rounded-tile px-3.5 py-3 text-body-sm",
        tone === "warn" ? "bg-amber/10 text-fg" : "bg-tint text-fg-2",
      )}
    >
      <Icon icon={tone === "warn" ? TriangleAlert : Info} size={16} className={clsx("mt-0.5 shrink-0", tone === "warn" ? "text-amber" : "text-fg-3")} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Mark({ i }: { i: Integration }) {
  const b = i.brand ? BRAND_ICONS[i.brand] : undefined;
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-tile bg-white/85 shadow-card" aria-hidden>
      {b ? (
        <svg viewBox="0 0 24 24" width={20} height={20} fill={`#${b.hex}`}>
          <path d={b.path} />
        </svg>
      ) : i.icon ? (
        <Icon icon={i.icon} size={20} className="text-fg" />
      ) : null}
    </span>
  );
}
