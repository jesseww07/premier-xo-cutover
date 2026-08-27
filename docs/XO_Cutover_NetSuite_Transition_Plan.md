# NetSuite Field Transition & LightsAmerica Retirement Plan
**XO go-live: September 1, 2026** · Prepared August 21, 2026 · Premier Lighting / ShopPremier

Scope change driving this revision: ownership decision that the full LA-era data surface remains accessible in NetSuite, sourced from XoLogic's backend full-catalog export. The daily XO export must therefore expand from quantity/pricing to the full field set. Verification basis: 687 Minka-Lavery products joined across the current LA CSV (Zastro) and the XO backend export, plus a 1,308-row Minka-Aire export for the fan field set; every mapping below marked "verified" was confirmed on live paired values, not column names.

---

## Part 1 — Findings that change prior decisions

**1. XOItemID column is corrupted in XO's own export — source custitem7 from ItemID instead.**
XOItemID is a composite string `{VendorID}-{VItemID}` (e.g. `10-471`). 164 of 1,683 rows in the sample arrive Excel-date-mangled (`10-93` → `Oct-93`). The corruption is upstream, inside XO's export pipeline. `ItemID` is a clean, 100%-unique numeric (e.g. `3372700111`) and is XO's permanent item identity. **Revision to the locked plan: custitem7 "XO Item ID" sources from `ItemID`, not the `XOItemID` column.** Also escalate the mangling to Tyler — it will bite anything else keyed to XOItemID.

**2. Two naming traps confirmed.**
LA "Safety Rating" actually held *location rating* (Damp/Wet) → maps to `Extra-Location Rating` / `Standard-Location Rating`. LA "Safety Listing" (ETL/UL) → maps to XO's `Extra-Safety Rating`. The names cross over between feeds. Any script or saved search touching these two fields must be re-checked by meaning, not name.

**3. Ship method domain is dirty.** `Extra-Vendor Ship Method` mixes value domains by source file (`Yes/No` from pricing loads, `UPS/Small Parcel/Truck` from catalog loads). Fourth item for the Tyler escalation list.

**4. Duplicate/variant columns require coalesce rules on ingest.** `Extra-Number of Bulbs` vs `Extra-Number Of Bulbs`, `Extra-Downrod Included` vs `Extra-Down Rod Included`, `Extra-Chain Included` (holds lengths, not booleans, duplicating `Extra-Chain Length`), `Extra-Warranty`/`-2`, `Extra-Bulb Wattage`/`-2`. Ingest rule: COALESCE case/spelling variants; never trust `Chain Included` as a boolean.

**5. Units embedded in values.** `Extra-Bulb Wattage` = "60 W", `Extra-Voltage` = "120 V", `Standard-Wattage` = "60w". Strip units on ingest; numeric NS fields can't take them raw.

**6. Document files are positional-random.** `file-1/2/3` slots carry Spec Sheet / Installation Guide / Warranty / Product Maintenance in no fixed order. Ingest must match on `FileDescr` keyword, never slot index.

**7. One fidelity loss.** Glass detail degrades: LA verbatim "Clear Seedy" → XO normalized "Clear" (`Standard-Glass Finish or Style`); verbatim `Extra-Glass` is only 2% filled for Minka. If glass specificity matters for the Fixture form, raise with Tyler.

**8. Fan fields verified (Minka-Aire export, 1,308 rows, Aug 21).** All 13 LA fan fields map, with three watch items: XO calls blade span "Blade Sweep"; `Extra-Reversible Blades` is two-sided blade finish, NOT motor reverse (`Extra-Reverse Capable` / Control Type carry that — do not coalesce them); downrod data arrives under three naming schemes (`Downrod Length 1` / `Downrod 1 Length` / `Down Rod Included`) that must coalesce. Electricity use comes as amps, not watts (watts derivable from CFM ÷ CFM/Watts). XO also adds fan data LA never had: motor type/size, RPM, blade-to-ceiling, sloped-ceiling compatibility (86% fill), smart-control fields. **Fan entry form is unblocked.**

