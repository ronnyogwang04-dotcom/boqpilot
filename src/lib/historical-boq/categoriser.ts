// Deterministic, keyword-based construction category classification — no AI
// involved (OpenAI integration is explicitly out of scope for this feature).
// This is its own pipeline stage specifically so it can be swapped for an
// AI classifier later without touching extractor.ts or anything upstream.

export const UNCATEGORISED = "Uncategorised";

// Keywords shared between the Masonry & Brickwork entry and the paving/
// masonry tiebreak below — kept as one constant so the two can't drift out
// of sync.
const MASONRY_BRICK_WALL_KEYWORDS = ["brick wall", "hollow wall", "hoop iron"];

// Version-controlled for now; a future database-backed dictionary can
// replace this list without changing classifyCategory()'s signature.
// Expanded against a real historical BOQ (Khanyisa) — each addition below
// was validated by re-running classification against every real line item
// and checking nothing already-correctly-categorised changed, other than a
// handful of confirmed corrections (see git history / PR notes).
const CATEGORY_KEYWORDS: [category: string, keywords: string[]][] = [
  ["Preliminaries & General", [
    "preliminar",
    "general item",
    "site establishment",
    "contingenc",
    "allow for profit",
    "allow for attendance",
    "provisional sum",
    "allow the sum of",
    "provide the amount of",
    "technical skills and training",
    // Bare "profit" (not just "profit on") — confirmed recurring across two
    // real BOQs with phrasing "profit on" doesn't catch, e.g. "Overhead,
    // charges, profit, etc. on Item 1.7.1". Safe as a bare word: "profit" is
    // a financial/commercial term that doesn't occur in physical trade item
    // descriptions (materials, dimensions, methods), unlike a domain word
    // such as "fitting" or "wall".
    "profit",
    "attendance on",
    // Compound phrases only, not bare "ablution"/"latrine": temporary site
    // ablution/latrine facilities for workers are a classic Preliminaries
    // item, but a real description for one ("Ablution and latrine
    // facilities with wash hand basins and taps") also mentions plumbing
    // fixtures in passing — confirmed this was regressing to Plumbing &
    // Drainage once "wash hand basin" was added there. Requiring "facilities"
    // keeps this from colliding with a permanent building's "ablution
    // block"/bathroom, which wouldn't be phrased this way.
    "ablution facilities",
    "latrine facilities",
  ]],
  ["Earthworks", ["earthwork", "excavat", "backfill", "bulk fill", "topsoil", "compaction", "selected fill"]],
  // Narrow, specific phrases only — deliberately not the bare G5/G7/C3
  // codes (too short, real collision risk) and not a general "civil BOQ"
  // signal: an ordinary earthworks item must stay in Earthworks.
  ["Roadworks", ["selected layer", "stabilised subbase", "stabilised layer"]],
  ["Concrete & Formwork", ["concrete", "formwork", "shuttering", "screed"]],
  ["Reinforcement", ["reinforce", "rebar", "reinforcing steel", "mesh reinforcement", "diameter bars"]],
  ["Masonry & Brickwork", ["brickwork", "blockwork", "masonry", "plastering block", ...MASONRY_BRICK_WALL_KEYWORDS]],
  ["Structural Steelwork", ["structural steel", "steelwork", "steel beam", "steel column"]],
  ["Roofing & Waterproofing", [
    "roof",
    "waterproof",
    "gutter",
    "downpipe",
    "flashing",
    "rafter",
    "purlin",
    "truss",
    "wall plate",
    "fascia board",
    "barge board",
    "weatherboard",
    "gang boarding",
    "bracing",
    "web-stiffener",
    "hurricane clip",
    "truss hanger",
    "windbeam",
    "isotherm",
  ]],
  ["Carpentry & Joinery", ["carpentry", "joinery", "timber", "skirting", "ceiling board", "cupboard", "worktop", "shutterply", "counter"]],
  ["Doors, Windows & Ironmongery", [
    "door",
    "window",
    "glazing",
    "aluminium frame",
    "shutter frame",
    "hinge",
    "deadlock",
    "sash lock",
    "euro-profile",
    "pull handle",
    "push plate",
    "floor spring",
    "escutcheon",
    "padlock",
    "venetian blind",
    "door closer",
    "cylinder profile",
    "cyl lock",
    "roller catch",
    "coat hook",
  ]],
  ["Finishes", ["finish", "paint", "tiling", "tile", "plaster", "flooring", "floor covering"]],
  ["Plumbing & Drainage", [
    "plumbing",
    "drainage",
    "sanitary",
    "sewer",
    "manhole",
    "stormwater",
    "pipe",
    "bend",
    "junction",
    "reducer",
    "reducing tee",
    "equal tee",
    "cast iron fitting",
    "flange adaptor",
    "gulley trap",
    "rodding eye",
    "inspection chamber",
    "ball valve",
    "isolating valve",
    "non-return valve",
    "non return valve",
    "grab rail",
    "towel rail",
    "tissue dispenser",
    "soap dispenser",
    "hose bibtap",
    "floor drain",
    "water heater",
    "solar water heating",
    "biogas",
    "valve box",
    "franke",
    "cobra watertech",
    "shower rail",
    "reducing junction",
    "access bend",
    "pan connector",
    "vent valve",
    "mixing valve",
    "hydroboil",
    "reticulation",
    // Sanitary-ware vocabulary — confirmed recurring across two real BOQs
    // (Zamukukhanya, BOQ REVISED CDC), all unambiguous plumbing-fixture
    // terms with no plausible use outside a sanitary/plumbing context.
    "wash hand basin",
    "wc pan",
    "cistern",
    "bottle trap",
    "shower head",
  ]],
  ["Electrical", ["electrical", "cable", "conduit", "distribution board", "luminaire", "wiring"]],
  ["Mechanical & HVAC", ["hvac", "mechanical", "ventilation", "air condition", "chiller", "duct"]],
  ["External Works & Landscaping", [
    "external works",
    "landscap",
    "paving",
    "fencing",
    "kerb",
    "road works",
    "fenc",
    "security gate",
    "pedestrian gate",
    "vehicle gate",
    "grass",
    "planting",
    "kikuyu",
    "fertiliz",
  ]],
  // Loose furniture only — built-in joinery (cupboards, worktops, counters)
  // already matches Carpentry & Joinery above and is checked first, so it's
  // never reachable here.
  ["Furniture & Fittings", [
    "hospital bed",
    "bedside locker",
    "locker",
    "desk",
    "chair",
    "dining table",
    "tea room table",
    "seating bench",
  ]],
];

