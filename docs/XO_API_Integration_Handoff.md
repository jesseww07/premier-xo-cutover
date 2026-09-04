# XO Product API Integration — Claude Code Handoff

**Prepared:** 2026-09-04
**Owner:** Jesse Wampole — Quality Control Coordinator, Systems \& Operations, Premier Lighting
**Scope of this handoff:** build the API layer that replaces XO's FTP/CSV delta with direct Product API pulls, and the NetSuite write leg that follows it.

This document is self-contained. Everything stated as verified below was checked against live systems on 2026-09-04; everything stated as unknown is genuinely unknown and must not be assumed.

\---

## 1\. Why this exists

Premier Lighting's Shopify storefront (shoppremier.com, live since 2026-06-22) and NetSuite item catalog are both fed from XoLogic (XO), the product-data provider replacing legacy LightsAmerica (LA). The current delivery mechanism is a weekly CSV delta dropped on XO's FTP server, pulled by a scheduled Claude Cowork task, pushed to Shopify via Matrixify.

XO's FTP server has been down since \~2026-08-21. Pricing, inventory, and discontinued-status updates have not been delivered since. Premier has been selling discontinued and out-of-stock product as a direct result.

XO's General Manager confirmed on 2026-09-03 that the **Product API is unaffected by the outage** and is XO's recommended long-term integration. Jesse independently verified that XO's underlying product database is still current — manual backend pricing reports carry change dates after 8/21. **The data layer is healthy; only the automated export generation and FTP delivery are broken.** The API reads the healthy layer.

So this is not a workaround. It is the direct integration this project was originally predicated on, and the CSV/FTP path was always the interim.

\---

## 2\. The architectural decision that shapes everything

**NetSuite will NOT call the XO API directly.** This is decided, not open.

* XO's API requires a **static IPv4 allowlist**. Confirmed by XO 2026-09-04: static IPs only, no FQDN support, multiple addresses fine with no practical upper limit.
* NetSuite's outbound egress is the DNS record `outboundips.netsuite.com`. Verified 2026-09-04: it resolves to **41 IPv4 addresses** in Oracle Cloud ranges, TTL 600, identical across Cloudflare and Google resolvers. Oracle documents that this set changes without notice, will not publish it, and will not support integrations that break when it rotates.
* Whitelisting 41 rotating addresses fails *intermittently* — only the calls that happen to egress from a newly-added address 403 — producing silent gaps in pricing and availability. That is the same failure class this project is escaping.

**Therefore: a relay with a fixed egress IPv4.** It holds the token, forces IPv4, pulls XO on a schedule, and pushes into NetSuite and Shopify.

The critical asymmetry: **the IP constraint exists only on the XO leg.** Writing *into* NetSuite has no IP requirement whatsoever — SuiteTalk REST and RESTlets authenticate by token and do not care about source address. So the static address goes on the XO side and everything flows inward.

```
   \[XO Product API]                                   \[NetSuite]
   static IPv4 allowlist                              token auth, no IP requirement
   Bearer token                                              ▲
          ▲                                                  │ SuiteTalk REST
          │ HTTPS (IPv4 only)                                │ OAuth 2.0 client credentials
          │                                                  │
   ┌──────┴──────────────────────────────────────────────────┴──────┐
   │   RELAY — single fixed egress IPv4                             │
   │   scheduled pull → transform → sanity checks → write           │
   └───────────────────────────────┬────────────────────────────────┘
                                   │ Matrixify (match on Variant SKU)
                                   ▼
                             \[Shopify / shoppremier.com]
3. Current blocking state — read before starting

|Item|Status|
|-|-|
|Premier public egress IPv4|**BLOCKED** — IT ticket open. Asking: ISP-static or DHCP? multi-WAN/failover/SD-WAN producing >1 egress address? cloud proxy or SASE in path (if so the address XO sees is the vendor's)? dual-stack (IPv6 → silent 401)? outbound 443 to `\*.xologic.com` permitted?|
|Host for the scheduled pull|**BLOCKED** — same ticket. Either an existing internal server/VM with stable egress, or plan on a cloud host with a dedicated static egress (Lambda + NAT GW + Elastic IP, or a small VPS).|
|Bearer token|Not yet issued. Request to clientservices@xologic.com once IPs are known.|
|Client database name|Unknown. Needed for the base URL. From XO Client Services.|
|Read-only token scoping|Requested, not confirmed.|

**Work that can proceed now, unblocked:** the client library, transform layer, and NetSuite write leg can all be built and unit-tested against fixtures. Only live calls are blocked.

\---

## 4\. XO Product API reference

Source: `product-api-reference-01232026-250p-v1.pdf` (XOLogic Product API Guide, Jan-2026 revision).

### Base URL and docs

```
https://<CLIENT\_DATABASE\_NAME>.xologic.com/api/v2/
https://<CLIENT\_DATABASE\_NAME>.xologic.com/api/doc     # Swagger, authoritative endpoint list
```

**Note:** an earlier project note recorded the base as `https://api.xologic.com/v0/`. That is wrong and has been corrected in the master context doc. Use the per-database subdomain form.

