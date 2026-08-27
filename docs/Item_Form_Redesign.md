# Item Form Redesign — Proposal

**Status:** decisions taken 2026-08-27 (see §8) · drafting toward execution · evidence from production SuiteQL (705,357 items), the SB1 form export, and `data/XO_Reference_Matrix.csv`
**Scope:** the inventory-item entry form (`custform_217_7513000_136`, working copy in SB1) — field *placement*, *visibility*, and *consolidation* — plus the retirement of the internal-ID conventions on Display Name and UPC Code. The LA retirement schedule stands unchanged.

---

## 1. The principle

The form should let anyone — sales, PC, purchasing, accounting, a new hire — find an item fact where they would naturally look, without a map:

| If you want… | You look on… |
|---|---|
| what it is — name, number, brand, collection, finish, picture | **the top of the form** |
| what we sell it for | **Sales / Pricing** |
| what we buy it for, from whom, how it ships, whether the vendor has it | **Purchasing / Inventory** |
| how it books and how it's taxed | **Accounting** |
| how big / bright / rated it is | **Specifications** |
| what the integrations know about it | **Integrations** |
| what's happened with it | **Related Records & Analytics** |

Four rules follow:

1. **One home per fact.** No `Manufacturer` *and* `Manufacturer Name` *and* `Vendor Name`.
2. **Native first.** If NetSuite has a field for it, that field is the home. A custom duplicate of a native field is a defect, whatever its row count.
3. **Populated ≠ needed.** A field earns its place by being *used* — by a person, a script, or a connected record. Convention-copies and integration side-effects don't count.
4. **NetSuite has no external visibility.** Customers see Shopify; walk-ins see the XO platform. The item record exists to *transact and account*. Anything that isn't needed to identify, buy, sell, or book an item is a candidate to leave — keeping it to keep it means its days are numbered.

---

## 2. Diagnosis — what the current form is

**19 subtabs, ~300 fields, and the important ones are hidden by the unimportant ones.**

| Symptom | Evidence |
|---|---|
| **"Custom" is a 114-field dump** | No field groups; integration creation order. It hides the 6 fields people need (Material, IMAP, Special Order Product, Is Light Bulb, XO Item ID, Non-Taxable) among ~100 retiring LA fields. |
| **"Item Details / XO" is a second dump** | 51 ungrouped fields. Identity (Product Name, UPC, Collection, Finish, Image) sits beside sync timestamps and search-facet buckets. |
| **Zastro duplicated native fields and left the natives bare** | native `manufacturer` **1,649** vs `la_manufacturer_name` 609,162 · native `mpn` **20** · native `countryofmanufacture` **3** · native Item Weight **452** vs LA weight fields 49,648 · native Drop Ship Item 2 vs LA Drop_Ship 498,489 |
| **The two native "name/code" fields hold internal IDs by convention** | Display Name = internal ID on **532,040** items (`customworkflow31` → `customscript_internal_as_code`); UPC Code = internal ID on **327,951** of 395,616 (`customworkflow35` formula + `pl_displayname.js` + `_jww_upc_fill`). Only 3,232 UPC Codes look like UPCs. The LA pipeline fought the convention by writing real UPCs into the same field → 192,743 conflicting values. **The only human-readable product name in the system is the custom `Product Name` field, and it's on the second dump subtab.** |
| **Vendor Name/Code = Item Name on 398,951** | `customworkflow35` copies Item Name into it. Harmless (Item Name *is* the vendor SKU at Premier) but it is not the vendor's name. |
| **Six subtabs carry nothing** | Web Store: 0 online, 0 store descriptions, 0 keywords, 218 display names — Premier has no NetSuite web store. Preferences: `Offer Support` is workflow-forced TRUE. Merchandise Hierarchy: feature off, 0 versions. Hazmat: lighting. Customer Part Number / Item Substitution: SCM sublists, expected empty (verify in UI). |
| **Three "Item URL" fields on one form** | `custitem_zastro_image_url` "Item URL" (1 value) · `custitem_la_product_url` shown as "Item URL (2)" (519k) · `custitem_webstore_link` (0). |
| **Classification is unused natively; the real taxonomy floats** | Class 3,896 · Department 1,330 · Location 2,502 — while Atlas `Style` (66 values, 168,004 items) sits ungrouped in the main area beside `Close-Out` (3 TRUE), `Season` (33), a duplicate Atlas `Department` (0), and a tax-bundle `Item Category` (1). |
| Horizontal scrolling | tabs with 50–114 ungrouped fields and 6-column sublists. Fixed by consolidation, not by widening. |