**9. Net data gain is large.** Country of Origin 45%→99%, ADA 2%→59%, Dark Sky 1%→56%, Energy Star 0%→43%, Light Kit 0%→31-66%, plus a 15-image gallery, 3 document slots, compliance set (Prop 65, Title 20/24, PFAS, CEC), 5-tier cost family, MAP tiers, change-date quartet, and normalized Standard facets — none of which LA provided. One value shift to expect: XO MSRP ≠ LA List Price on the same items (different markup basis); MSRP is authoritative at cutover.

Full field-by-field mapping: **LA_to_XO_Field_Mapping.csv** (all 68 LA fields). XO-exclusive fields to land: **XO_Exclusive_Fields_To_Land.csv**.

---

## Part 2 — NetSuite field dispositions

Governing mechanic: **relabeling a custom field preserves its scriptid and internal id.** History, saved searches, and script references all survive a label change. The only operation that breaks references is delete-and-recreate — so the plan renames and re-sources wherever a field has an XO equivalent, and only retires fields with no XO source or no data. This is also what satisfies the owners' data-history requirement: the LA-era values already in those fields stay put; the XO feed simply becomes the new writer.

### A. RENAME + RE-SOURCE (label change only; scriptid, internal id, and history preserved)
Every `custitem_la_*` spec field with a verified XO source. Drop "LA" from the label; sourcing switches to the XO column per the mapping CSV. Representative set (full list = every MAPPED row in the CSV):

| Current field | New label | XO source |
|---|---|---|
| custitem_la_manufacturer_number | MPN | Item Number |
| custitem_la_manufacturer_name | Brand / Vendor | Vendor Name |
| custitem_la_manufacturer_finish | Finish | Extra-Finish |
| custitem_la_regular_price | Web Price | Web Price |
| custitem_la_list_price | MSRP | MSRP |
| custitem_la_width_diameter / height / length | Width / Height / Length | Width / Height / Length |
| custitem_la_color_temperature | Kelvin | Extra-Kelvin |
| custitem_la_image | Primary Image | Image Path |
| custitem_la_product_url | Item URL | Item URL (prepend domain) |
| (collection, material, bulb set, weight, extension, voltage, lumens, CRI, dimmable, warranty, country, safety/location, ADA, Dark Sky, Energy Star, intro date, carton volume, spec/instruction docs…) | neutral names | per mapping CSV |

### B. REPURPOSE (already locked; one correction)
- `custitem5` → **IMAP**, source `IMAP` — unchanged.
- `custitem6` "Is Light Bulb" — keep as-is, do not rename — unchanged.
- `custitem7` → **XO Item ID**, source **`ItemID`** (correction per Finding 1), overwrite gradually via feed.
- `custitem_atlas_style` → **XO Style**, source `Standard-Style` — unchanged.

### C. RETIRE (no XO source, or no data; find-refs-then-inactivate, never delete)
- Three LA identity fields: `custitem_la_sku`, `custitem_lights_sku`, `custitem_la_unique_id` (locked).
- Remaining Atlas fields, both Solupay fields (locked).
- Beam Spread, Dimensional Weight, Parts Diagram (0% fill, no XO source).
- Notes, Crystal (no populated XO equivalent; crystal presence survives inside Material).
- Drop Ship: keep the field as Premier-internal fulfillment config; remove it from feed sourcing only.

### D. ADD (new `custitem_xo_*` fields — same SDF ACP as the entry forms; fields deploy before forms)
Only where nothing repurposable exists:
- `custitem_xo_umap` (currency)
- `custitem_xo_backorder_date` (date), `custitem_xo_in_stock` (integer, informational only — inventory intentionally does not sync)
- `custitem_xo_order_multiple`, `custitem_xo_order_minimum`
- Change-date quartet: `custitem_xo_last_changed`, `custitem_xo_availability_changed`, `custitem_xo_catalog_changed`, `custitem_xo_price_changed`
- Cost family as needed: `custitem_xo_vendor_disc_cost`, `custitem_xo_cost_w_shipping` (Item Cost itself lands in native `cost`)
- Facet bucket pairs per the locked plan: Kelvin, Lumens, Wattage, Voltage — exact value + `_bucket`; everything else exact-only
- `custitem_xo_keywords`, compliance set (`custitem_xo_prop65`, `custitem_xo_prop65_desc`, `custitem_xo_title20`, `custitem_xo_title24`)

