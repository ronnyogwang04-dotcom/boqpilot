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
}

function SidebarContent({ onNavigate, isAdmin }: { onNavigate?: () => void; isAdmin: boolean }) {
  return (
    <>
      <Link href="/dashboard" className="flex h-16 shrink-0 items-center px-4 text-sm font-semibold tracking-tight">
        {siteConfig.name}
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

export function Sidebar({ open, onClose, isAdmin }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-800 md:flex">
        <SidebarContent isAdmin={isAdmin} />
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
            <span className="text-sm font-semibold tracking-tight">{siteConfig.name}</span>
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
