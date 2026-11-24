"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { ArrowRight, CalendarDays, Cctv, Check, KeyRound, Lock, Newspaper, WavesHorizontal } from "lucide";
import { useGhost } from "@/lib/store";
import { sendToPolty } from "@/lib/agent/runtime";
import { speaker } from "@/lib/voice/speaker";
import { ABILITIES, abilityMissing, abilityOn, isReady, useSetupStatus, type IntegrationId, type SetupStatus } from "@/lib/setup/status";
import { Illustration } from "@/components/ui/Illustration";
import { Icon, type IconNode } from "@/components/ui/Icon";
import { duration, ease, haptic } from "@/components/ui/motion";
import type { IllustrationName } from "@/components/ui/illustrations";

/** Starter prompts, in order of preference; only ones whose integrations are ready are offered. */
const SUGGESTIONS: { label: string; prompt: string; art: IllustrationName; icon: IconNode; needs: IntegrationId[] }[] = [
  { label: "What does my day look like?", prompt: "What does my day look like?", art: "calendar", icon: CalendarDays, needs: ["anthropic", "google"] },
  { label: "Show me the Bay Bridge, live", prompt: "Find a live camera on the Bay Bridge and show it to me", art: "bridge", icon: Cctv, needs: ["anthropic"] },
  { label: "What's new in AI today?", prompt: "Search the web for today's top AI news and give me the headlines", art: "news", icon: Newspaper, needs: ["anthropic", "exa"] },
  { label: "How high is the tide in SF?", prompt: "How high is the tide in San Francisco right now?", art: "wave", icon: WavesHorizontal, needs: ["anthropic"] },
];

/** What Polty says first, depending on how far setup has got. */
function copyFor(status: SetupStatus | null, error: boolean, locked: number) {
  if (error || !status) return { headline: "Hey, how are you doing today?", sub: "What are you looking for today?" };
  if (!status.anthropic.configured)
    return { headline: "I need a brain first.", sub: "Add a Claude API key and I can start talking. It takes about two minutes." };
  if (locked === 0) return { headline: "Everything’s switched on.", sub: "What are you looking for today?" };
  return { headline: "Here’s what I can do so far.", sub: "Ask me anything below. Want more? Follow the setup guide to unlock the rest." };
}

/**
 * Empty-canvas welcome. Polty floats into the reserved slot at the top (PoltyStage measures
 * `data-polty-anchor`), then says what it can do with the keys this server has, offers a clear
 * way into /setup for the rest, and suggests prompts that will actually work.
 * The section ends where the voice dock begins (`--dock-h`), so the two can never overlap.
 */
