-- Distinguishes genuine rate-bearing BOQ line items from non-rate-bearing
-- content (section/bill headings, subtotals, preliminaries headings, notes,
-- contractual/definitional text) that real historical BOQs mix into the
-- same sheet as priced items. See src/lib/historical-boq/row-type.ts for
-- the deterministic classification. Every row is still stored for audit,
-- but only 'rate_item' rows are ever resolved to a canonical_item_id — see
-- process-historical-boq.ts.

alter table public.historical_boq_items
  add column if not exists row_type text not null default 'rate_item'
    check (row_type in (
      'rate_item',
      'bill_heading',
      'section_heading',
      'subtotal_total',
      'preliminary_general',
      'note_specification',
      'contractual_text',
      'general_text'
    ));

create index if not exists historical_boq_items_row_type_idx on public.historical_boq_items (row_type);
