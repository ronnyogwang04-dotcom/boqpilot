// Deterministic classification of what kind of row a BOQ line represents.
// Real historical BOQs — especially Preliminaries bills pasted in from JBCC
// boilerplate — mix genuine priceable line items with section/bill
// headings, subtotal rows, notes, specifications, and pages of
// contractual/definitional text, all in the same sheet the extractor walks.
// Only "rate_item" rows are eligible for normalisation, categorisation, and
// canonicalisation into rate_library_items (see process-historical-boq.ts);
// every other type is still stored on historical_boq_items for audit.

export type RowType =
  | "rate_item"
  | "bill_heading"
  | "section_heading"
  | "subtotal_total"
  | "preliminary_general"
  | "note_specification"
  | "contractual_text"
  | "general_text";

// Version-controlled for now, same rationale as the construction
// dictionaries in src/lib/construction-intelligence/. Order matters: more
// specific patterns are checked first so e.g. a "PRELIMINARIES" bill heading
// (which often literally starts "BILL NO 1: PRELIMINARIES") resolves to
// bill_heading, not preliminary_general.
//
// Split into two tiers. DEFINITIVE patterns describe text no real BOQ line
// item is ever actually phrased as ("BILL NO 3", "Sub Total", "Add Value
// Added Tax", "NOTE: ...") — confirmed against real historical BOQs, where
// a "Sub Total" row (stray 0 in the quantity column, real number in the
// amount column), a VAT summary row, and "NOTE:" rows referencing JBCC
// CPAP work groups all otherwise passed isLikelyRateItem() on numeric
// signals alone (the "Sub Total"/VAT cases were fixed first; "NOTE:"/"N.B."
// is promoted here for the same reason — a real item's description never
// starts with a bare note marker). These are checked unconditionally,
// before the numeric heuristic, so wording this unambiguous always wins
// regardless of what's sitting in nearby cells.
//
// "Specification"/"Spec" stay in the CONTEXTUAL tier below, not here: unlike
// "NOTE:", a real priced item's description can plausibly start with
// "Specification..." (e.g. quoting a materials spec as part of the item
// itself), so it must not override real numeric evidence.
//
// CONTEXTUAL patterns (a heading mentioning "preliminaries", "Specification",
// JBCC contract vocabulary) are only checked as a fallback once a row has
// already failed the numeric test — a real priced item can legitimately
// contain this wording in its own description (e.g. "Preliminaries and
// general: contractor's establishment on site ... sum ... R50,000"), so
// these must never override real numeric evidence.
const DEFINITIVE_TEXT_PATTERNS: [
  type: "bill_heading" | "section_heading" | "subtotal_total" | "note_specification",
  pattern: RegExp,
][] = [
  ["bill_heading", /^\s*bill\s*(no\.?)?\s*\d/i],
  ["section_heading", /^\s*section\s*(no\.?)?\s*\d/i],
  [
    "subtotal_total",
    /^\s*(sub[- ]?total|total\s+(carried|brought)|carried\s+(to|forward)|brought\s+forward|(add\s+)?value\s+added\s+tax|vat\b)/i,
  ],
  ["note_specification", /^\s*(note|n\.?b\.?)\b[:.\s]/i],
];

const CONTEXTUAL_TEXT_PATTERNS: [type: "preliminary_general" | "note_specification" | "contractual_text", pattern: RegExp][] = [
  ["preliminary_general", /\bpreliminar(y|ies)\b|\bgeneral\s+(conditions|requirements|items)\b/i],
  ["note_specification", /^\s*(specification|spec)\b[:.\s]/i],
  [
    "contractual_text",
    /\bjbcc\b|meaning of terms|\bdefinitions?\b|conditions of contract|contract data|\btenderer\b|principal agent|form of offer|schedule of deviations/i,
  ],
];

export type DefinitiveRowType = "bill_heading" | "section_heading" | "subtotal_total" | "note_specification";

/** Checked before the numeric heuristic — see DEFINITIVE_TEXT_PATTERNS above. */
export function matchDefinitiveRowType(text: string): DefinitiveRowType | null {
  for (const [type, pattern] of DEFINITIVE_TEXT_PATTERNS) {
    if (pattern.test(text)) return type;
  }
  return null;
}

// Raw unit values that are never a real measurement unit, regardless of
// what numeric signals sit alongside them — checked unconditionally, before
// the numeric heuristic, since the numbers next to them are often genuinely
// non-zero (a page number, a bill total, a VAT amount) and would otherwise
// satisfy isLikelyRateItem() just like a real quantity and price:
//  - "Page": the row is a bills-summary/index entry — its "quantity" is
//    actually a page number and its "amount" a bill grand-total. Confirmed
//    against a real historical BOQ's "Bills Summary" page (e.g.
//    "Ironmongery" / unit "Page" / quantity 133 / amount 1,271,202.56).
//  - "VAT": the row is a VAT summary/total line — confirmed against a real
//    historical BOQ where the description was just "ADD" (so the
//    description-based VAT pattern in DEFINITIVE_TEXT_PATTERNS above never
//    matched) but the unit column literally held "VAT" alongside a real
//    computed tax amount.
const DEFINITIVE_NON_RATE_UNITS = new Set(["page", "vat"]);