export function Hero() {
  const show = useGhost((s) => s.widgets.length === 0 && s.ui.length === 0);
  const { status, error } = useSetupStatus();
  const settled = !!status || error;
  const locked = status ? ABILITIES.filter((a) => !abilityOn(a, status)).length : 0;
  const { headline, sub } = copyFor(status, error, locked);
  const brain = !!status?.anthropic.configured;
  const suggestions = SUGGESTIONS.filter((s) => (status ? s.needs.every((id) => isReady(id, status)) : error && s.needs.length === 1)).slice(0, 2);
  const cta = !status ? null : !brain ? "Set me up · 2 minutes" : locked > 0 ? `Unlock ${locked} more` : null;

  return (
    <AnimatePresence>
      {show && (
        <motion.section
          key="hero"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{
            opacity: 0,
            y: -16,
            filter: "blur(8px)",
            transition: { duration: duration.base, ease: ease.standard },
          }}
          className="pointer-events-none fixed inset-x-0 top-0 z-20 flex flex-col items-center justify-center px-5 pb-4 pt-[max(64px,calc(env(safe-area-inset-top)+56px))] text-center"
          style={{ bottom: "var(--dock-h)" }}
        >
          {/* soft mist so the type reads over the footage */}
          <div
            aria-hidden
            className="absolute left-1/2 top-1/2 -z-10 h-[80%] w-[min(980px,140vw)] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(closest-side,rgb(248_247_243/0.8),rgb(248_247_243/0.5)_50%,rgb(248_247_243/0)_100%)] blur-2xl"
          />

          {/* Polty lands here */}
          <div data-polty-anchor aria-hidden className="mb-3 aspect-[240/260] h-[clamp(72px,16vh,160px)] shrink-0 sm:mb-5" />

          {settled ? (
            <h1 key={headline} className="max-w-[16ch] text-balance font-display text-display text-fg sm:max-w-none" aria-label={headline}>
              {headline.split(" ").map((w, i) => (
                <motion.span
                  key={i}
                  aria-hidden
                  className="inline-block whitespace-pre"
                  initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ delay: 0.15 + i * 0.07, duration: duration.celebratory, ease: ease.standard }}
                >
                  {i ? ` ${w}` : w}
                </motion.span>
              ))}
            </h1>
          ) : (
            // Holds the line while the status check runs (usually a few milliseconds locally).
            <div aria-hidden className="h-[1.04em] text-display" />
          )}

          {settled && (
            <motion.p
              key={sub}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: duration.deliberate, ease: ease.standard }}
              className="mt-3 max-w-[46ch] text-balance text-body-lg text-fg-2 sm:mt-4 sm:text-[1.0625rem]"
            >
              {sub}
            </motion.p>
          )}

          {status?.demo?.enabled && brain && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: duration.deliberate }}
              className="mt-2 text-caption text-fg-3"
            >
              Public demo: Fast brain only, limited requests per visitor each hour.
            </motion.p>
          )}

          {status && (
            <motion.ul
              aria-label="What Polty can do"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.04, delayChildren: 0.65 } } }}
              className="mt-5 flex max-w-[640px] flex-wrap justify-center gap-1.5 sm:mt-6"
            >
              {ABILITIES.map((a) => {
                const on = abilityOn(a, status);
                const need = abilityMissing(a, status).join(", ");
                return (
                  <motion.li
                    key={a.label}
                    title={on ? a.label : `${a.label}: needs ${need}`}
                    variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.standard } } }}
                    className={clsx(
                      "inline-flex h-8 items-center gap-1.5 rounded-full pl-1.5 pr-3 text-caption font-medium",
                      on ? "ghost-chip text-fg" : "border border-dashed border-line-strong bg-white/30 text-fg-3",
                    )}
                  >
                    <span className={clsx("grid h-5 w-5 place-items-center rounded-full", on ? "bg-mint/15 text-mint" : "bg-tint text-fg-3")}>
                      <Icon icon={on ? Check : Lock} size={11} strokeWidth={2.6} />
                    </span>
                    {a.short}
                    <span className="sr-only">{on ? " (ready)" : ` (locked: needs ${need})`}</span>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}

          {cta && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.95, duration: duration.deliberate, ease: ease.standard }}
              className="pointer-events-auto mt-6 sm:mt-7"
            >
              <Link
                href="/setup"
                onClick={() => haptic()}
                className={clsx(
                  "group inline-flex h-12 items-center gap-2.5 rounded-full pl-2 pr-5 text-body font-medium shadow-pop transition-[transform,background-color] duration-200 ease-standard hover:-translate-y-0.5 active:scale-[0.97]",
                  brain ? "bg-fg text-fg-inverse" : "bg-mint text-fg-inverse",
                )}
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15">
                  <Icon icon={KeyRound} size={16} />
                </span>
                {cta}
                <span className="transition-transform duration-200 ease-standard group-hover:translate-x-0.5">
                  <Icon icon={ArrowRight} size={16} />
                </span>
              </Link>
              <p className="mt-2 text-caption text-fg-3">Step-by-step guide · your own keys, stored on your machine</p>
            </motion.div>
          )}

          {suggestions.length > 0 && (
            <motion.ul
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.06, delayChildren: 1.1 } } }}
              className="pointer-events-auto mt-5 flex w-full max-w-[560px] flex-col items-stretch gap-2 sm:mt-6 sm:flex-row sm:justify-center [@media(max-height:700px)]:hidden"
            >
              {suggestions.map((s, i) => (
                <motion.li
                  key={s.label}
                  className={i > 0 ? "max-sm:hidden" : undefined}
                  variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: duration.deliberate, ease: ease.standard } } }}
                >
                  <button
                    onClick={() => {
                      haptic();
                      speaker?.unlock();
                      void sendToPolty(s.prompt);
                    }}
                    className="ghost-chip group flex h-12 w-full items-center gap-2.5 rounded-full pl-1.5 pr-5 text-left text-body-sm font-medium text-fg transition-[transform,background-color,box-shadow] duration-200 ease-standard hover:-translate-y-0.5 hover:bg-white/85 active:scale-[0.97] active:duration-100 sm:w-auto"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-white/70 transition-transform duration-300 ease-standard group-hover:rotate-[-6deg] group-hover:scale-110">
                      <Illustration name={s.art} size={30} fallback={s.icon} priority />
                    </span>
                    <span className="truncate">{s.label}</span>
                  </button>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </motion.section>
      )}
    </AnimatePresence>
  );
}
