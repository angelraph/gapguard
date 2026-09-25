"use client";

import { useEffect } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

/** Shown if something unexpected breaks while a page is running. The rest of
 * the site keeps working, and one click retries. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("GapGuard page error:", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col text-text-primary">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 pb-24 sm:px-10">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">
          This page hit a snag, <span className="text-gradient">not your wallet.</span>
        </h1>
        <p className="mt-4 max-w-lg text-text-secondary">
          Nothing was sent or spent. This is usually a brief hiccup fetching live data, and trying again fixes it.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button onClick={reset} className="btn-primary">
            Try again
          </button>
          <Link href="/" className="btn-ghost">
            Back to the radar
          </Link>
        </div>
      </main>
    </div>
  );
}