### What the internal-ID convention was for

Display Name = internal ID exists so a short code could be typed on transaction lines instead of long vendor SKUs; UPC Code = internal ID exists so warehouse labels (`mag_sl_print_label_form.js`) could barcode that same short key. It was built to avoid learning the item record. The cost: the field literally named *Universal Product Code* holds nothing universal, the field named *Display Name* displays nothing, the warehouse can't scan a real product barcode, and every printed document shows a number instead of a name. **This rollout retires the convention** (§5, Track B) and replaces it with data that is searchable, reportable, and still fast to key — the vendor SKU that *is* the Item Name.

---

## 3. Proposed structure — 19 subtabs → 8

### Main area

| Group | Fields (in order) | Notes |
|---|---|---|
| **Primary Information** (native) | Item Name/Number · **Display Name** *(Track B target: the product name)* · **UPC Code** *(Track B target: the real GTIN)* · Vendor Name/Code → label **"Vendor Code"** · Subitem Of · Internal ID | Until Track B lands, `Product Name` (`custitem_la_product_name`) and `UPC / GTIN` (`custitem_la_upc`) sit here **directly beside their native targets** so the redundancy is visible and the cutover is a one-field move. The five UOM fields leave the main area (→ Purchasing). |
| **Catalog** (new) | **Manufacturer** (native, ← XO Vendor Name) · **Collection** · **Finish** · **Style** (XO Style) · **Primary Image** · **Item URL** | The "which line, what does it look like" group. Native `manufacturer` takes over from the retired `la_manufacturer_name` at no cost. |
| **Classification** (native) | Subsidiary · Class · Department · Location · **Is Light Bulb** · Inactive | `Is Light Bulb` (`custitem6`) is a category flag feeding `custcol_premier_is_bulb`. Close-Out, Season, Atlas Department, Item Category, BlueCollar File Attachment leave this group (§4). Class keeps its current meaning (customer category) — see §8. |

### Subtabs

**1. Purchasing / Inventory** — *what we buy, from whom, and where it is*

| Group | Fields |
|---|---|
| Item / Cost Detail (native) | Purchase Price · Last Purchase Price · Purchase Description · Costing Method · Average Cost · Total Value · Track Landed Cost · Stock Description · Drop Ship Item · Special Order Item · **[Special Order Product → renamed, §6]** · Match Bill To Receipt |
| **XO Availability & Ordering** (new) | **XO In Stock** · **Back Order Date** · **Order Minimum** · **Order Multiple** · **Vendor Discounted Cost** · **Cost With Shipping** |
| **Units** (new, from main area) | Primary Units Type · Base Unit · Stock Unit · Sale Unit · Purchase Unit |
| Manufacturing (native) | Manufacturer (mirror) · MPN (optional feed from XO Item Number) · ~~Manufacturer Country~~ *hidden — COO is not transactionally needed in NetSuite; it lives on Shopify and the XO platform* |
| Inventory Management · Vendor Bill Matching (native) | as-is |
| Sublists | Vendors · Locations · Bin Numbers · **Inventory Detail / Numbers / Statuses** (absorbed) · **Landed Cost Template Mapping** (absorbed) |

**2. Sales / Pricing** — *what we sell it for and how it ships*

| Group | Fields |
|---|---|
| Sales (native) | Sales Description · Cost Estimate Type · Item Defined Cost · Soft Descriptor · Min / Max Quantity |
| **MAP Pricing** (new) | **IMAP** (`custitem5`) · **XO UMAP** |
| Pricing (native) | price-level matrix (MSRP is the record) · Quantity Pricing Schedule |
| Shipping (native) | **Item Weight** — *the one and only weight field*, fed from XO Ship Weight (99% fill); all custom weight fields retire. This is what lets a warehouse scale and ship-from-NetSuite happen later. · Package · Ships Individually · Shipping / Handling Cost · Schedule B |

**3. Specifications** — *descriptive knowledge* (rename of "Item Details / XO Logic Data", custom subtab `custtab_25_t2379072_560`)

| Group | Fields |
|---|---|
| Dimensions | **Width** · **Height** · **Length** |
| Lighting | **Bulb Type** · **Bulb Base** · **Number of Bulbs** · **Wattage** · **Kelvin** · **Lumens** · **CRI** · **Voltage** · **Dimmable** |
| Materials | **Material** |
| Ratings & Compliance | **Safety Rating** (ETL/UL) · **Location Rating** (Damp/Wet) · **Prop 65** · **Prop 65 Description** · **Title 20** · **Title 24** |
| Documents | **Spec Sheet Hyperlink** |

