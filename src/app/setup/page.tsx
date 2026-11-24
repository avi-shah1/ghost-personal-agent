import type { Metadata } from "next";
import Link from "next/link";
import SetupGuide from "@/components/setup/SetupGuide";

export const metadata: Metadata = {
  title: "Setup · GHOST",
  description: "Switch on Polty's integrations with your own keys: Claude, Google Workspace, Exa, ElevenLabs and YouTube.",
};

export default function SetupPage() {
  return (
    <main className="min-h-dvh px-4 pb-16 pt-[max(24px,env(safe-area-inset-top))] sm:px-8 sm:pt-10">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="ghost-chip mb-4 inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-caption font-medium text-fg-2 transition-colors hover:text-fg"
        >
          <span aria-hidden>←</span> Back to Polty
        </Link>
        <SetupGuide />
      </div>
    </main>
  );
}
