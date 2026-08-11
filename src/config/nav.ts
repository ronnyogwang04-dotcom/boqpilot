import type { LucideIcon } from "lucide-react";
import { CreditCard, FolderKanban, Library, LayoutDashboard, Settings, ShieldCheck, TrendingUp } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

export const dashboardNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Projects", href: "/dashboard/projects", icon: FolderKanban },
  { label: "Historical Library", href: "/dashboard/historical-library", icon: Library },
  { label: "Rate Explorer", href: "/dashboard/rate-explorer", icon: TrendingUp },
  { label: "Billing", href: "/dashboard/billing", icon: CreditCard },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
  { label: "Admin", href: "/dashboard/admin", icon: ShieldCheck, adminOnly: true },
];
