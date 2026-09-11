import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ProfileSettingsForm } from "@/components/dashboard/profile-settings-form";
import { MarkupSettingsForm } from "@/components/dashboard/markup-settings-form";
import { getMarkupSettings } from "@/lib/actions/pricing-settings";
import { signOut } from "@/lib/actions/auth";
import { SubmitButton } from "@/components/ui/submit-button";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, markupSettings] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user!.id).single(),
    getMarkupSettings(),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <section className="mt-8 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">Profile</h2>
        <div className="mt-4">
          <ProfileSettingsForm email={user?.email ?? ""} fullName={profile?.full_name ?? ""} />
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">Pricing markup defaults</h2>
        <div className="mt-4">
          <MarkupSettingsForm settings={markupSettings} />
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-red-200 p-6 dark:border-red-900">
        <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">Session</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Sign out of BOQPilot on this device.
        </p>
        <form action={signOut} className="mt-4">
          <SubmitButton variant="outline" pendingText="Signing out...">
            Sign out
          </SubmitButton>
        </form>
      </section>
    </div>
  );
}