The four facet buckets (Kelvin / Lumens / Wattage / Voltage Bucket) are search facets, not reading material — fields stay, **hidden from the form**.

**4. Accounting** — *how it books* (+ Tax absorbed)

| Group | Fields |
|---|---|
| Accounts (native) | as-is |
| **Tax** (from the Tax tab) | Tax Schedule · Tax Item Type · OSS Tax Schedule · Tax Schedule Coaching Text · **Non-Taxable** |
| Currency | as-is |

**5. Integrations** — *technical information* (new custom subtab; replaces the Shopify tab)

| Group | Fields |
|---|---|
| Shopify | Shopify Flag · Shopify Store · Sync Shopify · Handle · Meta Title · Meta Description · Metafield 1 · Product Type · Requires Shipping · Tags · Allow Backorders · Published At · Published Scope · isonline · List On Shopify Temporary Field · Leaves Shopify Inventory |
| XO Sync | **XO Item ID** · **XO Last / Availability / Catalog / Price Changed** · **XO Keywords** |
| NetSuite Connector | Last Posted to NetSuite Connector · *sublist:* NetSuite Connector Synced Items |

**6. Related Records & Analytics** — Transactions sublist **+ the six Item360 sublists** (Sales & Margin, 3-Way Match, Historical Item Sales, Open SOs, Open POs, Monthly Qty Sold). Item360 has real value and is currently lost in the tab strip; beside Transactions it becomes the natural "what has this item done" tab — and a place to give Cash360 some oxygen. The Atlas sublists are custom sublists, so they move with Move Elements like any other.

**7. Communication** — Events · Tasks · Phone Calls · **Files** · User Notes. `BlueCollar File Attachment` (PM add-on) joins Files here.

**8. System Information** — as-is.

### Hidden

| Subtab | Why |
|---|---|
| **Custom** | empty once 6 keepers move and ~100 retiring fields are hidden |
| **Web Store** | no NetSuite web store — 0 / 0 / 0 |
| **Preferences** | `Offer Support` workflow-forced; `Adv. Partners` unused |
| **Merchandise Hierarchy** | feature off |
| **Hazmat / Dangerous Goods** | lighting |
| **Item360** | folded into Related Records & Analytics |
| **Inventory Detail · Tax · Landed Cost Templates · Shopify** | absorbed |
| **Customer Part Number · Item Substitution** | SCM sublists — verify empty in UI, then hide |

---

## 4. Field-by-field moves

Executable version: `docs/item_form_layout_proposal.csv` (one row per field: current tab → proposed tab → group → action). The non-obvious ones:

| Field | Today | Proposed | Why |
|---|---|---|---|
| Product Name (`custitem_la_product_name`) | Item Details/XO | Main › Primary Information, beside Display Name | the only real name; **Track B target = native Display Name** |
| UPC / GTIN (`custitem_la_upc`) | Item Details/XO | Main › Primary Information, beside UPC Code | **Track B target = native UPC Code** |
| Collection · Finish · Primary Image · Item URL | Item Details/XO | Main › Catalog | how staff recognise a fixture |
| Style (`custitem_atlas_style`) | Main, ungrouped | Main › Catalog | 66-value taxonomy |
| Five UOM fields | Main › Primary Information | Purchasing › Units | frees the top for primary facts |
| Material | Custom | Specifications › Materials | spec |
| IMAP (`custitem5`) · XO UMAP | Custom / XO | Sales › MAP Pricing | price floors |
| Special Order Product | Custom | Purchasing › Item/Cost Detail (renamed, §6) | workflow gate |
| Is Light Bulb (`custitem6`) | Custom | Main › Classification | category flag |
| Non-Taxable | Custom | Accounting › Tax | tax |
| XO Item ID · Last Posted to Connector | Custom | Integrations | sync keys |
| XO availability/order/cost ×6 | Item Details/XO | Purchasing › XO Availability & Ordering | procurement |
| XO change dates ×4 · XO Keywords | Item Details/XO | Integrations › XO Sync | sync metadata |
| Facet buckets ×4 | Item Details/XO | *hidden* (fields kept) | search facets |
| Item360 sublists ×6 | Item360 tab | Related Records & Analytics | see §3.6 |
| Manufacturer Country (native) | Purchasing › Manufacturing | *hidden* | COO not needed in NetSuite |
| BlueCollar File Attachment | Main › Classification | Communication | it's a file |
| Close-Out · Season · Atlas Department · Item Category · Item Image (Atlas) · Publish Item · EM Product · Item Options | Main / Custom | *hidden* | 3 / 33 / 0 / 1 / 3 / 0 / 1 / unused |
| `zastro_image_url` · `webstore_link` · `no_of_bulbs` (135) · `zastro_warranty` · `la_umap` · all custom weight fields | Custom / XO | *hidden → retire* | duplicates with no or worse data |
| every other LA field on Custom / XO | Custom / XO | *hidden → inactivate Phase 5* | per `XO_Reference_Matrix.csv` |

