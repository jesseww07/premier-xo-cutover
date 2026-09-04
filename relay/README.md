# xo-relay - XoLogic Product API -> NetSuite / Shopify

The fixed-egress relay that replaces XO's FTP/CSV delta (down since 2026-08-21) with direct
Product API pulls, and adds the NetSuite write leg. Design and decisions:
[`docs/XO_API_Integration_Handoff.md`](../docs/XO_API_Integration_Handoff.md). This README is the
operating manual for the code.

```
 [XO Product API]  --GET, IPv4 only, bearer, IP-allowlisted-->  RELAY  --token auth, no IP req-->  [NetSuite]
                                                                  |
                                                                  +--Matrixify Products CSV (Variant SKU match)--> [Shopify]
```

## Status (2026-09-04)

| Layer | State |
|---|---|
| `xo/client.py` - IPv4 pin, pagination, throttle, retry, read-only | built, unit-tested against synthetic fixtures |
| `xo/models.py` - typed record, InStock/Discontinued semantics | built, tested |
| `transform/` - §7 rules, NetSuite map, Shopify delta map | built, tested |
| `netsuite/auth.py` - OAuth 2.0 client credentials (certificate) | built, JWT verified in tests; **not yet exercised against SB1** |
| `netsuite/query.py` - SuiteQL internal-id resolution + dedupe | built, tested with a fake runner |
| `netsuite/write.py` - Phase 1 CSV emit; Phase 2 REST behind guards | built, tested |
| `shopify/matrixify.py` - Products CSV + compare-at lookup | built, tested |
| `run_delta.py` - scheduled entry point | built; end-to-end test runs the whole pipeline from fixtures |
| Live XO calls | **blocked**: egress IP (IT ticket), token, database name |
| Fixture capture + field audit | scripts ready; run the moment the token lands |

`python -m pytest` -> 134 tests. Nothing here has touched XO, NetSuite or Shopify yet.

## Layout

```
relay/
├── config/fields.yaml        XO `fields=` lists per pull type + FlatFormat recommendation
├── config/mapping.yaml       XO field -> NetSuite column (script-id headers) / Shopify delta column
├── src/xo_relay/
│   ├── settings.py           env vars only (.env.example documents every key)
│   ├── xo/                   client.py  ipv4.py  models.py        <- the ONLY code that talks to XO
│   ├── transform/            normalize.py  files.py  netsuite_map.py  shopify_map.py
│   ├── netsuite/             auth.py  query.py  write.py
│   ├── shopify/              matrixify.py
│   └── run_delta.py          scheduled entry point
├── scripts/                  capture_fixtures.py  field_audit.py
├── tests/                    134 tests; tests/fixtures/ (SYNTHETIC until capture runs)
└── ops/schedule.md           hosting, scheduling, alerting, FarApp role restriction
```

## Running

```powershell
cd relay
pip install -r requirements.txt
python -m pytest

# whole pipeline offline, from fixtures (what CI runs)
python run_delta.py --source fixture:tests/fixtures/synthetic_delta.json `
    --resolver fixture:tests/fixtures/synthetic_resolution.json `
    --prices fixture:tests/fixtures/synthetic_prices.json --out out/

# live, Phase 1 (needs .env): XO delta -> SuiteQL resolution -> UPDATE/ADD CSVs + Matrixify CSV
python run_delta.py --since -7days --out out/

# live, pricing + availability columns only
python run_delta.py --since -7days --groups pricing,availability --targets netsuite
```

Every run writes `relay_report_<stamp>.md/.json` next to its outputs. Outputs:

| file | consumer |
|---|---|
| `xo_netsuite_UPDATE_<stamp>.csv` | NetSuite CSV import, type **Update**, map `internalid` -> Internal ID. Headers are script ids, same convention as the existing `NetSuite_Item_UPDATE_*.csv` files. |
| `xo_netsuite_ADD_<stamp>.csv` | NetSuite CSV import, type **Add**, record type Inventory Item; `vendor` -> Vendors : Vendor. |
| `xo_netsuite_SKIPPED_<stamp>.json` | ambiguous / unresolvable records - never written |
| `shoppremier_delta_Products_<stamp>.csv` | the Matrixify import (Step 4 of the scheduled task), UTF-8 no BOM, no Handle/Title/Tracker |

## Invariants the tests enforce

- **Read-only against XO.** `xo/client.py` can only GET; `tests/test_readonly_guard.py` greps the
  package for write verbs and fails the suite if any appear. No module outside `xo/` references the XO host.
