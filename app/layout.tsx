import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "FPEL · WBS & Gantt",
  description: "Project work-breakdown structure and Gantt viewer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-brand text-white">
          <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-6 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="grid h-7 w-7 place-items-center rounded bg-white/15 text-sm">4P</span>
              Fourth Partner Energy · Project WBS
            </Link>
            <span className="ml-auto text-xs text-teal-100/80">
              Work breakdown structure &amp; Gantt
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
