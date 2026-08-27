# Item Form Redesign — Proposal

**Status:** proposal for Jesse's review · drafted 2026-08-27 · evidence from production SuiteQL (705,357 items), the SB1 form export, and `data/XO_Reference_Matrix.csv`
**Scope:** the inventory-item entry form (`custform_217_7513000_136`, "New Inventory Item Form - Xo Fields", the working copy in SB1). Field *placement*, *visibility*, and *consolidation* — not the LA retirement schedule, which stands.

---

## 1. The principle

The form should let anyone — sales, PC, purchasing, accounting, a new hire — find an item fact in the place they would naturally look, without a map:

| If you want… | You look on… |
|---|---|
| what it is — name, number, brand, collection, finish, category, picture | **the top of the form** |
| what we sell it for | **Sales / Pricing** |
| what we buy it for, from whom, how it ships, whether it's in stock | **Purchasing / Inventory** |
| how it books | **Accounting** (tax included) |
| how big / bright / rated it is | **Specifications** |
| what the integrations know about it | **Integrations** |

And three rules that follow from it:

1. **One home per fact.** A fact lives in one field, in one place. No `Manufacturer` *and* `Manufacturer Name` *and* `Vendor Name`.
2. **Native first.** If NetSuite has a field for it, use that field. A custom duplicate of a native field is a defect, even if it has 600,000 values.
3. **Populated ≠ needed.** A field earns its place by being *used* — read by a person, a script, a connected record. Bad data, convention-copies, and integration side-effects do not count.

---

## 2. Diagnosis — what the current form is

**19 subtabs, ~300 fields, and the important ones are hidden by the unimportant ones.**

| Symptom | Evidence |
|---|---|
| **The "Custom" subtab is a 114-field dump** | 114 fields, no field groups, in the order integrations created them. It holds 6 fields people actually need (Material, IMAP, Special Order Product, Is Light Bulb, XO Item ID, Non-Taxable) buried among ~100 retiring LA fields. |
| **The "Item Details / XO" subtab is a second dump** | 51 fields, no groups. Identity (Product Name, UPC, Collection, Finish, Image) sits next to sync timestamps and search-facet buckets. |
| **Zastro duplicated the native fields and left the natives bare** | native `manufacturer` **1,649** vs `custitem_la_manufacturer_name` 609,162 · native `mpn` **20** · native `countryofmanufacture` **3** vs LA COO 257,001 · native Item Weight **452** vs LA weight fields 49,648 · native **Special Order Item 9** vs `custitem_zastro_special_order` **683,902** TRUE · native Drop Ship Item 2 vs LA Drop_Ship 498,489 |
| **The native "name" fields are key-copies, not names** | Display Name = internal ID on **532,040** items (workflow `Internal ID as Display Name`); Vendor Name/Code = Item Name on **398,951** (workflow `Set Item Defaults`). The only human-readable product name in the system is the custom `Product Name` field — and it's on the second dump subtab. |
| **UPC Code holds the internal ID — on purpose** | 327,951 of 395,616 values are the item's own internal ID; only 3,232 look like UPCs. `Set Item Defaults` writes `TO_CHAR({internalid})`, `pl_displayname.js` enforces it, `_jww_upc_fill` backfilled it. **It is the warehouse barcode key** — `mag_sl_print_label_form.js` prints it. The LA pipeline (`update_price_only.js`) fought it by writing real UPCs into the same field → 192,743 conflicting values. |
| **Six subtabs carry nothing** | Web Store: store description 0, search keywords 0, online 0, display name 218 — Premier has no NetSuite web store. Preferences: `Offer Support` is set TRUE by workflow on every item, meaningless. Merchandise Hierarchy: feature not enabled. Hazmat: lighting. Customer Part Number / Item Substitution: SCM bundle sublists (usage not SuiteQL-visible — verify in UI, expected empty). |
| **Three overlapping "Item URL" labels on one form** | `custitem_zastro_image_url` "Item URL" (1 value), `custitem_la_product_url` shown as "Item URL (2)", `custitem_webstore_link` "Webstore Link" (0 values). Users see three URL fields; one has data. |
| **Classification is unused natively** | Class 3,896 · Department 1,330 · Location 2,502 — while the Atlas `Style` field (66 values, 168,004 items) is a real taxonomy and floats in the main area with no field group, next to `Close-Out` (3 TRUE), `Season` (33), a duplicate Atlas `Department` (0), and a tax-bundle `Item Category` (1). |
| Horizontal scrolling | comes from tabs with 50–114 ungrouped fields and 6+ column sublists; fixed by the consolidation below, not by widening anything. |

