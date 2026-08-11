import type { Metadata } from "next";
import { CheckCircle2, Circle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .single();

  const emailConfirmed = Boolean(user?.email_confirmed_at);
  const hasName = Boolean(profile?.full_name);

  const checklist = [
    { label: "Create your account", done: true },
    { label: "Confirm your email address", done: emailConfirmed },
    { label: "Complete your profile", done: hasName },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Signed in as {user?.email}
      </p>

      <section className="mt-8 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">Getting started</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {checklist.map((step) => (
            <li key={step.label} className="flex items-center gap-2 text-sm">
              {step.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-zinc-400" />
              )}
              <span className={step.done ? "text-zinc-500 line-through" : ""}>{step.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          BOQ pricing, benchmarking, and tender tools will appear here soon.
        </p>
      </section>
    </div>
  );
}