- **IPv4 only** on the XO leg (`xo/ipv4.py`), scoped to the session - no global monkeypatching.
- **Throttle** under 20 req/s, and a 1 s gap after any response slower than 1 s.
- **401/403 fail hard** with the human action in the message; 400 logs the full query; 5xx retries
  once after 300 s then raises.
- **`externalid` is never written** (occupied by the LA process until 2026-10-01). Guarded in the
  CSV emitter and the REST writer.
- **Production writes refused** unless `RELAY_ALLOW_PROD_WRITES=1` and dry-run is off.
- **Ambiguous matches are skipped**, never guessed. Creates are dedupe-checked by `itemid` and
  `custitem7` across the whole item table before they reach the ADD file.
- **Shopify delta contract** preserved from the scheduled task: negatives -> 0, blank -> blank,
  built-to-order vendors blanked, compare-at on every row, validation before import.

## Transform rules carried forward (handoff §7) and where they live

| rule | code | test |
|---|---|---|
| Safety Rating / Location Rating inversion | `normalize.ALIASES["safety_rating" / "location_rating"]` + mapping | `test_netsuite_map::test_naming_inversion_lands_on_the_right_fields` |
| Blade Sweep = span; Reversible Blades ≠ Reverse Capable | `ALIASES`, `NEVER_COALESCE` | `test_normalize::test_reversible_blades_never_coalesced_with_reverse` |
| downrod three schemes; `Number of/Of Bulbs` | `ALIASES` | `test_normalize` |
| Chain Included holds lengths | `ALIASES["chain_length"]` | `test_normalize` |
| strip embedded units | `normalize.strip_units` | `test_normalize::test_strip_units` |
| documents match on FileDescr keyword, never slot | `files.find_document` | `test_files::test_documents_match_on_descr_not_slot` |
| URLs pass through unchanged | `files`, `normalize.absolutize_url` | `test_files` |
| GTIN 14-digit, leading zeros significant | `normalize.gtin_store / gtin_compare_key` | `test_normalize`, `test_models` |
| fan watts = CFM / CFM-per-Watt; headline CFM | `normalize.fan_watts`, `ALIASES["cfm_headline"]` | `test_normalize` |
| Item URL relative -> absolute | `transform: [url]` + `XO_ITEM_URL_BASE` | `test_netsuite_map::test_urls_files_and_gtin` |
| InStock -1 round-trips; any negative = qty unknown | `models.availability_from_in_stock` | `test_models::test_in_stock_semantics` |

**One correction to the handoff, flagged rather than silently applied.** §7 says to parse
FileData/ImageData tokens "on the last colon". The API Guide's documented string form is
`FileName:https://…/x.pdf|FileDescr:Spec Sheet`; splitting that on the last colon breaks every
https URL. `files.py` splits on the FIRST colon when the prefix is a known label, and the relay
requests `FlatFormat[FileData]=n` / `[ImageData]=n` so nothing needs splitting at all. Confirm
against `live_*` fixtures after capture.

## What is still unknown (blocks the mapping lock, not the build)

1. **XO API field names** for: `UMAP`, `OrderMinimum`, `OrderMultiple`, `Keywords`, `ItemURL`,
   `Family`, `ImagePath`, `LastChangedDate`, the `Extra-*` / `Standard-*` key spellings. Marked
   `verify: true` in `mapping.yaml` / `# verify` in `fields.yaml`; the run report lists them.
   Lookup is case/space/prefix-insensitive so most spellings resolve, but an unknown field in
   `fields=` is a 400. `scripts/field_audit.py` closes this after `scripts/capture_fixtures.py`.
2. **Which domain prefixes `Item URL`** (`XO_ITEM_URL_BASE`). Existing NetSuite rows show
   `http://shoppremier.xologic.com/...` for images.
3. **Whether NetSuite needs a Discontinued field.** The ACP has none; today it drives Shopify only.
4. **Preferred-vendor map** covers the 13 brands the sync skill knew. Other brands land on the ADD
   file with a blank `vendor` and are listed in the report.
5. The Shopify metafield headers are copied verbatim from XO's own FTP delta file (2026-08-03) -
   they are unstructured metafields with no store definition, so the header text is the contract.

## Phase gate

Run Phase 1 (CSV) for several weekly cycles in **7513000-SB1** first, then production, before
flipping `RELAY_WRITE_MODE=rest`. Before any scheduled NetSuite writes, restrict the
`FA | UE Sync - Update FA` deployment audience so it does not fire for the integration role
(see `ops/schedule.md`).