---

## 3. Proposed structure

**19 subtabs → 9.** Main area gets a third group. Two custom subtabs are renamed/repurposed, one is retired, and every other tab is native.

### Main area

| Group | Fields (in order) | Notes |
|---|---|---|
| **Primary Information** (native) | Item Name/Number · **Product Name** · Display Name/Code · UPC Code → *label "Barcode (Internal ID)"* · **UPC / GTIN** · Vendor Name/Code · Subitem Of · Primary Units Type · Base / Stock / Sale / Purchase Unit · Internal ID | `Product Name` (`custitem_la_product_name`, 604k) moves up from the XO tab — it is *the* name. Relabel native UPC Code honestly so nobody "fixes" it; `UPC / GTIN` (`custitem_la_upc`) is the real barcode. Consider hiding the 5 UOM fields into Purchasing if UOM is always Each. |
| **Catalog** (new) | **Manufacturer** (native, ← XO Vendor Name) · **Collection** · **Finish** · **Style** (XO Style, Atlas field) · **Primary Image** · **Item URL** | The "what does it look like / which line is it" group. Native `manufacturer` replaces the retired `la_manufacturer_name` for display — it's a native text field, costs nothing, and the ingest already has the value. |
| **Classification** (native) | Subsidiary · Class · Department · Location · **Is Light Bulb** · Inactive | `Is Light Bulb` (`custitem6`) is a category flag that drives a transaction column — it belongs with classification. Remove Close-Out, Season, Atlas Department, Item Category, BlueCollar File Attachment from this group (see §5). **Option:** feed XO `Standard-Category` / `Subcategory` into native `Class` (hierarchical) — that would give Premier a real product taxonomy in the field every NetSuite report already understands. |

### Subtabs (in tab order)

**1. Purchasing / Inventory** — *what we buy, from whom, and where it is*

| Group | Fields |
|---|---|
| Item / Cost Detail (native) | Purchase Price · Last Purchase Price · Purchase Description · Costing Method · Average Cost · Total Value · Track Landed Cost · Stock Description · Drop Ship Item · Special Order Item · **Special Order Product** (Zastro flag — keep next to its native twin; see §6) · Match Bill To Receipt · Copy Description |
| **XO Availability & Ordering** (new) | **XO In Stock** · **Back Order Date** · **Order Minimum** · **Order Multiple** · **Vendor Discounted Cost** · **Cost With Shipping** |
| Manufacturing (native) | Manufacturer (mirrors Catalog) · **MPN** (← XO Item Number) · **Manufacturer Country** (← XO Country of Origin, 99% fill) |
| Inventory Management (native) | Use Bins · Preferred Stock Level · Reorder Multiple · Purchase Lead Time · Safety Stock · Transfer Price · Supply Chain Horizon |
| Vendor Bill Matching (native) | as-is |
| Sublists | Vendors · Locations · Bin Numbers · **Inventory Detail / Inventory Numbers / Inventory Statuses** (absorbed from the Inventory Detail tab) · **Landed Cost Template Mapping** (absorbed) |

**2. Sales / Pricing** — *what we sell it for and how it ships*

