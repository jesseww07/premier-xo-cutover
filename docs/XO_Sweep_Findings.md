# XO Cutover — Reference Sweep Findings & Disposition Report
**Run:** August 25, 2026 · production 7513000 (read-only) · SuiteCloud CLI 3.2.0
**Deliverables:** `XO_Reference_Matrix.csv` (175 targets) · `XO_Search_Cleanup_List.csv` (64 searches) · SDF ACP at `C:\Users\JesseWampole\dev\xo-cutover-acp` (31 objects, server-validated clean)

> **Scope note (Jesse, 2026-08-25):** Solupay/Versapay fields, scripts, and searches are a separate vendor and business area — **excluded from this project entirely** and handled separately. This supersedes the handoff's retire-list line that grouped "both Solupay fields" with the LA retirement.

---

## 1. Sweep coverage — how each §6 surface was closed

| Surface | Method | Result |
|---|---|---|
| **6a. Saved searches** | `object:import --type savedsearch` → grep XML. **The introspection Suitelet was not needed** — SDF exports search definitions as greppable XML. | 1,175 of ~1,207 imported (rest bundle-owned/private — see caveat §6). 342 target references found. |
| **6b. Scripts** | `file:import` of /SuiteScripts (350 files) + grep with word-boundary-safe matching | Full matrix; 40 hit-bearing scripts mapped to script records + active status via `script⋈file` SuiteQL join |
| **6c. Workflows** | `object:import --type workflow` (46) → grep + name/status parse | All 5 item workflows classified (below) |
| **6d. Forms & templates** | entryform (40) + advancedpdftemplate (84) imported & grepped | Form refs are display-only (survive relabel; drop harmlessly on inactivate). 1 PDF template ref, relabel-safe. |
| **6e. Not greppable** | — | Remaining manual: FarApp connector mapping (UPC + manufacturer_name remap), Saved CSV Import list, external SOAP/REST callers. Listed in §7. |
| **Sourcing refs** | `customfield.source` SuiteQL, account-wide (165 sourced fields) | §5's three references confirmed as **complete** — plus `custcol_premier_is_bulb`←`custitem6` (known) and one new find (§3.6) |

---

## 2. Blocking open item from the handoff — RESOLVED

**`la_finish` vs `la_manufacturer_finish` join check (was blocking the 20-field list):**

| Bucket | Items |
|---|---|
| `la_finish` only (gen-2) | 209,767 |
| `la_manufacturer_finish` only (2022) | **204,504** |
| Both populated | 118,684 (12,088 differ) |

Keeping the newer field alone **loses finish on 204,504 items**. → **Backfill `la_finish` from `la_manufacturer_finish` where `la_finish` is empty, then retire the old field.** Where both differ, gen-2 wins (newer feed data). Same pattern on the width pair: `la_width_diameter` only = **45,816 items** → same backfill before retiring. (Both are one-time CSV imports or Map/Reduce; remember to disable the FA UE sync scripts during the bulk run, per the standing bulk-op rule.)

## 3. Findings that adjust the plan