### Auth

```
Authorization: Bearer <ACCESS\_TOKEN>
```

* Token does **not expire**.
* Requires the calling IP to be on XO's allowlist.
* **IPv4 only.** IPv6 egress returns `401 Not Authorized`. Use `curl -4`; in Python force the source family rather than trusting OS dual-stack behavior.
* The same token also authorizes `POST` / `PUT` / `DELETE` against Premier's product database. **This integration is read-only. Never issue a write call.** A read-only token has been requested; assume it may not be granted and enforce read-only in code regardless.

### Endpoints

|Method|Path|Use|
|-|-|-|
|GET|`/api/v2/product`|List/query products|
|GET|`/api/v2/product/{productID}`|Single product|
|POST / PUT / DELETE|`/api/v2/product\[/{id}]`|**Never call these.**|

### Retrieval modes

|Mode|Coverage|Filters available|Engine|
|-|-|-|-|
|`getAll=1`|All|`vendor`, `catalogID`, `fields`, `limit`, `offset`, `includeDiscontinued`, `lastMod`|MiniBeast (fast)|
|`sort=none`|All, chunked|All filters (`keyword`, `attribute`, `minPrice`, `maxPrice`, `categoryPath`, …)|Beast (flexible)|
|`sort=FeatS`|Partial|Some|Featured Sort|

An unsupported filter combined with `getAll=1` returns `400`. The documented example: `getAll=1\&keyword=…` fails; use `sort=none` for keyword.

**Use `getAll=1` for full-catalog sync. Use `sort=none\&lastMod=…` for the delta.**

### Pagination and rate limits

* `limit` max **500**. Paginate with `offset` (0, 500, 1000, …).
* **20 requests/second** for fast responses, **1 request/second** for slow ones. Build in throttling; XO throttles abusers.
* Always pass an explicit `fields` list — it materially affects performance.

### The delta replacement: `lastMod`

`lastMod` accepts expressions like `-7days`, `-3hours`, `-1week`. It matches against **three** timestamps and does not tell you which one fired, so request all three:

```
AvailabilityChangedDate    # stock or attribute updates
CatalogChangedDate         # catalog detail changes
PriceChangedDate           # price updates
```

All UTC.

**Two consequences that close long-standing problems:**

