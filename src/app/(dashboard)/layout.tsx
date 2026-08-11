import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already guards this route group; this is defense-in-depth
  // for direct server-side navigation and revalidation.
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const displayName = profile?.full_name || user.email || "Account";

  return (
    <DashboardShell email={user.email ?? ""} displayName={displayName} isAdmin={profile?.role === "admin"}>
      {children}
    </DashboardShell>
  );
}