1. **Zastro carve-out (the big one).** The retirement plan says "remove Zastro/LA integration machinery." The sweep shows part of that machinery is **live Premier ops, not LA catalog plumbing** — it must be excluded from Part 3 retirement:
   - `customrecord_zastro_po_consolid` ("Unconsolidated Purchase Order") — 14+ live scripts, 44 searches, workflow `customworkflow18` (Generate PO – Consolidated, RELEASED)
   - `customrecord_zastro_unconsolidated_items` — 17+ live scripts, 30 searches
   - `custcolcustcol_zastro_vendor`, `custcol_zastro_purchase_price` — used by the consolidation suite and `Create Sales Order - SL`
   - `customlist_zas_tracking_carrier` — used by the inbound-ESD flow + `custcol_pr_vendor_provided_carrier`
   - `custitem_zastro_special_order` — **683,881 items TRUE**, referenced by `customworkflow35` (Set Item Defaults, RELEASED) + 11 searches. Its only *writers* are the LA pipeline, so after Sep 1 it needs a new writer (or the workflow default carries it for new items — it likely does, that's what workflow35 sets).
2. **What actually retires from the Zastro estate:** `zastro_api_scheduler`, `la_adhoc_queue`, `la_data_dump`, `la_processor_queue`, `lights_file_config`, `lights_items`, `lights_wishlist_cfg`, `po_consolid` stays (above), `la_csv_row`, `manufacturer_mapping` (pipeline-only refs), the 3 `zastro_lights_*` custom lists, workflows `customworkflow59` + `customworkflow_la_sku_to_item`.
3. **`customrecord_zastro_lights_items` retirement dependencies:** `custitem_la_sku` (SELECT into it), **`custcol_la_item_link`** (transaction column "LA Data Dump", SELECT into it — *new find, not in the handoff*), 35 saved searches, and the active MR `Update Display Name` (`customscript804`) reads it. Order: retire fields/column + fix searches + retire/rewrite the MR → then the record type.
4. **`custitem7` ("VendorContactId") holds 11,676 values.** The locked repurpose to XO Item ID stands, but those values get overwritten by the feed — if VendorContactId matters to anything, say so now. No script/search references found for it.
5. **`custitem_atlas_style` is bundle-owned** — SDF can't relabel it. The "XO Style" relabel is a 30-second **UI edit**. (23 searches reference it; relabel preserves internal id, all survive.)
6. **`custitem5`** already carries the label "IMAP", 0 populated — the locked repurpose is effectively pre-done; only feed sourcing remains.
7. **`dropship_check_ue.js` reads none of the retiring fields** (zero grep hits) — tracker t3c cleared. (Its unrelated `getText()` bug still pends before redeploy.)
8. **Keep-20 fields are cheap to relabel everywhere.** Live-script exposure: `la_image` (3 active scripts), `la_color_temperature` + `la_product_url` (2 active reporting scripts). All sourcing/search/form references survive relabel — **relabel wins on evidence for all 20; no field prices out for migrate.**
9. **Two active reporting scripts reference retiring fields** and need updates before inactivation: `Unified Catalog Analysis MR` and `Item Record Quick Report` (both reference `la_list_price`, `la_manufacturer_name/finish/glass/number`; note `la_max_wattage` now survives as Wattage).
10. **Doc conflict resolved per your instruction (handoff is primary):** the transition-plan doc's Part 2A renames ~all mapped LA fields; the handoff locks 20 survivors. The matrix follows the handoff. Consequence to be aware of: heavily-populated fields like `la_bulbs_included` (643,943), `la_max_wattage` (543,145), `la_light_source` (383,890), `la_manufacturer_glass` (414,585), `la_shipped_via` (417,821) retire. The Phase-1 Box snapshot covers their history.

## 4. SDF ACP — fields-only, deployed to sandbox, server validation 0 errors / 0 warnings

`C:\Users\JesseWampole\dev\xo-cutover-acp` — **30 objects (10 relabels + 20 new fields), deployed to 7513000-SB1 on 2026-08-25 and verified via SuiteQL.** Production deploy only on your sign-off. Validates clean under both CLI 4.0.0 (`npx --yes @oracle/suitecloud-cli@latest`) and your global 3.2.0 now that the form is out — the "wall of errors starting with subLists" you saw was 3.2.0's schema choking on the entryform export, a CLI-version artifact, not a project defect.

- **10 relabels** (copied from prod definitions, label+help only; `itemmatrix`/`ismhitemattribute`/`aidescription`/`enabletextenhance` stripped per SDF traps): `la_image`→Primary Image, `la_product_url`→Item URL, `la_safety_listing`→**Safety Rating**, `la_safety_rating`→**Location Rating** (semantics documented in help text), `la_bulb_type`→Bulb Type, `la_upc`→UPC / GTIN, `la_color_temperature`→Kelvin, `la_light_output`→Lumens, **`la_max_wattage`→Wattage (kept per 2026-08-25 decision — the 21st survivor, 543,145 rows)**, `custitem7`→XO Item ID.
- The other keepers already have correct labels — deliberately **not** included (deploy replaces whole objects; minimal set avoids drift).
- **20 new `custitem_xo_*` fields:** XO UMAP (labeled "XO UMAP" — plain "UMAP" collided with legacy `custitem_la_umap` and NetSuite auto-suffixed it "(2)" on the first sandbox pass; fixed and re-deployed), Back Order Date, XO In Stock, Order Multiple/Minimum, change-date quartet, Vendor Discounted Cost, Cost With Shipping, 4 facet buckets (Kelvin/Lumens/Wattage/Voltage — exact values live in the relabeled LA fields), XO Keywords, Prop 65 + Description, Title 20, Title 24. Compliance flags stored as raw text (lossless, no transform risk) — say the word if you want checkboxes instead.
- **SDF deploys are not atomic** — learned the useful way: when the form object failed, all 30 field objects still installed. The fields-only package has no failing member.

### 4a. Entry form via SDF - SOLVED 2026-08-28 (supersedes the 08-25 conclusion)

The 08-25 finding "SDF cannot deploy this account's inventory-item entry form" was too broad. Prompted by the
Help Center pages Jesse added to docs/ (Supported Custom Entry Forms lists STANDARDINVENTORYPARTFORM with no
feature dependency), a 30-deploy bisection in SB1 found the actual cause:

- **Root cause:** NetSuite's export of the form carries the Locations sublist twice under Purchasing/Inventory -
  `<subList id="ITEMLOCATIONS">` and `<subTab id="ITEMLOCATIONS">`. The duplicate subList passes validation but
  fails the server-side install with the opaque "An error occurred during custom object creation/update".
  Every other tab, field group, sublist and the action bar is clean.
- **Fix:** remove the stray subList - `python scripts/fix_form_export.py <export.xml> --scriptid <new_id>`.
  The full form then deploys.
- **Create, don't update:** the fixed form deploys as a NEW form (CREATE) and can then be UPDATED by SDF
  repeatedly (rename + hide-tab test passed). Updating the ORIGINAL UI-created form (`custform_217_7513000_136`)
  still fails even after the fix. So the redesigned form is born in SDF under its own scriptid, deployed to every
  account, set preferred, and the UI-created form retires.
- **Evidence trail:** variants A-J (08-25/08-28) all failed; K (minimal hand-built form) passed; phase-1 bisection
  isolated tab ITEMINVENTORY; phase-2 isolated the ITEMLOCATIONS subList; CONFIRM1 (full fixed form, CREATE) passed;
  CONFIRM2 (UPDATE of UI form) failed; CONFIRM3 (UPDATE of SDF-created form) passed.
- **SB1 housekeeping:** the bisection left inactive test forms `custform_xo_bisect_01..07`, `custform_xo_b2_01..11`,
  `custform_xo_min_test`, `custform_xo_confirm` - delete via Customization > Forms > Entry Forms.
  `custform_xo_confirm` is a working SDF-owned copy of the current SB1 form and can seed the redesigned form.

### 4b. Deployment verification log

**2026-08-27 — verified by `object:import` from each account (authoritative; MCP connectors were token-expired).**

| | SB1 (`7513000-sb1`) | RP2 (`7513000-rp`) | Production |
|---|---|---|---|
| 30 field objects | all present | all present | **not deployed** |
| Field-level labels (10 relabels) | correct | correct | - |
| 20 XO fields on the entry form | yes (NetSuite auto-added) | yes (auto-added) | - |
| Entry-form tab renamed | yes - "Item Details/ XO Logic Data" | no - still "Item Details/ LightsAmerica" | - |
| Form-level label overrides | 6 of 10 done | 0 of 10 done | - |

**`project:deploy --validate` deploys - it is not a dry run.** In SuiteCloud CLI 3.2.0 the flag means
"validates the project *before deploying*"; the deploy still happens. (It was removed in CLI 4.x.) The RP2 run on
2026-08-27 therefore performed a real deploy, which the import above confirms. For a true preview use `--dryrun`.

**Form-level labels are per-account UI state and do NOT travel with the SDF deploy** - entry forms store their own
label overrides. The §4a UI steps must be repeated in every account that needs them (they were done in SB1, not RP2).
Remaining in SB1: `custitem_la_product_url` -> Item URL, `custitem_la_safety_listing` -> **Safety Rating**,
`custitem_la_safety_rating` -> **Location Rating**, `custitem7` -> XO Item ID. The two safety/location ones matter
most - they are the naming inversion, and the form still shows the misleading originals.

**2026-08-28 - placement ACP deployed to SB1 (53 objects: 51 fields + 2 subtabs), verified by re-import.**

| What | Result |
|---|---|
| `custtab_25_t2379072_560` retitled **Specifications** | done (SB1) |
| new subtab `custtab_xo_integrations` **Integrations** | created (SB1) |
| default `<subtab>` set on 49 surviving Premier-owned fields per `docs/Item_Form_Redesign.md` | done (SB1): main-area fields -> `ITEMMAIN`, XO procurement fields + Special Order Product -> `ITEMINVENTORY`, specs -> Specifications, sync/Shopify -> Integrations |
| IMAP (`custitem5`) and XO UMAP | **no SDF default possible** - NetSuite rejects `ITEMPRICING` as a field subtab ("must not be ITEMPRICING"); they default to Custom and the form places them on Sales / Pricing via Move Elements |
| RP2 / production | not yet deployed - same project, same command, different `defaultAuthId` (`RP2` / `7513000`) |

Deploy mechanics, for the record: the **same ACP** carries subtabs + field defaults; the **form** is never imported or deployed - it is built once in SB1 with Move Elements and distributed with Copy to Account.

## 5. Cleanup lists (pre-inactivation work, mapped to tracker Phase 5)

- **64 saved searches** → `XO_Search_Cleanup_List.csv` (search scriptid + title + which retiring targets it uses). Solupay-related searches excluded per the scope note.
- **Scripts to update or retire with the pipeline:** full classification in the matrix `live_references` / `pipeline_refs` columns. Non-pipeline scripts needing edits: `Unified Catalog Analysis MR`, `Item Record Quick Report`, `Update Display Name` (customscript804).
- **FarApp remaps before retirement:** barcode↔`custitem_la_upc` (survives, no rush), `custitem_la_manufacturer_name` (retiring — remap first).
- **Manual surfaces still to inventory by hand:** Saved CSV Imports (Setup → Import/Export), external SOAP/REST callers, email schedules on LA searches.

## 6. Caveats

- ~32 saved searches did not import (bundle-owned or private). The searches that matter for retirement are custom/Premier-owned and did import, but a UI "Used in Searches" spot-check on the 3 LA identity fields before inactivation is cheap insurance.
- Grep matched scriptids; scripts that reference fields by **internal id** (rare, bad practice) would be missed. The `script⋈file` join + deployment inventory (113 item-type deployments, matching the handoff count) bounds this risk.
- Sandbox freshness: ACP validated and deployed against SB1 as-is; prod validation re-run belongs immediately before the prod deploy.

## 7. Immediate next actions

1. ~~Answer the two open design questions~~ — **decided 2026-08-25:** one base entry form now (category variants later); `la_max_wattage` kept and relabeled Wattage (21 survivors).
2. **Jesse:** approve matrix dispositions → prod deploy of ACP: `cd C:\Users\JesseWampole\dev\xo-cutover-acp`, set `project.json` defaultAuthId to `7513000`, then `npx --yes @oracle/suitecloud-cli@latest project:deploy`. Fields-only; the identical package already deployed clean to SB1.
3. Entry form: UI steps in §4a — preview in SB1, repeat in prod after the field deploy.
4. Run the two backfills (finish 204,504 rows, width 45,816) — before Sep 1; disable the FA UE sync scripts during the bulk run.
5. UI relabel `custitem_atlas_style` → "XO Style" (bundle-owned, SDF can't).
6. Tyler escalation list unchanged (5 items, incl. XOItemID mangling + ship-method domains + full-catalog format confirmation).
7. Sep 1 freeze steps per Part 3 (unchanged), with the **Zastro carve-out list from §3 excluded from retirement**.
