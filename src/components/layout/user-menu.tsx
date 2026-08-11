"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  email: string;
  displayName: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function UserMenu({ email, displayName }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
      >
        {getInitials(displayName || email)}
      </button>

      <div
        role="menu"
        className={cn(
          "absolute right-0 mt-2 w-56 origin-top-right rounded-md border border-zinc-200 bg-white py-1 shadow-lg transition dark:border-zinc-800 dark:bg-zinc-950",
          open ? "visible opacity-100" : "invisible opacity-0",
        )}
      >
        <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <p className="truncate text-sm font-medium">{displayName}</p>
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-500">{email}</p>
        </div>
        <Link
          href="/dashboard/settings"
          role="menuitem"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-zinc-100 dark:text-red-400 dark:hover:bg-zinc-900"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