| Group | Fields |
|---|---|
| Sales (native) | Sales Description · Cost Estimate Type · Item Defined Cost · Soft Descriptor · Min / Max Quantity |
| **MAP Pricing** (new) | **IMAP** (`custitem5`) · **XO UMAP** |
| Pricing (native) | price-level matrix (MSRP is the record; Premier Sample Item is internal) · Quantity Pricing Schedule · Use Marginal Rates |
| Shipping (native) | **Item Weight** (← XO Ship Weight, 99% fill; today 452 populated) · Package · Ships Individually · Shipping / Handling Cost · Schedule B |
| Sublists | Price Levels |

**3. Specifications** — *the rename of "Item Details / XO Logic Data"* (custom subtab `custtab_25_t2379072_560`)

| Group | Fields |
|---|---|
| Dimensions | **Width** · **Height** · **Length** |
| Lighting | **Bulb Type** · **Bulb Base** · **Number of Bulbs** · **Wattage** · **Kelvin** · **Lumens** · **CRI** · **Voltage** · **Dimmable** |
| Materials | **Material** (up from Custom) |
| Ratings & Compliance | **Safety Rating** (ETL/UL) · **Location Rating** (Damp/Wet) · **Prop 65** · **Prop 65 Description** · **Title 20** · **Title 24** |
| Documents | **Spec Sheet Hyperlink** |

The four facet **buckets** (Kelvin / Lumens / Wattage / Voltage Bucket) are search facets, not reading material — keep the fields, **hide them from the form**.

**4. Accounting** — *how it books* (+ Tax absorbed)

| Group | Fields |
|---|---|
| Accounts (native) | as-is (COGS, Asset, Income, Gain/Loss, variances, Dropship Expense) |
| **Tax** (absorbed from the Tax tab) | Tax Schedule · Tax Item Type · OSS Tax Schedule · Tax Schedule Coaching Text · **Non-Taxable** (TSS, up from Custom) |
| Currency | as-is |

**5. Integrations** — *new custom subtab; replaces the Shopify tab and collects every sync artifact*

| Group | Fields |
|---|---|
| Shopify | Shopify Flag · Shopify Store · Sync Shopify · Shopify Handle · Meta Title · Meta Description · Metafield 1 · Product Type · Requires Shipping · Tags · Allow Backorders · Published At · Published Scope · isonline · List On Shopify Temporary Field |
| XO Sync | **XO Item ID** · **XO Last Changed** · **XO Availability Changed** · **XO Catalog Changed** · **XO Price Changed** · **XO Keywords** |
| NetSuite Connector | Last Posted to NetSuite Connector · *sublist:* NetSuite Connector Synced Items |

**6. Item360** — Atlas analytics sublists (Sales & Margin, 3-Way Match, Historical Sales, Open SO/PO, Monthly Qty). Read-only reports; keep as a tab of reports. *(Confirm sales/purchasing still open it; if not, hide.)*

**7. Related Records** — Transactions sublist. Native, keep. (Consider folding Item360 here later.)

**8. Communication** — Events · Tasks · Phone Calls · **Files** · User Notes. Native, keep. `BlueCollar File Attachment` (PM add-on) moves here from the main area.

**9. System Information** — Inactive · Date Converted · Original Type/Subtype · System Notes · Active Workflows · Workflow History. Native, keep.

### Hidden (uncheck *Show* on the form)

| Subtab | Why |
|---|---|
| **Custom** | empty once the 6 keepers move and the ~100 retiring fields are hidden |
| **Web Store** | no NetSuite web store; 0 online items, 0 store descriptions, 0 keywords |
| **Preferences** | `Offer Support` is workflow-forced TRUE on every item; `Available to Adv. Partners` unused |
| **Merchandise Hierarchy** | feature not enabled; 0 versions |
| **Hazmat / Dangerous Goods** | not applicable to lighting (verify: 0 hazmat IDs expected) |
| **Inventory Detail**, **Tax**, **Landed Cost Templates**, **Shopify** | absorbed above |
| **Customer Part Number**, **Item Substitution** | SCM bundle sublists; verify empty in UI, then hide |

---

## 4. Field-by-field: every field that survives, and where it goes

