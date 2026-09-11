// Builds the text that actually gets sent to OpenAI for embedding — a pure,
// deterministic function over fields the construction-intelligence layer
// already produces. Deliberately does NOT touch or derive from anything
// that feeds duplicate_group_key: this is a separate, additive layer on top
// of the existing canonical-item identity, not a replacement for it.
//
// No LLM rewrite step: "Supply and install X" / "Install and supply X" /
// "Supply & installation of X" resolve to similar vectors because the
// embedding MODEL captures that similarity, not because this function
// normalises the wording itself — which is exactly what keeps genuinely
// different activities (supply only vs. install only vs. supply-and-install
// vs. repair vs. removal vs. testing vs. commissioning) distinguishable:
// each keeps its own distinct (but semantically nearby) input text.

export type EmbeddingInputFields = {
  normalisedDescription: string | null;
  normalisedUnit: string | null;
  division: string | null;
  category: string | null;
};

export function buildEmbeddingInputText(fields: EmbeddingInputFields): string {
  let description = fields.normalisedDescription?.trim() || "(no description)";
  const unit = fields.normalisedUnit?.trim() || "unspecified";
  const category = fields.category?.trim() || "Uncategorised";
  const division = fields.division?.trim() || "Uncategorised";

  // normaliseDescription() already sentence-cases and often ends a
  // description with its own punctuation (many real historical BOQ lines
  // end in "."). Avoid stacking a second "." on top of that.
  if (/[.!?]$/.test(description)) {
    description = description.slice(0, -1);
  }

  return `${description}. Unit: ${unit}. Category: ${category} (${division}).`;
}
