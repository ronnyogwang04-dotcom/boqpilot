import { classifyCategory, UNCATEGORISED } from "@/lib/historical-boq/categoriser";

// Division is the top level of the hierarchy; the existing flat categoriser
// (reused, not duplicated) supplies the leaf Category. Division -> Category.
// Version-controlled for now; a future database-backed dictionary can
// replace this map without changing classifyHierarchical()'s signature.
export const DIVISION_BY_CATEGORY: Record<string, string> = {
  "Preliminaries & General": "General",
  Earthworks: "Site & External Works",
  Roadworks: "Site & External Works",
  "External Works & Landscaping": "Site & External Works",
  "Concrete & Formwork": "Structural Works",
  Reinforcement: "Structural Works",
  "Structural Steelwork": "Structural Works",
  "Masonry & Brickwork": "Structural Works",
  "Roofing & Waterproofing": "Envelope & Finishes",
  "Carpentry & Joinery": "Envelope & Finishes",
  "Doors, Windows & Ironmongery": "Envelope & Finishes",
  Finishes: "Envelope & Finishes",
  "Furniture & Fittings": "Envelope & Finishes",
  "Plumbing & Drainage": "Building Services",
  Electrical: "Building Services",
  "Mechanical & HVAC": "Building Services",
  [UNCATEGORISED]: "Uncategorised",
};

// The full set of divisions classifyHierarchical() can assign, in
// dictionary order — used to seed the admin Canonical Item Manager's
// division picker.
export const DIVISIONS = [...new Set(Object.values(DIVISION_BY_CATEGORY))];

export type HierarchicalCategory = {
  division: string;
  category: string;
};

/** Classifies a canonical item into Division -> Category using the existing deterministic keyword categoriser. */
export function classifyHierarchical(description: string, section: string | null): HierarchicalCategory {
  const category = classifyCategory(description, section);
  return { division: DIVISION_BY_CATEGORY[category] ?? "Uncategorised", category };
}
