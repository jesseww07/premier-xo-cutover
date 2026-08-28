# Inventory Part Form — Redesign

**Scope:** the inventory item entry form — which subtabs exist, which fields show, and where. Nothing here changes data, scripts, or workflows; adjacent processes those changes touch are listed at the end as later work.
**Status:** structure decided 2026-08-27 (§6) · **built and deployed to SB1 2026-08-28 as `custform_xo_inventory_item`** (§5). It is not the preferred form yet — the old `custform_217_7513000_136` is still what users see. Open questions in `XO_Sweep_Findings.md` §4c.

---

## 1. The principle

Anyone — sales, PC, purchasing, accounting, a new hire — finds an item fact where they would naturally look, without a map:

| If you want… | You look on… |
|---|---|
| what it is — name, number, brand, collection, finish, picture | **the top of the form** |
| what we sell it for | **Sales / Pricing** |
| what we buy it for, from whom, how it ships, whether the vendor has it | **Purchasing / Inventory** |
| how it books and how it's taxed | **Accounting** |
| how big / bright / rated it is | **Specifications** |
| what the integrations know about it | **Integrations** |
| what's happened with it | **Related Records & Analytics** |

Rules: **one home per fact** · **native first** · **populated ≠ needed** · **NetSuite has no external visibility** — customers see Shopify, walk-ins see XO; the form exists to identify, buy, sell, and book. Anything not needed for that is a candidate to leave. Keeping it to keep it means its days are numbered.

---

## 2. What the current form is

**19 subtabs, ~300 fields, and the important ones are hidden by the unimportant ones.**

- **"Custom" is a 114-field dump** — no groups, integration order. Six fields people need (Material, IMAP, Special Order Product, Is Light Bulb, XO Item ID, Non-Taxable) buried among ~100 retiring LA fields.
- **"Item Details / XO" is a second dump** — 51 ungrouped fields; identity (Product Name, UPC, Collection, Finish, Image) beside sync timestamps and search-facet buckets.
- **Zastro duplicated native fields and left the natives bare** — native `manufacturer` 1,649 vs `la_manufacturer_name` 609,162; native `mpn` 20; native Item Weight 452 vs LA weight fields 49,648; native Drop Ship 2 vs LA Drop_Ship 498,489.
- **The only human-readable name is the custom `Product Name`** (604k) — and it's on the second dump. Native Display Name holds the internal ID by convention (532,040) and UPC Code holds it too (327,951). Those conventions are a separate, later process (§7); for the *form*, it means Product Name and UPC / GTIN must be on the main area.
- **Six subtabs carry nothing** — Web Store (0 online / 0 store descriptions / 0 keywords), Preferences (`Offer Support` workflow-forced), Merchandise Hierarchy (feature off), Hazmat (lighting), Customer Part Number and Item Substitution (SCM sublists, expected empty — verify in UI).
- **Three "Item URL" fields** on one form; one has data.
- **The real taxonomy floats** — Atlas `Style` (66 values, 168,004 items) sits ungrouped in the main area next to Close-Out (3 TRUE), Season (33), a duplicate Department (0), and a tax-bundle Item Category (1).

---

## 3. Proposed structure — 19 subtabs → 8

### Main area

| Group | Fields (in order) | Notes |
|---|---|---|
| **Primary Information** (native) | Item Name/Number · **Product Name** · Display Name/Code · **UPC / GTIN** · UPC Code · Vendor Name/Code → label **"Vendor Code"** · Subitem Of · Internal ID | Product Name and UPC / GTIN come up from the XO tab and sit beside their native counterparts. The five UOM fields leave the main area (→ Purchasing). |
| **Catalog** (new) | **Manufacturer** (native) · **Collection** · **Finish** · **Style** · **Primary Image** · **Item URL** | "Which line, what does it look like." |
| **Classification** (native) | Subsidiary · Class · Department · Location · **Is Light Bulb** · Inactive | `Is Light Bulb` (`custitem6`) is a category flag feeding `custcol_premier_is_bulb`. Close-Out, Season, Atlas Department, Item Category, BlueCollar File Attachment leave this group. Class keeps its current meaning (customer category). |

### Subtabs

**1. Purchasing / Inventory** — *what we buy, from whom, and where it is*