// The full set of categories classifyCategory() can assign, in dictionary
// order — used to seed the admin Canonical Item Manager's category picker
// so corrections stay within the known taxonomy rather than free text.
export const CATEGORIES = CATEGORY_KEYWORDS.map(([category]) => category);

function firstMatch(haystack: string): string | null {
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      return category;
    }
  }
  return null;
}

/**
 * "Paving" is checked ahead of the ordered category list rather than in it:
 * a real item can describe a paving detail that mentions brick walls in
 * passing (e.g. "expansion joints between paving blocks and brick walls"),
 * but paving is still the primary activity, not masonry. Scoped narrowly to
 * this specific collision — a general "paving beats everything" rule would
 * be a much bigger, unvalidated behavioural change.
 */
function isPavingWithIncidentalMasonryMention(haystack: string): boolean {
  return haystack.includes("paving") && MASONRY_BRICK_WALL_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

/**
 * Classifies a line item by matching keywords against its own description
 * first, falling back to its section only if the description alone doesn't
 * match anything. A bill heading like "CONCRETE, FORMWORK AND REINFORCEMENT"
 * mixes several trades, so checking it before the item's own words would let
 * the wrong bucket win purely on section order (e.g. a reinforcement item
 * getting bucketed as Concrete & Formwork because "concrete" appears first).
 */
export function classifyCategory(description: string, section: string | null): string {
  const descriptionLower = description.toLowerCase();
  if (isPavingWithIncidentalMasonryMention(descriptionLower)) return "External Works & Landscaping";

  const descriptionMatch = firstMatch(descriptionLower);
  if (descriptionMatch) return descriptionMatch;

  const sectionMatch = section ? firstMatch(section.toLowerCase()) : null;
  return sectionMatch ?? UNCATEGORISED;
}
