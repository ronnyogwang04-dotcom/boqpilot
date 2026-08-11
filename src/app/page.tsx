import Link from "next/link";
import { Calculator, LineChart, FileCheck2 } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { siteConfig } from "@/config/site";

const features = [
  {
    icon: Calculator,
    title: "AI-assisted BOQ pricing",
    description:
      "Price bill of quantities line items faster with AI suggestions grounded in your historical rates.",
  },
  {
    icon: LineChart,
    title: "Market benchmarking",
    description:
      "Compare your rates against market benchmarks so every bid stays competitive and defensible.",
  },
  {
    icon: FileCheck2,
    title: "Tender assistant",
    description:
      "Keep tenders organized from first draft to submission, with a clear view of where each one stands.",
  },
];

const steps = [
  {
    step: "01",
    title: "Create your workspace",
    description: "Sign up and set up your contractor profile in minutes.",
  },
  {
    step: "02",
    title: "Import your BOQ",
    description: "Bring in bills of quantities from your existing tenders and projects.",
  },
  {
    step: "03",
    title: "Price with confidence",
    description: "Use AI pricing and benchmarking to submit stronger, faster bids.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <Navbar />
      <main className="flex-1">
        <section className="mx-auto flex w-full max-w-5xl flex-col items-center px-6 py-24 text-center sm:py-32">
          <span className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            Built for construction contractors
          </span>
          <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
            {siteConfig.name}
          </h1>
          <p className="mt-6 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
            {siteConfig.description}
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/sign-up"
              className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Get started
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-300 px-6 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Log in
            </Link>
          </div>
        </section>

        <section className="border-t border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-20 sm:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex flex-col items-start">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mx-auto w-full max-w-6xl px-6 py-20">
            <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
            <div className="mt-10 grid gap-10 sm:grid-cols-3">
              {steps.map(({ step, title, description }) => (
                <div key={step}>
                  <span className="text-sm font-semibold text-zinc-400">{step}</span>
                  <h3 className="mt-2 text-base font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-6 py-20 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Ready to price your next tender?
            </h2>
            <p className="mt-3 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
              Create a free account and set up your contractor workspace today.
            </p>
            <Link
              href="/sign-up"
              className="mt-8 inline-flex h-11 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Get started for free
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