export function isDefinitiveNonRateUnit(unit: string | null): boolean {
  return unit !== null && DEFINITIVE_NON_RATE_UNITS.has(unit.trim().toLowerCase());
}

/**
 * Classifies a row that has already failed both matchDefinitiveRowType()
 * and isLikelyRateItem() — these contextual buckets are only ever consulted
 * for rows with no corroborating numeric/unit signal, so they can never
 * hijack a genuine priced line item. Falls back to "general_text" rather
 * than forcing an unmatched row into the wrong specific bucket.
 */
export function classifyNonRateRowType(text: string): Exclude<RowType, "rate_item"> {
  const definitive = matchDefinitiveRowType(text);
  if (definitive) return definitive;

  for (const [type, pattern] of CONTEXTUAL_TEXT_PATTERNS) {
    if (pattern.test(text)) return type;
  }
  return "general_text";
}

// Row types that behave like a heading for section-tracking purposes — the
// extractor updates `currentSection` when it sees one, so items that follow
// are correctly attributed. Subtotals, notes, and contractual text are
// deliberately excluded: letting a subtotal amount or a stray paragraph
// overwrite currentSection would mislabel every real item until the next
// real heading.
export const HEADING_ROW_TYPES: ReadonlySet<RowType> = new Set(["bill_heading", "section_heading", "preliminary_general"]);

// "sum" (item / lump sum / ls) is a materially weaker signal than a real
// measured unit: real JBCC-templated Preliminaries sheets routinely
// pre-fill every clause-heading row with unit "Item" and quantity 1 as
// boilerplate (e.g. "A2  OFFER, ACCEPTANCE AND PERFORMANCE"), with no price
// — confirmed against a real historical BOQ, where every row matching
// quantity=1 + unit=sum + no price was a clause heading, not a genuine
// unpriced item. A measured unit (m², m³, kg, No, ...) doesn't get reused
// as a template placeholder this way, so it stays a strong signal on its
// own; "sum" only counts once it's corroborated by an actual price.
const WEAK_UNITS = new Set(["sum"]);

/**
 * A cell value of exactly 0 is, in practice, indistinguishable from "not
 * filled in" for judging whether a row is a genuine rate item — confirmed
 * against real BOQs where 0/0 is used as boilerplate on heading and
 * cross-reference rows (e.g. a Mjanyana section heading stored as
 * `["FLOORS AND FLOOR FINISHES", "H2", 0, null, 0]` — quantity and amount
 * both literally 0 — and a Tyali cross-reference row, `["Part B -
 * Electrical Installation (See separate document)", "Item", 1, null, 0]`).
 * This only affects the row-type heuristic below; the actual stored
 * quantity/unit_rate/amount values on a genuine rate_item row, and the raw
 * cell values in raw_row, are completely unaffected — see validation.ts's
 * buildExtractedItem(), which reads the cells independently of this check.
 */
function isPresentNumber(value: number | null): boolean {
  return value !== null && value !== 0;
}

export type RateItemSignals = {
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  amount: number | null;
};

/**
 * A genuine rate-bearing BOQ line item almost always carries at least two
 * corroborating signals together. A single isolated value is not enough:
 * that's exactly the false-positive pattern real BOQs produce, e.g. a JBCC
 * clause reference like "H1" landing in whatever column happens to sit at
 * the unit position for a contractual-text row. Deliberately does not
 * require a rate/amount for a strongly-recognised unit, since a
 * legitimately unpriced item (quantity + measured unit, no rate yet) must
 * still be captured as a rate item, not suppressed — that leniency is
 * narrowed only for the "sum" unit, per the WEAK_UNITS rationale above.
 */
export function isLikelyRateItem(signals: RateItemSignals): boolean {
  const hasQuantity = isPresentNumber(signals.quantity);
  const hasPrice = isPresentNumber(signals.rate) || isPresentNumber(signals.amount);
  const { unit } = signals;
  const hasStrongUnit = unit !== null && !WEAK_UNITS.has(unit);
  const hasWeakUnit = unit !== null && WEAK_UNITS.has(unit);

  if (hasQuantity && hasStrongUnit) return true;
  if (hasStrongUnit && hasPrice) return true;
  if (hasQuantity && hasPrice) return true;
  if (hasWeakUnit && hasPrice) return true;
  return false;
}