---

## 5. Native-first consolidation

### Track A — with the form redesign (ingest mapping only; no scriptid changes)

| Native field | Feed from XO | Today | Replaces |
|---|---|---|---|
| `manufacturer` | Vendor Name | 1,649 | `la_manufacturer_name` (retiring) |
| `weight` (Item Weight) | Extra-Ship Weight | 452 | `la_weight_grams`, `custitemcustitem_la_weight` (retiring). **The single weight field.** Confirm XO unit (lb vs kg) against NetSuite's weight unit. |
| `mpn` | Item Number | 20 | optional — Item Name/Number already *is* the vendor SKU |

Not doing: `countryofmanufacture` (COO stays on Shopify/XO; hide the native field) · `class` as product taxonomy (tabled — see §8).

### Track B — retire the internal-ID convention (Display Name & UPC Code)

**Target state:** Display Name = the product name (from XO `Item Name`); UPC Code = the real GTIN (from XO `GTIN`); the internal ID is looked up as what it is — `internalid` — wherever a system needs it. `custitem_la_product_name` and `custitem_la_upc` then become redundant and retire, taking the survivor list from 21 to 19. Fast entry on transactions is preserved by the Item Name/Number (the vendor SKU) and, for the warehouse, by scanning a barcode that is finally a real barcode.

**Everything wired to the convention (from the corpus + workflow XML):**

| Dependency | Kind | Change |
|---|---|---|
| `customworkflow31` "Internal ID as Display Name" → `customscript_internal_as_code` (WFA; script 581, file id 5319 - **not under /SuiteScripts**, locate in the File Cabinet before switch-off) | writer | inactivate both |
| `customworkflow35` "Set Item Defaults" — action `UPC Code = TO_CHAR({internalid})` | writer | delete the action (keep Use Bins; review Offer Support; keep the Special Order Product default — §6) |
| `customworkflow35` — action `Vendor Name = Item Name` | writer | keep (harmless, useful as Vendor Code) or delete — Jesse's call |
| `pl_displayname.js` (WFA) — forces UPC Code = internal ID via `submitFields` | writer | inactivate |
| `_jww_upc_fill` (MR) — backfilled UPC Code = internal ID | writer | delete |
| `update_price_only.js` (LA pipeline) — wrote real UPCs into UPC Code | writer | retires Sep 1 anyway |
| `mag_sl_print_label_form.js` — barcodes `upccode` on warehouse labels | reader | switch the barcode source to `internalid` explicitly **or** to the real UPC — a warehouse decision (see §8) |
| `pl_salesOrdItemLabel_sl.js` — prints `displayname` on SO item labels | reader | will print the product name; add `internalid`/Item Name if the label needs the key |
| 6 advanced PDF templates print `displayname` (`custtmpl_cycle_count_print`, `custtmpl_if_with_iinternalid`, `custtmpl_suitetax_invoice_1106`, `custtmpl_113`, `_225`, `_241`) | readers | invoices/IFs *want* a name — improvement. Cycle-count sheets may want the key: use `{item.internalid}` or Item Name there. |
| `inventory_portlet.js`, `suitelet_generate_code.js`, `item record report.js`, `Unified Catalog Analysis.js` | readers | display-only; will show names |
| FarApp connector barcode mapping → `custitem_la_upc` | mapping | repoint to native `upccode` (Jesse-owned, a few clicks) |
| Saved searches: 3 on `la_product_name`, 3 on `la_upc`, **0** on `displayname`/`upccode` by ID | searches | repoint the 6 at cutover |
| XO ingest | mapping | `Item Name` → `displayname`; `GTIN` → `upccode` (store the 14-digit GTIN as-is) |
| Transaction-line entry habit (typing the internal ID) | people | replaced by typing the Item Name / vendor SKU, which auto-completes; communicate before flipping |

**Backfill (one bulk pass, FA UE sync scripts disabled):** `displayname` ← `custitem_la_product_name` where present (604k); `upccode` ← `custitem_la_upc` where present (276,929), **blank** where no GTIN exists — an honest empty beats a fake code. Then the item-level defaults stop re-polluting.

