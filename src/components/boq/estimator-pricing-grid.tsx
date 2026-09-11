"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatZAR } from "@/lib/format";
import type { BoqLineItemRow } from "@/lib/queries/boq-line-items";
import type { MarkupSettings } from "@/lib/actions/pricing-settings";
import { BoqItemDetailPanel } from "@/components/boq/boq-item-detail-panel";

function currentAmount(item: BoqLineItemRow): number | null {
  const rate = item.estimator_rate ?? item.unit_rate;
  if (rate === null || item.quantity === null) return item.amount;
  return item.quantity * rate;
}

export function EstimatorPricingGrid({ items, markupDefaults }: { items: BoqLineItemRow[]; markupDefaults: MarkupSettings }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900">
          <tr>
            <th className="w-8 px-3 py-2" />
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Description</th>
            <th className="px-3 py-2">Unit</th>
            <th className="px-3 py-2 text-right">Quantity</th>
            <th className="px-3 py-2 text-right">Rate</th>
            <th className="px-3 py-2">Source</th>
            <th className="px-3 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {items.map((item) => {
            const expanded = expandedId === item.id;
            const rate = item.estimator_rate ?? item.unit_rate;
            return (
              <Fragment key={item.id}>
                <tr
                  className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                  onClick={() => setExpandedId(expanded ? null : item.id)}
                >
                  <td className="px-3 py-2 text-zinc-400">
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </td>
                  <td className="px-3 py-2 text-zinc-500">{item.row_number}</td>
                  <td className="px-3 py-2 font-medium">{item.description}</td>
                  <td className="px-3 py-2">{item.unit ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{item.quantity ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{rate !== null ? formatZAR(rate) : "—"}</td>
                  <td className="px-3 py-2 text-zinc-500">{item.rate_source ?? (item.unit_rate !== null ? "as uploaded" : "—")}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {(() => {
                      const amount = currentAmount(item);
                      return amount !== null ? formatZAR(amount) : "—";
                    })()}
                  </td>
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={8} className="p-0">
                      <BoqItemDetailPanel item={item} markupDefaults={markupDefaults} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
