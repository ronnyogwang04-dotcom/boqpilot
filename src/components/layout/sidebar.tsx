"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { dashboardNav } from "@/config/nav";
import { siteConfig } from "@/config/site";
import { NavLink } from "@/components/layout/nav-link";
import { cn } from "@/lib/utils";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  showBetaBadge?: boolean;
}

function BetaBadge() {
  return (
    <span className="rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
      Beta
    </span>
  );
}

function SidebarContent({
  onNavigate,
  isAdmin,
  showBetaBadge,
}: {
  onNavigate?: () => void;
  isAdmin: boolean;
  showBetaBadge?: boolean;
}) {
  return (
    <>
      <Link href="/dashboard" className="flex h-16 shrink-0 items-center gap-2 px-4 text-sm font-semibold tracking-tight">
        {siteConfig.name}
        {showBetaBadge && <BetaBadge />}
      </Link>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {dashboardNav
          .filter((item) => !item.adminOnly || isAdmin)
          .map((item) => (
            <NavLink key={item.href} item={item} onNavigate={onNavigate} />
          ))}
      </nav>
    </>
  );
}

export function Sidebar({ open, onClose, isAdmin, showBetaBadge }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-800 md:flex">
        <SidebarContent isAdmin={isAdmin} showBetaBadge={showBetaBadge} />
      </aside>

      {/* Mobile slide-over */}
      <div
        className={cn(
          "fixed inset-0 z-40 md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/40 transition-opacity",
            open ? "opacity-100" : "opacity-0",
          )}
          onClick={onClose}
        />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 flex w-64 flex-col bg-white transition-transform dark:bg-black",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-16 shrink-0 items-center justify-between px-4">
            <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              {siteConfig.name}
              {showBetaBadge && <BetaBadge />}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
            {dashboardNav
              .filter((item) => !item.adminOnly || isAdmin)
              .map((item) => (
                <NavLink key={item.href} item={item} onNavigate={onClose} />
              ))}
          </nav>
        </aside>
      </div>
    </>
  );
}