The companion CSV `docs/item_form_layout_proposal.csv` is the executable version (one row per field: current tab → proposed tab → group → action). Summary of moves that are not obvious from §3:

| Field | Today | Proposed | Why |
|---|---|---|---|
| Product Name (`custitem_la_product_name`) | Item Details/XO | **Main › Primary Information** | the only human-readable name; 604k |
| UPC / GTIN (`custitem_la_upc`) | Item Details/XO | Main › Primary Information | identity |
| Collection · Finish · Primary Image · Item URL | Item Details/XO | Main › Catalog | how staff recognise a fixture |
| Style (`custitem_atlas_style`) | Main, ungrouped | Main › Catalog | 66-value taxonomy, 168k items |
| Material | **Custom** | Specifications › Materials | spec, not identity |
| IMAP (`custitem5`) | **Custom** | Sales / Pricing › MAP Pricing | customer-facing price floor |
| XO UMAP | Item Details/XO | Sales / Pricing › MAP Pricing | same |
| Special Order Product | **Custom** | Purchasing › Item/Cost Detail | ops flag; sits beside native Special Order Item |
| Is Light Bulb (`custitem6`) | **Custom** | Main › Classification | category flag feeding `custcol_premier_is_bulb` |
| Non-Taxable (TSS) | **Custom** | Accounting › Tax | tax |
| XO Item ID · Last Posted to NetSuite Connector | **Custom** | Integrations | sync keys |
| XO In Stock · Back Order Date · Order Min/Multiple · Vendor Disc. Cost · Cost w/ Shipping | Item Details/XO | Purchasing › XO Availability & Ordering | procurement facts |
| XO change-date quartet · XO Keywords | Item Details/XO | Integrations › XO Sync | sync metadata |
| Facet buckets ×4 | Item Details/XO | *hidden* (field kept) | search facets |
| Spec Sheet Hyperlink | Item Details/XO | Specifications › Documents | doc |
| BlueCollar File Attachment | Main › Classification | Communication | it's a file |
| Close-Out · Season · Atlas Department · Item Category (USR) · Item Image (Atlas) · Publish Item · EM Product · Item Options | Main / Custom | *hidden* | 3 / 33 / 0 / 1 / 3 / 0 / 1 / unused |
| `custitem_zastro_image_url` "Item URL" · `custitem_webstore_link` · `custitem_no_of_bulbs` (135) · `custitem_zastro_warranty` (0) · `custitem_la_umap` (0) | Custom / XO | *hidden now → retire* | duplicates with no data; hiding `zastro_image_url` fixes the "Item URL (2)" label |
| every other LA field on Custom / XO | Custom / XO | *hidden now → inactivate Phase 5* | per `XO_Reference_Matrix.csv` |

---

## 5. Native-field consolidation (the Zastro fix)

These are the places where the fix is "stop using the custom field, feed the native one." Each is an ingest-mapping change plus, where noted, a one-time backfill. None changes a scriptid.

