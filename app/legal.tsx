import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared shell for the privacy and terms pages. Plain, readable, and light
 * enough that the App Store review can open it on any connection.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-14">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-sm text-white/50 hover:text-white transition-colors"
        >
          ← zuno
        </Link>

        <h1 className="mt-8 text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-white/40">Last updated {updated}</p>

        <div className="mt-10 space-y-5 text-[15px] leading-relaxed text-white/75 [&_a]:text-[#2d6cf6] [&_a:hover]:underline [&_strong]:text-white [&_strong]:font-semibold">
          {children}
        </div>
      </div>
    </main>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="pt-5">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}
