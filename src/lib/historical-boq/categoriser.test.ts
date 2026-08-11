import { describe, expect, it } from "vitest";
import { classifyCategory, UNCATEGORISED } from "./categoriser";

describe("classifyCategory", () => {
  it("matches on the item's own description", () => {
    expect(classifyCategory("supply and lay concrete screed", null)).toBe("Concrete & Formwork");
    expect(classifyCategory("excavate trench for foundation", null)).toBe("Earthworks");
  });

  it("prefers the description match over the section when both would match different categories", () => {
    // A "reinforcement" item sitting under a mixed-trade section heading
    // should classify by its own words, not by whichever keyword the
    // section heading happens to hit first.
    expect(classifyCategory("high yield reinforcing steel to columns", "CONCRETE, FORMWORK AND REINFORCEMENT")).toBe(
      "Reinforcement",
    );
  });

  it("falls back to the section when the description alone doesn't match", () => {
    expect(classifyCategory("miscellaneous sundries", "Roofing")).toBe("Roofing & Waterproofing");
  });

  it("falls back to Uncategorised when nothing matches", () => {
    expect(classifyCategory("random unrelated text", null)).toBe(UNCATEGORISED);
  });

  it("classifies plumbing pipe fittings added from the Khanyisa dictionary expansion", () => {
    expect(classifyCategory("50mm Bend.", null)).toBe("Plumbing & Drainage");
    expect(classifyCategory("Cast iron resilient seal flanged isolating valve.", null)).toBe("Plumbing & Drainage");
  });

  it("classifies door ironmongery under the renamed Doors, Windows & Ironmongery category", () => {
    expect(classifyCategory("Cylinder Deadlock (Stainless Steel) Code: D037D SS.", null)).toBe(
      "Doors, Windows & Ironmongery",
    );
    expect(classifyCategory('50mm Brass padlock with 28mm Stainless Steel shackle.', null)).toBe(
      "Doors, Windows & Ironmongery",
    );
  });

  it("classifies roof timber structure members", () => {
    expect(classifyCategory("38 x 114mm 22,5 degree rafter spanning 32mm with 635mm", null)).toBe(
      "Roofing & Waterproofing",
    );
    expect(classifyCategory("38 x 76mm Bottom chord bracing.", null)).toBe("Roofing & Waterproofing");
  });

  it("classifies PC/provisional sum boilerplate under Preliminaries & General", () => {
    expect(classifyCategory("Allow for profit.", null)).toBe("Preliminaries & General");
    expect(classifyCategory("Provide the amount of R 150 000.00 (One Hundred and Fifty Thousand Rand)", null)).toBe(
      "Preliminaries & General",
    );
  });

  it("favours External Works over Masonry when paving is the primary activity, even with an incidental brick-wall mention", () => {
    expect(classifyCategory("In expansion joints between paving blocks and brick walls.", null)).toBe(
      "External Works & Landscaping",
    );
  });

  it("still classifies a real brick-wall item as Masonry when paving isn't mentioned", () => {
    expect(classifyCategory("One brick walls.", null)).toBe("Masonry & Brickwork");
  });

  it("classifies SA road-layer terminology as Roadworks via specific phrases, not the bare G5/G7/C3 codes", () => {
    expect(classifyCategory("G7 selected layer in accordance with SABS 1200 M table 3B", null)).toBe("Roadworks");
    expect(classifyCategory("C3 stabilised subbase in accordance with SABS 1200 M", null)).toBe("Roadworks");
  });

  it("does not classify an ordinary earthworks item as Roadworks just because it's in a civil BOQ", () => {
    expect(classifyCategory("excavate trench for foundation", null)).toBe("Earthworks");
  });

  it("classifies loose furniture under Furniture & Fittings", () => {
    expect(classifyCategory("Hospital bed (Code: FURN-314), 4 crank manual", null)).toBe("Furniture & Fittings");
    expect(classifyCategory("Bedside Locker (Code: FURN-277) ABS plastic", null)).toBe("Furniture & Fittings");
    expect(classifyCategory("Typical dining table, size 3200mm long x 1000mm wide", null)).toBe(
      "Furniture & Fittings",
    );
    expect(classifyCategory("Side chair/moulded polypropylene/stackable", null)).toBe("Furniture & Fittings");
  });

  it("does not steal built-in joinery into Furniture & Fittings", () => {
    expect(classifyCategory("Built in cupboard, overall size 1200mm long x 2100mm high", null)).toBe(
      "Carpentry & Joinery",
    );
  });

  it("classifies reinforcement bar schedule fragments via 'diameter bars'", () => {
    expect(classifyCategory("10mm Diameter bars.", null)).toBe("Reinforcement");
  });

  it("classifies additional ironmongery vocabulary found in the batch validation", () => {
    expect(classifyCategory("GMK Double Cylinder Profile (Code: T2X18/60SNGMK)", null)).toBe(
      "Doors, Windows & Ironmongery",
    );
    expect(classifyCategory("UNION Euro Cyl Lock No. Cyl. (Code: L-2215-78SS)", null)).toBe(
      "Doors, Windows & Ironmongery",
    );
    expect(classifyCategory("Adjustable roller catch (code: ARC1182SS)", null)).toBe("Doors, Windows & Ironmongery");
    expect(classifyCategory("Hat & Coat hook with buffer (Code: SS8025SS)", null)).toBe(
      "Doors, Windows & Ironmongery",
    );
  });

  it("classifies more profit/attendance phrasings under Preliminaries & General", () => {
    expect(classifyCategory("Profit on above item.", null)).toBe("Preliminaries & General");
    expect(classifyCategory("Attendance on ditto.", null)).toBe("Preliminaries & General");
  });

  it("classifies general earthworks fill separately from Roadworks layer terminology", () => {
    expect(classifyCategory("Selected fill material", null)).toBe("Earthworks");
  });
});
