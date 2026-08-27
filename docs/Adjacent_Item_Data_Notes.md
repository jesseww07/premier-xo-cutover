# Adjacent item-data notes (not part of the form revamp)

Facts found during the 2026-08-27 form analysis that belong to *later* processes. Parked here so they are not lost and not re-discovered. **No action implied by this file.**

## Display Name / UPC Code = internal ID (a Premier convention, in cross-department discussion)

- Display Name = internal ID on 532,040 items; UPC Code = internal ID on 327,951 of 395,616 (only 3,232 look like UPCs). Vendor Name/Code = Item Name on 398,951.
- Writers: `customworkflow31` "Internal ID as Display Name" → WFA `customscript_internal_as_code` (script 581, file 5319 — **not under /SuiteScripts**); `customworkflow35` "Set Item Defaults" (UPC Code = `TO_CHAR({internalid})`, Vendor Name = Item Name, Use Bins = T, Offer Support = T, Special Order Product = T); `pl_displayname.js` WFA (forces UPC = internal ID); `_jww_upc_fill` MR (backfill); LA `update_price_only.js` wrote real UPCs into the same field → 192,743 conflicting values (stops Sep 1).
- Readers: `mag_sl_print_label_form.js` barcodes `upccode` on warehouse labels; `pl_salesOrdItemLabel_sl.js` prints `displayname`; 6 advanced PDF templates print `displayname` (`custtmpl_cycle_count_print`, `custtmpl_if_with_iinternalid`, `custtmpl_suitetax_invoice_1106`, `custtmpl_113`, `_225`, `_241`); `inventory_portlet.js`, `suitelet_generate_code.js`, `item record report.js`, `Unified Catalog Analysis.js` read `displayname`.
- FarApp barcode mapping points at `custitem_la_upc`.
- Saved searches referencing `displayname` / `upccode` by field id: **0**. Referencing `custitem_la_product_name`: 3. `custitem_la_upc`: 3.
- If the convention is ever retired, writers must be switched off before any backfill or the workflows re-apply it on save.

## Special Order Product

`custitem_zastro_special_order` — TRUE on 683,902 items; set by `customworkflow35`; read by 11 saved searches. It is the eligibility gate for the purchasing/consolidation workflow (items need it to enter the flow that creates the consolidation records). Native `isspecialorderitem` (9 TRUE) has NetSuite's meaning. Rename candidates when the time comes: "Purchasing Workflow Eligible", "Consolidation Eligible", "Order-In Item".

## Native fields that could be fed from XO (ingest-spec items)

`manufacturer` (today 1,649) ← XO Vendor Name · `weight` (452) ← XO Ship Weight, confirm unit · `mpn` (20) ← XO Item Number, low value since Item Name already is the vendor SKU.
