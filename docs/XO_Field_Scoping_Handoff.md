# LA → XO Field Scoping — Handoff to Claude Code

**Premier Lighting / ShopPremier · NetSuite account 7513000 (production), 7513000-SB1 (sandbox)**
**Cutover: September 1, 2026 · Handoff written August 21, 2026**

This document is self-contained. It carries the decisions already made so they aren't relitigated, the evidence behind them, and the work remaining. Companion files: `LA_Field_Scope_Worklist.xlsx` (the 20-field keep list + retire rationale + pricing target state + spec-sheet evidence), `LA_to_XO_Field_Mapping.csv` (all 68 LA feed fields → XO sources), `XO_Cutover_NetSuite_Transition_Plan.md`, `XO_Cutover_Tracker.html`.

---

## 1. What this project is

Premier is ending its LightsAmerica (LA) catalog-data relationship on September 1 and replacing it with XoLogic (XO) as the sole product-data feed. NetSuite is the flat-item master; Shopify is the storefront; the two physical showrooms work directly in the XO back end.

Ownership decided that the LA-era data surface must remain accessible in NetSuite, so the daily XO export expands from pricing/quantity-only to the full field set.

**NetSuite has no customer-facing layer at Premier.** No web store, no customer portal. This matters because it removes an entire class of risk from these decisions — a stale or wrong value in an item field is an internal inconvenience, not a customer-visible defect. Do not reason as though item data reaches customers through NetSuite.

---

## 2. The core mechanic (governs everything below)

**Relabeling a NetSuite custom field preserves its scriptid, internal id, and data history.** Changing a scriptid is not a rename — it creates a new field and orphans the old one, which means a per-field data migration across a ~705,000-row item table plus a reference sweep.

So the question for each surviving field is binary:

- **Relabel** — the field stays `custitem_la_*` forever, only its UI label changes ("UPC", "Finish"). Zero breakage. Cosmetically odd in code.
- **Migrate** — new `custitem_xo_*` field, copy data, update every reference, retire the old. Clean naming. Real work.

The purpose of the sweep described in §6 is to price the migrate option per field so the choice can be made on evidence rather than aesthetics. It is expected that most fields relabel and a small number migrate.

Field-definition changes can be deployed via **SDF (`itemcustomfield` objects in an Account Customization Project)**. CSV import cannot do this — the Import Assistant handles record *data*, not customizations. Deploy matches on scriptid and updates in place, so all relabels ship in one deploy driven off the mapping CSV.

---

## 3. Decisions already locked — do not reopen

| Decision | Detail |
|---|---|
| **Field count** | 126 `custitem_la_*` fields exist. **20 survive** (worklist sheet 1). The rest retire. Jesse's rationale: anything a customer sees lives on Shopify or the XO back end, which sales staff use directly for walk-ins. Deep spec history in NetSuite is not worth carrying. |
| **Pricing goes native** | Retire `custitem_la_cost`, `custitem_la_price`, `custitem_la_list_price`. Target state is two concepts: what we buy it at (`itemvendor.purchaseprice`) and what the manufacturer says we sell at (price level 1, "MSRP"). One-offs handled at transaction level. No customer pricing, no quantity pricing. |
| **Manufacturer name retires** | `custitem_la_manufacturer_name` (609,158 populated) carries no transactional value — the vendor table and Preferred Vendor / multi-vendor feature are the real record. |
| **Drop ship retires** | `custitem_la_drop_ship` is redundant with native `isdropshipitem`, and even that is rarely usable because Premier items that can be drop-shipped can also be direct-ordered. |
| **Spec sheet: keep the non-LA field** | `custitem_spec_sheet_link` survives; `custitem_la_spec_sheet` retires. Point XO at the surviving field. **Also retire workflow `customworkflow59` ("Premier - Link Spec Sheet", RELEASED)** — its only job is copying LA → hyperlink. Evidence in worklist sheet 4. |
| **Product URL: XO-sourced, overwrite in place** | Repurposed to hold the XO item URL for internal staff lookup. Sourced from XO `Item URL`, which arrives as a **relative path** (`/brand-minka-lavery/...`) — the pipeline must prepend the XO domain. No blanking pass; XO overwrites LA values as it goes. This is **on** Tyler's feed request list. |
| **custitem7** | "XO Item ID", sourced from XO's `ItemID` column — **not** `XOItemID`, which is a `{VendorID}-{VItemID}` composite that arrives Excel-date-mangled in XO's own export (164 of 1,683 sample rows: `10-93` → `Oct-93`). |
| **custitem5 / custitem6** | `custitem5` is empty (0 populated) → repurpose as IMAP. `custitem6` "Is Light Bulb" is load-bearing (703,779 populated, and a transaction column `custcol_premier_is_bulb` sources from it) → **never rename**. |
| **Price level 9** | "Premier Sample Item" (430,830 rows) is an internal $0.00 decorative-sample process wrapped into a marketing write-off. Never an LA function. Out of scope — XO neither reads nor writes it. |
| **FarApp is not a constraint** | Jesse owns the connector; remapping a field is a few clicks and a save. Do not treat FarApp references as a reason to prefer relabel over migrate. |