| Native field | Feed from XO | Today | Replaces | Caveat |
|---|---|---|---|---|
| `manufacturer` | Vendor Name | 1,649 | `la_manufacturer_name` (retiring anyway) | free text — direct |
| `mpn` | Item Number | 20 | `la_manufacturer_number` (244, retiring) | Item Name/Number already *is* the vendor SKU at Premier; MPN duplicates it. Low value — populate for completeness or skip. |
| `countryofmanufacture` | Extra-Country of Origin | 3 | `la_country_of_origin` (retiring) | **list field** — needs text→country mapping ("China" → CN). Worth it: XO fill is 99%, and country of origin matters for tariffs. |
| `weight` (Item Weight) | Extra-Ship Weight | 452 | `la_weight_grams`, `custitemcustitem_la_weight` (retiring) | drives shipping calculations; unit = lb in NetSuite, check XO unit |
| `isspecialorderitem` | — | 9 TRUE | `custitem_zastro_special_order` (683,902 TRUE) | **not yet** — see §6 |
| `isdropshipitem` | — | 2 TRUE | `la_drop_ship` (retiring) | handoff already decided: retire the LA field, keep native (rarely usable — items are both) |
| `class` (hierarchical) | Standard-Category / Subcategory | 3,896 | `custitem_category` (30 values, 5,852) · `la_manufacturer_category` (42, 5,521) · `la_la_category` (85) | **optional, biggest upside**: gives every native report a product taxonomy. Decide whether Class is free for this (it is barely used today). |
| `displayname` | — | 532,040 = internal ID | — | **leave the convention alone** — it prints on transaction lines by design (workflow31). Just don't call it a name. |
| `upccode` | — | 327,951 = internal ID | — | **leave the convention alone** — it's the warehouse barcode key (`mag_sl_print_label_form.js`). Relabel on the form to "Barcode (Internal ID)". The LA pipeline that overwrote it with real UPCs retires Sep 1, ending the 192,743-row conflict. |
| `vendorname` | — | 398,951 = Item Name | — | leave; workflow35 default. Hide or relabel "Vendor Code" — it is not the vendor's *name*. |

---

## 6. Special Order Product — the one deliberate deferral

`custitem_zastro_special_order` is TRUE on 683,902 items (97%), written by workflow35 on every create/update, read by 11 saved searches, and native `isspecialorderitem` is TRUE on 9. The *right* end state is obvious: the native checkbox. But it is a semantic change to a flag that 97% of the catalog carries and that the PO-consolidation flow may key on (the flow references the Zastro record types; whether any of it reads this item flag is a saved-search question). **Recommendation:** keep the custom flag on the form beside the native one for now; after Sep 1, audit the 11 searches, decide if "special order" at Premier even means what NetSuite means, then either migrate to native or rename the custom one honestly ("Non-Stock / Order-In").

---

## 7. How to execute

1. **Subtabs (SDF, once, deploys to all accounts):** relabel `custtab_25_t2379072_560` → "Specifications"; add custom subtab `custtab_xo_integrations` "Integrations". Both are `subtab` objects — deployable in the ACP, unlike forms.
2. **Field default placement (SDF):** set `<subtab>` on the surviving custom fields to their new home (Specifications / Integrations / Purchasing etc. — natives tabs are addressable by their standard IDs). Ship in the ACP with the relabels. This makes the *default* placement portable across SB1 / RP2 / prod; the form then only needs ordering and hides.
3. **Form (UI, per account):** Customize → **Move Elements** to place fields into groups and create the three new field groups (Catalog; XO Availability & Ordering; MAP Pricing; Tax; XO Sync); uncheck *Show* on the 11 hidden subtabs; relabel UPC Code. Do it once in SB1, screenshot the result for the record, repeat in prod after the ACP deploy. This is a one-hour job once §3 is approved.
4. **Ingest mapping:** add the native targets from §5 (manufacturer, mpn, countryofmanufacture with country mapping, weight) to the XO pipeline spec.
5. **Backfills (with the FA UE sync scripts disabled):** finish 204,504 · width 45,816 · optional: native weight / manufacturer / country from the current LA fields before those retire.
6. **Retirement** proceeds per the transition plan — hiding fields on the form is step zero of inactivating them, and costs nothing to reverse.

---

## 8. Decisions needed from Jesse

1. **Tab names:** "Specifications" + "Integrations" (this proposal) vs a single "Supplemental Information" tab holding both. My recommendation is two — specs are read by salespeople answering customers; sync data is read by you. Different audiences, different tabs.
2. **Class as product taxonomy** (§5): yes / no / later.
3. **UOM fields on the main area:** keep the five, or push to Purchasing (are items ever anything but Each?).
4. **Item360:** keep as its own tab, fold into Related Records, or hide (who opens it?).
5. **Native Item Weight / Manufacturer Country ingest:** approve the two extra mappings for Tyler's feed spec.
6. **Special Order Product** (§6): agree to defer to post-Sep-1 audit.
