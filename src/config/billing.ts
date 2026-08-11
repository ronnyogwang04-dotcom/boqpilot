export type BillingPlan = {
  id: string;
  name: string;
  description: string;
  amount: number;
  currency: "ZAR";
  interval: "once" | "month";
};

export const billingPlans: BillingPlan[] = [
  {
    id: "pro-monthly",
    name: "BOQPilot Pro",
    description: "AI-assisted BOQ pricing, benchmarking, and tender tools.",
    amount: 499,
    currency: "ZAR",
    interval: "month",
  },
];
