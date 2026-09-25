import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col text-text-primary">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 pb-24 sm:px-10">
        <p className="eyebrow">Page not found</p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">
          That page isn&apos;t on the <span className="text-gradient">radar</span>.
        </h1>
        <p className="mt-4 max-w-lg text-text-secondary">
          The link may be old or mistyped. Everything GapGuard does is a click away from the home page.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="btn-primary">
            Back to the radar
          </Link>
          <Link href="/protect" className="btn-ghost">
            Gap Insurance
          </Link>
        </div>
      </main>
    </div>
  );
}