| Group | Fields |
|---|---|
| Item / Cost Detail (native) | Purchase Price · Last Purchase Price · Purchase Description · Costing Method · Average Cost · Total Value · Track Landed Cost · Stock Description · Drop Ship Item · Special Order Item · **Special Order Product** *(the purchasing-workflow gate; relabel later, see §7)* · Match Bill To Receipt |
| **XO Availability & Ordering** (new) | **XO In Stock** · **Back Order Date** · **Order Minimum** · **Order Multiple** · **Vendor Discounted Cost** · **Cost With Shipping** |
| **Units** (new, from main area) | Primary Units Type · Base Unit · Stock Unit · Sale Unit · Purchase Unit |
| Manufacturing (native) | Manufacturer · MPN · ~~Manufacturer Country~~ *(hidden — COO lives on Shopify / XO, not needed to transact)* |
| Inventory Management · Vendor Bill Matching (native) | as-is |
| Sublists | Vendors · Locations · Bin Numbers · **Inventory Detail / Numbers / Statuses** (absorbed) · **Landed Cost Template Mapping** (absorbed) |

**2. Sales / Pricing** — *what we sell it for and how it ships*

| Group | Fields |
|---|---|
| Sales (native) | Sales Description · Cost Estimate Type · Item Defined Cost · Soft Descriptor · Min / Max Quantity |
| **MAP Pricing** (new) | **IMAP** (`custitem5`) · **XO UMAP** |
| Pricing (native) | price-level matrix · Quantity Pricing Schedule |
| Shipping (native) | **Item Weight** — *the one weight field on the form; every custom weight field goes* · Package · Ships Individually · Shipping / Handling Cost · Schedule B |

**3. Specifications** — *descriptive knowledge* (rename of "Item Details / XO Logic Data", `custtab_25_t2379072_560`)

| Group | Fields |
|---|---|
| Dimensions | **Width** · **Height** · **Length** |
| Lighting | **Bulb Type** · **Bulb Base** · **Number of Bulbs** · **Wattage** · **Kelvin** · **Lumens** · **CRI** · **Voltage** · **Dimmable** |
| Materials | **Material** |
| Ratings & Compliance | **Safety Rating** · **Location Rating** · **Prop 65** · **Prop 65 Description** · **Title 20** · **Title 24** |
| Documents | **Spec Sheet Hyperlink** |

The four facet buckets (Kelvin / Lumens / Wattage / Voltage Bucket) are search facets — fields stay, **hidden from the form**.

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

**6. Related Records & Analytics** — Transactions sublist **+ the six Item360 sublists** (Sales & Margin, 3-Way Match, Historical Item Sales, Open SOs, Open POs, Monthly Qty Sold). Item360 is used and valuable and currently lost in the tab strip.

**7. Communication** — Events · Tasks · Phone Calls · **Files** · User Notes. `BlueCollar File Attachment` joins Files here.

**8. System Information** — as-is.

### Hidden subtabs

Custom (empty after the moves) · Web Store · Preferences · Merchandise Hierarchy · Hazmat / Dangerous Goods · Item360 (folded) · Inventory Detail · Tax · Landed Cost Templates · Shopify (absorbed) · Customer Part Number and Item Substitution (verify empty, then hide).

---

## 4. Field-by-field

Executable version: **`docs/item_form_layout_proposal.csv`** — one row per field: current tab → proposed tab → group → action. The moves that aren't obvious from §3:

| Field | Today | Proposed | Why |
|---|---|---|---|
| Product Name · UPC / GTIN | Item Details/XO | Main › Primary Information | identity; the only real name and the real barcode |
| Collection · Finish · Primary Image · Item URL | Item Details/XO | Main › Catalog | how staff recognise a fixture |
| Style | Main, ungrouped | Main › Catalog | 66-value taxonomy |
| Five UOM fields | Main | Purchasing › Units | frees the top for primary facts |
| Material · Dimmable · Safety Rating · Location Rating | Custom | Specifications | specs |
| IMAP · XO UMAP | Custom / XO | Sales › MAP Pricing | price floors |
| Special Order Product | Custom | Purchasing › Item/Cost Detail | workflow gate |
| Is Light Bulb | Custom | Main › Classification | category flag |
| Non-Taxable | Custom | Accounting › Tax | tax |
| XO Item ID · Last Posted to Connector | Custom | Integrations | sync keys |
| XO availability / order / cost ×6 | Item Details/XO | Purchasing › XO Availability & Ordering | procurement |
| XO change dates ×4 · XO Keywords | Item Details/XO | Integrations › XO Sync | sync metadata |
| Sync Shopify | Purchasing, ungrouped | Integrations › Shopify | |
| Item360 sublists ×6 | Item360 tab | Related Records & Analytics | |
| Manufacturer Country | Purchasing › Manufacturing | *hidden* | not needed to transact |
| Facet buckets ×4 | Item Details/XO | *hidden* | search facets |
| BlueCollar File Attachment | Main | Communication | it's a file |
| Close-Out · Season · Atlas Department · Item Category · Item Image (Atlas) · Publish Item · EM Product · Item Options · Primary Consumption Unit | Main / Custom | *hidden* | 3 / 33 / 0 / 1 / 3 / 0 / 1 / unused |
| `zastro_image_url` · `webstore_link` · `no_of_bulbs` (135) · `zastro_warranty` · `la_umap` · both custom weight fields | Custom / XO | *hidden → retire* | duplicates with no or worse data |
| every other LA field on Custom / XO | Custom / XO | *hidden → inactivate Phase 5* | per `XO_Reference_Matrix.csv` |