---

## 4. The 20 surviving fields

Full detail in `LA_Field_Scope_Worklist.xlsx` sheet "Keep - Scope Worklist". Summary:

`custitem_la_height` (624,956) · `custitem_la_product_name` (604,361) · `custitem_la_collection` (557,531) · `custitem_la_image` (532,297) · `custitem_la_product_url` (519,337) · `custitem_la_number_of_bulbs` (481,850) · `custitem_la_bulb_base` (474,256) · `custitem_la_safety_listing` (462,417) · `custitem_la_safety_rating` (457,590) · `custitem_la_bulb_type` (427,670) · `custitem_la_voltage` (405,266) · `custitem_la_material` (397,763) · `custitem_la_finish` (328,447) · `custitem_la_width` (316,000) · `custitem_la_length` (310,721) · `custitem_la_upc` (276,925) · `custitem_la_color_temperature` (222,579) · `custitem_la_light_output` (211,307) · `custitem_la_cri` (196,510) · `custitem_la_dimmable` (183,385)

Two carry a naming inversion that must be fixed at relabel time, confirmed on paired real data:
- **`custitem_la_safety_listing`** actually holds the *safety* rating (ETL/UL) → XO `Extra-Safety Rating`.
- **`custitem_la_safety_rating`** actually holds the *location* rating (Damp/Wet) → XO `Extra-Location Rating`.

One unresolved duplicate: **`custitem_la_finish` (328,447, added 02/04/2026) vs `custitem_la_manufacturer_finish` (323,188, 2022-era)**. The plan keeps the newer one, but run a join check first — if a meaningful set of items has one and not the other, the newer field alone loses data. There is a whole second generation of LA fields added 02/04/2026 (`la_active`, `la_cost`, `la_country_of_origin`, `la_finish`, `la_inactivedate`, `la_price`, `la_upc`, `la_width`) that partially duplicates the 2022 set; `la_width` (316,000) vs `la_width_diameter` (80,885) is the same pattern, already resolved in favor of the newer.

---

## 5. Confirmed references found so far

Only three, all verified in production, all via the `customfield.source` column:

| Item field | Referenced by | Type |
|---|---|---|
| `custitem_la_image` ("Image") | transaction column `custcol_pr_prod_url` ("frProduct URL") | field sourcing |
| `custitem_la_product_url` ("Product URL") | transaction column `custcol_webstore_link` ("Webstore Link") | field sourcing |
| `custitem_spec_sheet_link` ("Spec Sheet Hyperlink") | transaction column `custcol_spec_sheet` ("Spec Sheet") | field sourcing |

Sourcing is stored by internal field id, so **relabeling is safe; a scriptid migration breaks these**. Note the third one is on the *surviving* non-LA field, so it is unaffected by LA retirement.

Everything else is unverified. The sweep is what closes that gap.

