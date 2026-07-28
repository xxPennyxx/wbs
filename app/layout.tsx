import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fourth Partner Energy · WBS & Gantt",
  description: "Project work-breakdown structure and Gantt viewer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-6 py-3">
            <Link href="/" className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/FPEL.png" alt="Fourth Partner Energy" className="h-9 w-auto" />
              <span className="hidden h-8 w-px bg-slate-200 sm:block" />
              <span className="flex flex-col leading-tight">
                <span className="text-[15px] font-semibold tracking-tight text-slate-800">
                  Fourth Partner Energy Private Limited
                </span>
                <span className="text-xs text-slate-500">Project WBS &amp; Gantt</span>
              </span>
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