**Sequencing:** the writers must be switched off *before* the backfill or the workflows undo it on the next save. Recommended window: immediately after the Sep 1 LA freeze (the LA writer is gone, the XO feed is live to keep the natives fed).

---

## 6. Special Order Product — rename, don't migrate

`custitem_zastro_special_order` (683,902 TRUE) is **not** a copy of native Special Order Item. It is the eligibility gate for Premier's purchasing/consolidation workflow: without it an item cannot enter the flow that creates the consolidation custom records and routes received goods to the right order. `customworkflow35` defaults it TRUE for exactly that reason. Zastro just named it lazily. It stays, stays TRUE-by-default, and stays in Purchasing › Item/Cost Detail — under a name that says what it does. Candidates: **"Purchasing Workflow Eligible"**, **"Consolidation Eligible"**, **"Order-In Item"**. Native Special Order Item (9 TRUE) keeps its NetSuite meaning.

---

## 7. How to execute

1. **Subtabs & field defaults (SDF — deploys to every account):** relabel `custtab_25_t2379072_560` → "Specifications"; add subtab `custtab_xo_integrations` "Integrations"; set `<subtab>` on every surviving custom field to its §3 home. `subtab` objects and field placement *are* SDF-deployable (forms are not). Ship with the next ACP deploy.
2. **Form (UI, once):** Customize → **Move Elements** to build the groups (Catalog · Units · XO Availability & Ordering · MAP Pricing · Tax · XO Sync · Shopify · NetSuite Connector), fold Item360 into Related Records & Analytics, uncheck *Show* on the hidden subtabs, relabel Vendor Name/Code. Then **Copy to Account** → RP2, prod. One session, not three.
3. **Ingest spec (Tyler):** add `manufacturer`, `weight`, and — for Track B — `displayname`, `upccode` as native targets.
4. **Track B switch-off + backfill** in the post-Sep-1 window (§5), after the label/template decision in §8.
5. **Retirement** continues per the transition plan; hiding on the form is step zero of inactivation and free to reverse.

---

## 8. Decisions

**Resolved 2026-08-27 (Jesse):**

| # | Decision |
|---|---|
| 1 | **Two tabs**: Specifications (descriptive knowledge) + Integrations (technical information) — mirrors Purchasing (in) / Sales (out). |
| 2 | **Class stays as-is.** It means customer category (Commercial / Retail / E-Commerce) and is baked into scripts, workflows, and people. Right idea, wrong moment — tabled, not rejected. |
| 3 | **Special Order Product does not migrate** — it's a misnamed workflow gate (§6). Rename only. |
| 4 | **Item360 folds into Related Records** (& Analytics). Used, valuable, currently lost. |
| 5 | **UOM fields → Purchasing.** |
| 6 | **Item Weight is the single weight field**, XO-fed — for a future warehouse scale / ship-from-NetSuite. |
| 7 | **COO does not live in NetSuite** — Shopify and XO carry it for anyone who needs it. Hide the native field, drop the ingest. |
| 8 | **Display Name / UPC Code convention retires** (Track B) — a multi-department decision already in motion; this rollout is the vehicle. |
| 9 | Form built once via Move Elements, distributed with **Copy to Account**. |

**Still open:**

| # | Question | Needed by |
|---|---|---|
| A | New name for `custitem_zastro_special_order` | before the relabel ACP |
| B | Warehouse labels: barcode the **internal ID** (as today, but sourced honestly from `internalid`) or the **real UPC**? Affects `mag_sl_print_label_form.js` and the cycle-count template. | before Track B backfill |
| C | Keep the `Vendor Name = Item Name` default in workflow35? | before Track B |
| D | Track B timing: the week after Sep 1 (recommended — LA writers gone, XO feed live) or later in September | scheduling |

---

## 9. Why now

NetSuite at Premier has no customer-facing surface. The item record's job is to let people transact and account accurately and let automation run on data that means what it says. Every field that exists because an integration put it there, every native field hollowed out by a custom twin, every "name" that is really a number, is friction on that job — and it is friction that XO, the PM SuiteApp, a Collections department, and NetSuite Next will all inherit if it isn't cleared now. This is equal parts a visual transformation and a deliberate slimming of the data the form carries, done while the catalog is being re-sourced anyway. The test for every field is the same: *is it needed to identify, buy, sell, or book this item, or by a script or record that does?* If not, its days are numbered.