---

## 5. How it is built

Everything below is in the one ACP at `sdf/xo-cutover-acp/`; one `project:deploy` ships all of it.

1. **Subtabs & field defaults (SDF) - DONE in SB1 2026-08-28, pending RP2/prod:** `custtab_25_t2379072_560` retitled
   "Specifications"; new subtab "Integrations"; `<subtab>` set on each surviving custom field to its section-3 home.
   Generated by `scripts/gen_acp.py`. (No SDF default exists for Sales / Pricing - IMAP and XO UMAP are placed by
   the form only.)
2. **Form (SDF, born fresh) - DONE in SB1 2026-08-28.** `scripts/build_form.py` is this document, executable:
   it reads the immutable SB1 export at `corpus/sb1-2026-08-28/objects/entryform/custform_xo_confirm.xml`
   and writes `sdf/xo-cutover-acp/src/Objects/custform_xo_inventory_item.xml`. Section 3 lives in its
   `LAYOUT` dict - change the layout there, re-run, deploy. CI regenerates it and fails on drift.
   - Fields named in `LAYOUT` are homed and shown; **every custom field not named is hidden where it sits**,
     so the retiring LA fields need no enumeration. `--report` lists what that hides that is visible today.
   - Do NOT try to update the UI-created `custform_217_7513000_136` via SDF - that path fails; the new form is
     born fresh and the old one retires. (Root cause and evidence: findings 4a.)
   - Three hard-won constraints live in that script: never reorder a field inside a NetSuite-standard field
     group; never set `visible=F` on the ITEMMATRIX subtab; never clear `mandatory` on a natively-required
     field. Each one makes SDF answer `Internal Server Error` with no further detail. (Findings 4c.)
   - After changing `LAYOUT`, re-run `project:adddependencies` and delete the `CHARGEBASEDBILLING` and
     `SUBSCRIPTIONBILLING` features it re-adds. `scripts/check_acp.py` catches an undeclared dependency.
3. **Switching users over is a separate, deliberate step.** The form deploys with `preferred=F`; nothing
   changes for anyone until it is made preferred and the old form retired.
4. Hiding a field on the form is step zero of inactivating it, and free to reverse.

## 6. Decisions (2026-08-27, Jesse)

| Decision |
|---|
| Two custom tabs: **Specifications** (descriptive) + **Integrations** (technical) — mirrors Purchasing in / Sales out. |
| **Class keeps its meaning** (customer category: Commercial / Retail / E-Commerce). Product-taxonomy idea tabled. |
| **Special Order Product stays** — it's the purchasing-workflow eligibility gate, misnamed by Zastro; not the native field's twin. |
| **Item360 folds into Related Records** (& Analytics). |
| **UOM fields → Purchasing.** |
| **Native Item Weight is the only weight field** on the form. |
| **COO not on the form** — Shopify and XO carry it. |
| Build once with Move Elements, distribute with **Copy to Account**. |

**To verify in the UI before hiding:** Customer Part Number and Item Substitution sublists are empty (SCM tables aren't SuiteQL-visible).

---

## 7. Adjacent processes — not part of this revamp

These touch fields on this form but are separate pieces of work with their own timing. Listed so the form work doesn't accidentally step on them, and so they aren't forgotten:

- **Display Name / UPC Code internal-ID convention** — a multi-department process already in discussion. Dependency notes from the sweep are in `docs/Adjacent_Item_Data_Notes.md`.
- **Renaming `custitem_zastro_special_order`** to say what it does — a field relabel, goes in a future ACP.
- **Feeding native `manufacturer` / `weight` from XO** — ingest-spec items for Tyler's feed, not form items.
- **LA field inactivation** — proceeds per the transition plan and `XO_Reference_Matrix.csv`.