---

## 6. The work ahead — the reference sweep

Goal: a matrix of **field scriptid × reference count**, split by surface, so each of the 20 fields can be priced for relabel-vs-migrate, and so the 106 retiring fields can be safely inactivated.

### 6a. Saved searches — build the introspection Suitelet

104 Item-type saved searches exist (1,207 total account-wide). Their filter/column definitions are **not** SuiteQL-queryable, so this needs SuiteScript.

Build a Suitelet or Map/Reduce that:
1. Enumerates Item-type saved searches (`ns_listSavedSearches`, or `search.create({type:'savedsearch'})`).
2. `search.load()` each one.
3. Walks `filters`, `filterExpression`, `columns`, and every formula string for the 126 target scriptids.
4. Emits scriptid → [search id, search name, where it appeared].

This also closes a blind spot in the script grep: a script that loads a saved search by ID never names the fields that search uses, so source-grep alone under-counts.

**Constraint to respect:** `runPaged()` throws `UNEXPECTED_ERROR` when date or OR operators appear in filters (learned on the STE work). Prefer `search.load()` + direct property inspection over running the searches.

### 6b. Scripts — File Cabinet pull and grep

`suitecloud file:import` on `/SuiteScripts` (and any other script folders), then grep each scriptid, counting hits per file. Include advanced PDF/HTML templates in the pull — FreeMarker references fields too.

Narrowing already done: **113 script deployments target item record types, collapsing to roughly 20 distinct scripts, most SuiteApp-owned** (SCM, STE, LRC, FarApp). Account-wide there are 1,269 non-SuiteApp-owned scripts, but the item-deployed set is the high-probability surface. Do not skip the rest — a scheduled script or Map/Reduce deployed on nothing can still search items.

Known script to check explicitly: **`dropship_check_ue.js`** (`CUSTOMDEPLOY_DROPSHIP_CHECK_UE`) — confirm it reads none of the retiring fields before its redeploy. It has an open unrelated bug (`getText()` on a `setValue`-created select field throws; use `getValue`).

### 6c. Workflows — 5 active, audit by hand

Item-scoped and active: `customworkflow31` (Internal ID as Display Name), `customworkflow42` (Preferred Vendor Mandatory), `customworkflow59` (Premier - Link Spec Sheet — already slated for retirement), `customworkflow35` (Set Item Defaults). Plus `customworkflow_la_sku_to_item` (TESTING, on the Zastro custom record). Three others are already inactive.

`object:import --type workflow` and grep the XML, or just read four workflows in the UI — at this volume either is fine.

### 6d. Forms and templates

Import `entryForm` objects and grep. Also relevant to the four planned category entry forms (Fan / Decorative-Fixture / Bulb-Lamp / Commercial-Utility), which ship as `entryForm` objects over `STANDARDINVENTORYPARTFORM` in the same ACP.

### 6e. Not greppable — inventory by hand

- **FarApp connector mapping** (references `custitem_la_upc`, and `custitem_la_manufacturer_name` which is retiring — remap before retirement).
- **Saved CSV import maps** (Setup → Import/Export → Saved CSV Imports).
- Any external SOAP/REST caller sending field IDs in a payload.

---

## 7. Environment notes that will save time

**Corrections to prior project documentation** (both were wrong; the notes have been updated but older docs may still say otherwise):
- **`customfield` IS SuiteQL-queryable.** Prior notes said custom-field labels/types were not reachable and required the UI. They are: `SELECT internalid, scriptid, name, fieldvaluetype, source FROM customfield WHERE fieldtype = 'ITEM'`. The `source` column is how the three references in §5 were found. What remains unreachable is SuiteApp-*owned custom record* tables (STE, FAM).
- **`custitem_la_manufacturer_number` has 244 populated rows** out of 705,311, and native `mpn` has 20. Earlier mapping work treated it as the MPN field. It is effectively unused — the real manufacturer number is elsewhere (likely `vendorname`, 399,869 populated). Do not build against it without checking.