### E. Entry forms (unchanged from locked plan)
Four category-specific custom entry forms — Fan, Decorative/Fixture, Bulb/Lamp, Commercial/Utility — as pure display layers over the single flat item record. `STANDARDINVENTORYPARTFORM` entryForm objects + `itemcustomfield` objects ship together in one SDF Account Customization Project. Fan form field list is confirmed per Finding 8 (verified Aug 21).

### F. Script & saved-search impact
Because A and B preserve scriptids, script exposure narrows to exactly two surfaces:
1. **Fields being retired (C):** inventory every reference before inactivation. Method: grep the SDF project source for each retiring scriptid; for saved searches, the field record's "Used in Searches" audit in the UI (custom field usage is not SuiteQL-queryable — UI is the source of truth, per prior learning). Replace or remove references, then inactivate.
2. **Sourcing logic:** anything that *writes* these fields from the LA/Zastro pipeline (CSV import maps, Zastro scheduled scripts, any UE reading LA fields as triggers). These get rewritten against XO columns or retired with the integration (Part 3). Known watch item: `dropship_check_ue.js` reads item fields at order time — confirm none of its reads sit in the retire list before its redeployment.

Sequence: freeze LA imports → deploy SDF (fields, then forms) → relabel batch → repoint daily XO ingest to full field set → retire-list reference cleanup → inactivate retired fields.

---

## Part 3 — LightsAmerica retirement from NetSuite

Objective: remove Zastro/LA integration machinery and its duplicative custom records without losing auditability. Order matters — references first, records last.

**Phase 0 — Freeze (at cutover, Sep 1).** Disable all Zastro/LA scheduled script deployments and CSV import jobs. Revoke or disable the LA/Zastro integration user and any token-based auth. Nothing LA writes to NetSuite after this point. FarApp Product sync is already off; confirm it stays off.

**Phase 1 — Snapshot (Sep 1–5).** Before touching anything: SuiteQL export of every LA custom record type's full contents and the three LA identity field values across all items, to CSV, archived to Box alongside `premier-master-context.md`. This is the rollback and the audit trail; after this, deletion costs nothing.

**Phase 2 — Reference sweep (Sep 5–15).**
- Custom records: for each Zastro/LA custom record type, list dependent objects — scripts referencing the record type id, saved searches on the type, custom fields of type List/Record pointing at it, workflows, and any item-field sourcing.
- Scripts: inventory all Zastro-deployed scripts (owner/author on the script records identifies them). Retire deployments first, script records second.
- Saved searches: LA-prefixed and Zastro-created searches — identify which are referenced by scripts or emailed schedules before inactivating.
- Custom lists: LA-era lists feeding retired fields.
- CSV import maps: delete saved LA import maps outright (no downstream references possible).

**Phase 3 — Inactivate (Sep 15–30).** Inactivate (never delete yet): LA custom record types' records, retired custom fields (Part 2C), LA saved searches, Zastro script deployments. Inactivation is fully reversible; run the environment for a soak period on inactive-only.

**Phase 4 — Delete (after 60-day soak, ~Dec 1).** Delete custom record instances, then the record types, then script records and files, then the retired fields — only after two clean months and a second Box snapshot check. Bulk deletes run with any remaining per-save UE scripts disabled (same lesson as the legacy item inactivation: per-record external calls make bulk ops crawl).

**Explicitly out of scope for retirement:** the relabeled `custitem_la_*` fields (they're now XO-sourced live fields), `custitem6`, FarApp order/fulfillment sync.

---

## Tyler escalation list (updated — now five items)
1. Discontinued signaling — resolved via backend flag (confirm it's in the daily export).
2. Net-new items erroring in the delta.
3. Non-selectable attributes in variant options (tiered by customer impact).
4. Custom report/export access.
5. **NEW: XOItemID Excel-mangling in the backend export + Vendor Ship Method mixed value domains + (if it matters for fixtures) verbatim glass detail.**

## Immediate next actions
1. Confirm with Tyler the daily export switches from pricing/qty format to the **backend full-catalog format** (the locked feed-source decision) and add the new escalation items.
2. Approve field dispositions above → cut the SDF ACP.
3. Run the retire-list reference sweep in sandbox first.
