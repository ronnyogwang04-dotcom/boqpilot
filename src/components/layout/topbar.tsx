"use client";

import { Menu } from "lucide-react";
import { UserMenu } from "@/components/layout/user-menu";

interface TopbarProps {
  onOpenSidebar: () => void;
  email: string;
  displayName: string;
}

export function Topbar({ onOpenSidebar, email, displayName }: TopbarProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800 sm:px-6">
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label="Open menu"
        className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="hidden md:block" />
      <UserMenu email={email} displayName={displayName} />
    </header>
  );
}