**SuiteQL quirks hit during this analysis:**
- Joining `employee` fails with `Record 'employee' was not found` — that is a **role permission mask on the executing role**, not missing data. Same class of error as the Cash 360 `term` failure. Drop the join or fix the role.
- `GROUP BY` on some columns and `REGEXP_SUBSTR` both return `An unexpected SuiteScript error has occurred`. Use `SUM(CASE WHEN ... THEN 1 ELSE 0 END)` aggregates instead — they work reliably.
- `SELECT *` on `item` returns all mapped `custitem_*` columns; `ns_getSuiteQLMetadata` misses custom fields entirely.
- Oracle syntax: `||` concatenation, `NVL`, `TO_DATE`, `ROWNUM`. IN-lists cap at 1,000 values.

**SDF conventions (learned the hard way):**
- Imported `itemcustomfield` objects may carry `<ismatrixoption>F</ismatrixoption>`, which reintroduces the **MATRIXITEMS** feature dependency into `manifest.xml`. **Premier does not have MATRIXITEMS enabled** — strip it after every import or validation fails. Same for `appliestovendor`→ACCOUNTING and `appliestopartner`→CRM.
- `displaytype` value `DISABLED` is invalid in SDF even though the UI offers it. Use `NORMAL` or `INLINE`.
- Deploy replaces the whole object, not just the changed element — import close to deploy time or UI edits made in between get overwritten.
- Saved searches are not reliably hand-authorable in SDF; create them via a re-runnable SuiteScript instead.
- Import-before-hand-authoring for any object type not previously authored successfully.

**Bulk operation discipline:** `FA | UE Sync - Update FA` fires on every item save including Mass Update and Map/Reduce, making an external HTTP call per record (~5s). Disable it plus `Update FA Map/Reduce` and `Update NS Map/Reduce` before any bulk item operation. This does **not** apply to field-definition deploys, which don't touch item records.

---

## 8. Sequence

1. Run the sweep (§6) — sandbox first.
2. Produce the reference matrix; decide relabel-vs-migrate per field.
3. Resolve the `la_finish` / `la_manufacturer_finish` join check.
4. Cut the SDF ACP: new `custitem_xo_*` fields first, then relabels, then the four entry forms (fields deploy before forms).
5. Repoint the XO ingest to the full field set.
6. Reference cleanup on the 106 retiring fields, then inactivate (never delete at first).
7. Sep 1: freeze LA (disable Zastro scheduled scripts and CSV imports, disable the integration user), SuiteQL snapshot of LA custom records to Box, then the phased retirement — sweep (Sep 5–15) → inactivate (Sep 15–30) → 60-day soak → delete ~Dec 1.

---

## 9. Open items

- **`la_finish` vs `la_manufacturer_finish` join check** — blocks finalizing the 20-field list.
- **Tyler (XoLogic) escalations:** XOItemID Excel-mangling in the backend export; `Vendor Ship Method` mixed value domains (`Yes/No` vs `UPS/Small Parcel/Truck` depending on source file); net-new items erroring in the delta; non-selectable attributes modeled as variant options; custom report/export access. Also confirm the daily export switches to the **backend full-catalog format** (it has the explicit `Discontinued` flag and the normalized `Standard-*` facets; the Shopify-format feed has neither).
- **Fan entry form** is unblocked — fan fields verified on a 1,308-row Minka-Aire export. Traps: XO calls blade span "Blade Sweep"; `Extra-Reversible Blades` is two-sided blade finish and must **never** be coalesced with `Extra-Reverse Capable` (motor direction); downrod data arrives under three naming schemes.
- **Ingest rules for the pipeline rewrite:** coalesce case/spelling duplicate columns (`Number of Bulbs` / `Number Of Bulbs`, downrod variants); `Extra-Chain Included` holds lengths, not booleans; strip embedded units (`60 W`, `120 V`); match document files on `FileDescr` keyword, never file-1/2/3 slot index (positions are random); GTIN arrives 14-digit with leading zeros.