1. `lastMod` returns **full current records**, not diff rows. Net-new SKUs simply appear as changed records. This eliminates the "delta errors on net-new SKUs" failure that has plagued the FTP delta (which merged on SKU only and errored when the SKU didn't exist yet).
2. It is timestamp-driven, so a missed run self-heals by widening the window. The FTP delta had no such property.

### Stock, availability, discontinued

|Field|Semantics|
|-|-|
|`InStock`|`>0` = quantity · **`-1` = in stock, quantity unknown** · `0` = out of stock|
|`BackOrderDate`|Expected restock, UTC|
|`Discontinued`|Explicit discontinued indicator|
|`includeDiscontinued`|Filter parameter on `getAll=1`|

The `-1` semantics were an open ambiguity escalated to XO for months. They are documented. The explicit `Discontinued` field is the mechanism whose absence at LightsAmerica was the single biggest driver of this entire migration. **Treat both as first-class in the transform — this is the payload that stops Premier selling dead product.**

### Pricing

`ItemCost` (manufacturer base) · `VendorDiscountedCost` · `CostWithShipping` · `Price` (consumer) · `WebPrice` · `MSRP` · `IMAP`

**Pricing updates daily.** XO offers unspecified "real-time update options" on request — terms unknown, ask at token issuance.

NetSuite targets: `itemvendor.purchaseprice` (what we buy at) and price level 1 = MSRP (what the manufacturer says we sell at). Those are the only two pricing concepts NetSuite carries post-cutover. `custitem5` is reserved for IMAP.

### Identifiers

|Field|Type|Example|Meaning|
|-|-|-|-|
|`XOItemID`|string|`19-10`|Primary ID, `{VendorID}-{VItemID}` composite|
|`VendorID`|int|`19`|Vendor|
|`VItemID`|int|`10`|ID within vendor catalog|
|`ItemID`|int|`123456`|Unique per product iteration|
|`ItemNumber`|string|`2343NI`|Vendor's item number|
|`BaseItemNumber`|string|`2343`|Groups variants|
|`GTIN`|string|`00345678901234`|14-digit, leading zeros significant|

**Mapping decisions already locked:**

* `custitem7` (NetSuite, formerly "VendorContactID", relabeled "XO Item ID") ← **`ItemID`**.
* `BaseItemNumber` is the Shopify handle source: handle = `vendor\_slug + "-" + BaseItemNumber`, where `vendor\_slug` is lowercase, `\&`→`and`, `.` stripped, spaces→`-`, commas and consecutive hyphens KEPT. Verified 100% against 8,019 catalog rows.
* `XOItemID` was previously avoided because it arrives Excel-date-mangled in XO's CSV export (`10-93` → `Oct-93`, 164 of 1,683 rows). **That is an artifact of the CSV/Excel path only — over the API it is a clean JSON string.** Both `ItemID` and `XOItemID` are safely available now.
* `GTIN` → barcode. Strip leading zeros only for comparison, never for storage.

### Response shaping

`FlatFormat` controls structure, globally (`\&FlatFormat=p`) or per data type (`\&FlatFormat\[StandardData]=p`):

|Value|Behavior|
|-|-|
|`o`|Original, pipe-separated (default)|
|`s`|Split labels and values into separate entries|
|`p`|Split labels, combine multiple values with `\|`|
|`k`|Key-value pairs|
|`n`|Plain JSON, no flattening|

Data types: `StandardData`, `ImportantData`, `DimensionData`, `VariantData`, `DynamicData`, `ExtraData`, `FileData`, `ImageData`, `AttributeData`, `IdentifierData`.

`StandardData` = flat normalized facets (`StandardData-Category`, `StandardData-Finish`, `StandardData-Style`), pipe-separated for multi-value. `TaxonomyData` = nested category hierarchy. **Premier uses `StandardData`** — the `Standard-\*` normalized facets are what drives showroom search and the planned Kelvin/Lumens/Wattage/Voltage bucket facets.

**Recommendation:** request `FlatFormat\[StandardData]=p` and `FlatFormat\[FileData]=n` / `FlatFormat\[ImageData]=n` — flat for the facets, structured JSON for files and images so the parser isn't splitting URLs.

### Errors

|Code|Cause|Handling|
|-|-|-|
|401|IPv6 used, or bad/missing token|Force IPv4 first, then check token|
|403|IP not whitelisted|Human action — contact XO|
|400|Invalid params (e.g. filter not allowed with `getAll=1`)|Log the full query|
|404|Product not found|Expected for stale IDs; don't retry|
|500|Server|Retry after 5 min, then alert|

\---

## 5\. NetSuite side — verified facts

All figures verified via SuiteQL against production (account 7513000) on 2026-09-04.

```
Item table total rows                      705,438
externalid populated                       253,465   (all distinct)
externalid format                          zastro\_la\_<LA id>   e.g. zastro\_la\_5401795 on item 23531
custitem7 populated                         11,681
Active items with a Shopify handle           6,727
  ...of those, with zastro externalid        3,072
  ...of those, with custitem7                  939
```

### What these numbers mean for the design

**`externalid` is OCCUPIED and off-limits.** 253,465 items carry `zastro\_la\_<id>` — almost certainly the match key for the LightsAmerica weekly update process, which still runs in parallel and which Jesse does not own or have access to configure. Writing to `externalid` risks breaking a process nobody can see. Do not touch it until LA retires (cutover 2026-10-01).

*Confirm with a reference sweep rather than inferring from the prefix, but the prefix is fairly self-identifying.*

**Scale is small.** 6,727 active Shopify-live items. A weekly delta is hundreds of records, not tens of thousands. **Do not build a high-throughput write path.** One REST call per record is entirely adequate. RESTlet batching and File Cabinet + `CSVImportTask` are both overbuilt for this volume — mentioned here only so they aren't rediscovered as "improvements."

**Match key = NetSuite internal ID**, resolved by a SuiteQL pass at the start of each run over the active Shopify-live set, joined to the XO delta on SKU. `custitem7` (XO Item ID) becomes the durable join once populated. NetSuite CSV import can only match on internal ID, external ID, or Item Name/Number — never an arbitrary custom field — which is why internal ID is the pivot.

### Write mechanism

```
PATCH  /services/rest/record/v1/inventoryitem/{internalId}     # updates
POST   /services/rest/record/v1/inventoryitem                  # creates
```

Auth: **OAuth 2.0 client credentials with a certificate** (machine-to-machine). No user, no password, no TBA token rotation, no IP requirement. This is the correct choice for a headless relay.

New XO SKUs are **Inventory Item** type (drop-ship, receive/reship, B2B Stored Inventory) — never Non-Inventory.

### Phasing — do this in two steps, not one

**Phase 1 — no new NetSuite objects.** The relay pulls XO, resolves internal IDs, and emits two CSVs: an UPDATE file keyed on internal ID and an ADD file for net-new. Jesse imports them through a saved CSV import map exactly as he does today. This proves the field mapping against live API data with zero automation risk and no integration record.

**Phase 2 — direct writes.** Swap the CSV emit for `PATCH`/`POST` calls. The mapping work is identical, so nothing from Phase 1 is discarded.

Run Phase 1 for a few weekly cycles before promoting.

### Creates need dedupe

With 451,973 items carrying no external ID, blind creates will manufacture duplicates for items that exist in NetSuite but were never given a Shopify handle. Before any create, check against existing `itemid` **and** (once populated) `custitem7`. The existing `netsuite-shopify-item-sync` skill already implements this pattern — reuse its logic rather than reinventing it.

### The FarApp script problem — design this in from the start

`FA | UE Sync - Update FA` is a User Event script that fires on **every item save**, including CSV import, Mass Update, and Map/Reduce, and makes an external HTTP call per record at roughly **5 seconds each**.

Historically this has been handled by disabling it before bulk runs. **That stops being sufficient once writes are scheduled** — a few hundred records × 5s is a half-hour of script time on every weekly run, forever.

**Durable fix: restrict that deployment's audience by role** so it does not fire for the role the integration authenticates as. This is a deployment-record change rather than a script change, which matters because the SuiteApp script itself may not be editable. Create a dedicated integration role for the OAuth client anyway.

Also disable `Update FA Map/Reduce` and `Update NS Map/Reduce` for any one-off bulk operation.

### Post-LA note (do not act on this now)

Once LightsAmerica retires, `externalid` frees up, and `xo\_<XOItemID>` in it would enable native create-or-update matching with no internal-ID lookup. That is a 253,000-record rewrite to save one SuiteQL call per run. **Not worth it** absent some other justification. Recorded so it isn't proposed as an optimization later.

\---

## 6\. Build plan

### Deliverables

```
xo-api-relay/
├── README.md
├── .env.example                 # never commit real values
├── config/
│   ├── fields.yaml              # XO field list per pull type
│   └── mapping.yaml             # XO field → NetSuite field / Shopify column
├── src/
│   ├── xo/
│   │   ├── client.py            # auth, IPv4 pinning, pagination, throttle, retry
│   │   └── models.py            # typed record shape
│   ├── transform/
│   │   ├── normalize.py         # units, coalesce, canonical figures
│   │   ├── files.py             # FileData / ImageData parsing
│   │   └── netsuite\_map.py      # → NetSuite column set
│   ├── netsuite/
│   │   ├── auth.py              # OAuth 2.0 client credentials + certificate
│   │   ├── query.py             # SuiteQL internal-ID resolution
│   │   └── write.py             # Phase 2 PATCH/POST; Phase 1 CSV emit
│   ├── shopify/
│   │   └── matrixify.py         # existing pipeline's push, input swapped
│   └── run\_delta.py             # scheduled entry point
├── tests/
│   └── fixtures/                # recorded XO responses — build against these
└── ops/
    └── schedule.md              # cron/scheduler config, alerting
```

### Task order

1. **`xo/client.py`** — build against recorded fixtures, no live calls needed. Must include: explicit IPv4 binding, `limit`/`offset` pagination, a token-bucket throttle under 20 req/s, retry with backoff on 500, hard fail with a clear message on 401/403 (those are human problems, not retry problems), and a full-query log line on 400.
2. **Fixture capture** — the moment the token lands, capture a representative response set (one vendor, \~50 products, all field groups, both `FlatFormat` shapes) into `tests/fixtures/`. Everything downstream tests against these.
3. **Field-coverage audit** — compare the API's available fields against the backend full-catalog feed's column set. Specifically confirm: `Standard-\*` facets, spec and installation sheets in `FileData`, the full `ImageData` gallery, `Item URL` (arrives as a relative path — the pipeline prepends the XO domain), and the `ExtraData` blob. **Any gap must be known before the mapping locks.** Report gaps rather than working around them silently.
4. **`transform/`** — port the existing normalization rules (see §7). Unit-test each against fixtures.
5. **`netsuite/query.py`** — internal-ID resolution pass. Reuse the batched SuiteQL approach from `netsuite-shopify-item-sync` (IN-lists cap at 1,000 values).
6. **Phase 1 CSV emit** — UPDATE and ADD files matching the existing import-map column order.
7. **Repoint the weekly pipeline** — swap the FTP fetch for `sort=none\&lastMod=-7days`; everything downstream (Handle/Title stripping, sanity checks, Matrixify push on Variant SKU) is unchanged.
8. **Phase 2 REST writes** — only after Phase 1 runs clean for several cycles.

### Acceptance criteria

* A full-catalog pull completes without throttling errors and record count matches XO's stated catalog size.
* A `lastMod=-7days` delta returns records whose three change timestamps all fall inside the window.
* Every record in a delta carries a resolvable NetSuite internal ID, or is correctly classified as net-new.
* The Phase 1 UPDATE CSV, imported to sandbox, produces zero errors and changes only intended fields.
* `Discontinued` and `InStock` values round-trip correctly, including the `-1` case.
* No `POST`/`PUT`/`DELETE` call to XO exists anywhere in the codebase.
* Secrets are environment variables. Nothing committed.

\---

## 7\. Transform rules to carry forward

These were established against real XO data and must survive the transport change.

**Naming traps — match by meaning, not by name.**

* LA "Safety Rating" holds the *location* rating (Damp/Wet) → XO `Extra-Location Rating` / `Standard-Location Rating`.
* LA "Safety Listing" holds the *safety* rating (ETL/UL) → XO `Extra-Safety Rating`.
* These two are inverted relative to their names in NetSuite. Fix at mapping time.
* Fans: XO calls blade span **"Blade Sweep"**. `Extra-Reversible Blades` = two-sided blade finish, **not** motor reverse — `Extra-Reverse Capable` / Control Type carry that. Never coalesce them.
* Downrod data appears under three schemes: `Downrod Length 1`, `Downrod 1 Length`, `Down Rod Included`.

**Ingest rules.**

* Coalesce case/spelling duplicate columns (`Number of Bulbs` / `Number Of Bulbs`, downrod variants).
* `Extra-Chain Included` holds lengths, not booleans.
* Strip embedded units: `60 W` → `60`, `120 V` → `120`.
* Document files (spec / installation / warranty) match on the `FileDescr` keyword, **never** on slot index — file-1/2/3 positions are random.
* Parse each `ImageData` / `FileData` token on its **last** colon; values are sometimes full `https://` URLs (Eurofase amplifi CDN, Dropbox) and must pass through unchanged.
* GTIN is 14-digit with significant leading zeros.
* Fan electricity is amps, not watts — derive via CFM ÷ CFM-per-Watt.
* Canonical-figure rule: use the headline figure, not a slice. Air Flow CFM, not CFM Low.
* `Item URL` is a relative path (`/brand-minka-lavery/...`) — prepend the XO domain.

**Known deltas at cutover (expected, not bugs).**

* XO MSRP ≠ LA List Price — different markup basis. MSRP is authoritative.
* Glass fidelity loss: verbatim "Clear Seedy" normalizes to "Clear" (`Extra-Glass` only 2% filled).
* `Vendor Ship Method` has mixed value domains (Yes/No vs UPS/Small Parcel/Truck depending on source). Still an open item with XO.

**Shopify-side rules that must not regress.**

* Matrixify's default match key is Handle; if Handle is present it is used **and written**. Strip Handle and Title upstream to force Variant SKU matching. Any included column gets written — there is no ignore-in-place mode.
* NetSuite item structure stays **flat, permanently**. Matrixify does variant grouping on the Shopify side.
* Inventory does **not** sync from NetSuite. Manufacturer stock via XO drives storefront availability. FarApp Product sync and Price/Quantity sync are both OFF.

\---

## 8\. Environment and access

|System|Detail|
|-|-|
|NetSuite production|Account `7513000`|
|NetSuite sandbox|`7513000-SB1` — use for all write testing first|
|Working subsidiary|Premier Lighting LLC, ID `2` (treat account as single-subsidiary)|
|Shopify handle field in NetSuite|`custitem\_fa\_shopify\_handle`, internalid `8117`|
|Matrixify scheduled-FTP source IP|`54.218.250.7`|
|XO API contact|clientservices@xologic.com (tokens, whitelisting)|
|XO relationship contact|Tyler Hainsworth, General Manager — thainsworth@xologic.com|

**SuiteQL notes that will save time:**

* Oracle syntax: `||` for concatenation, `NVL`, `TO\_DATE`, `BUILTIN.DF()`.
* **`ROWNUM <= N` must be omitted on aggregate queries** — it caps row processing before grouping and produces wrong totals. It belongs only on raw row fetches.
* `ns\_getSuiteQLMetadata` returns only native fields. Use `SELECT \*` on `item` to discover `custitem\_\*` columns with current values.
* `GROUP BY` on some columns and `REGEXP\_SUBSTR` both throw generic SuiteScript errors — use `SUM(CASE WHEN … THEN 1 ELSE 0 END)` instead.
* IN-lists cap at 1,000 values.
* Joining `employee` fails with `Record 'employee' was not found` — that is a role permission mask, not missing data.

**Python conventions in use:** pandas with `low\_memory=False` for mixed-type CSVs; normalize join keys with `.astype(str).str.strip().str.upper()` before comparison.

\---

## 9\. Explicit non-goals

* **No writes to XO.** Read-only, enforced in code.
* **No changes to `externalid`.** Occupied by the live LA integration.
* **No NetSuite-direct API calls to XO.** Decided in §2.
* **No high-throughput write machinery** (RESTlet batching, File Cabinet + `CSVImportTask`). Volume does not justify it.
* **No field renames on `custitem\_la\_\*`.** Those are governed by a separate locked scoping decision (20 fields survive, 106 retire) and execute via an SDF Account Customization Project at the 2026-10-01 cutover, not here.
* **No changes to the Shopify option-collapse or new-batch-import skills.** Separate workstreams.

\---

## 10\. Open questions to resolve before the mapping locks

1. Premier's confirmed public egress IPv4 — and whether there is more than one. *(IT ticket)*
2. Where the scheduled pull runs. *(IT ticket)*
3. XO client database name for the base URL.
4. Whether a read-only token is available.
5. What XO's "real-time pricing update options" are and whether they cost anything.
6. Whether the API's field set fully covers the backend full-catalog feed — `Standard-\*` facets, `FileData` spec/installation sheets, full `ImageData` gallery, `ExtraData`, `Item URL`.
7. Whether the API and the backend manual reports read the same store. *(Low risk — Jesse has verified the backend data is current — but worth confirming on the first pull via the three change-date fields.)*

\---

## 11\. Canonical reference

The full project context lives in Box at `/Claude Context/premier-master-context.md`, file ID `2337258551092`. Read it for anything not covered here — LA→XO field scoping, the option-collapse workflow, FarApp architecture, vendor reconciliation, and project history. It was updated 2026-09-04 with everything in this handoff.

Treat that file as reference, not gospel. Live NetSuite and Shopify are the source of truth; flag anything that appears stale.

