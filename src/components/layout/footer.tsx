import { siteConfig } from "@/config/site";

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
      &copy; {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
    </footer>
  );
}
