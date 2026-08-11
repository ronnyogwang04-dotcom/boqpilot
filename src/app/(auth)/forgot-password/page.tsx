import Link from "next/link";
import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Enter the email associated with your account and we&apos;ll send a link to reset your password.
      </p>
      <ForgotPasswordForm />
      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        Remembered it after all?{" "}
        <Link href="/login" className="font-medium text-zinc-900 dark:text-zinc-50">
          Log in
        </Link>
      </p>
    </div>
  );
}
