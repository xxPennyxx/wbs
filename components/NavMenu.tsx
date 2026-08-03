"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Top-level application menus.
const MENUS = [
  { label: "Work Breakdown Structure", href: "/" },
  { label: "Project Budget Analysis", href: "/budget" },
];

/** Is `href` the active section for the current path? */
function isActive(href: string, pathname: string): boolean {
  if (href === "/") {
    // WBS covers the projects list and the per-project WBS/Gantt pages,
    // but NOT the budget section.
    return pathname === "/" || pathname.startsWith("/project");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function NavMenu() {
  const pathname = usePathname() || "/";
  return (
    <nav className="flex items-center gap-1">
      {MENUS.map((m) => {
        const active = isActive(m.href, pathname);
        return (
          <Link
            key={m.href}
            href={m.href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-teal-50 text-brand ring-1 ring-inset ring-teal-100"
                : "text-slate-600 hover:bg-slate-100 hover:text-brand"
            }`}
          >
            {m.label}
          </Link>
        );
      })}
    </nav>
  );
}
