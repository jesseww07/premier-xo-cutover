# Fixtures

**Everything in `synthetic_*.json` is SYNTHETIC.** It follows the shapes documented in the XO
Product API Guide (Jan-2026) and the field names from the backend full-catalog feed. It exists so
the client, transform, resolution and emit layers are unit-tested before a token exists.

When the token lands, run `python scripts/capture_fixtures.py` and commit the resulting
`live_*.json` files here (one vendor, ~50 products, all field groups, both FlatFormat shapes).
Then run `python scripts/field_audit.py tests/fixtures/live_delta_flat.json` and fix every
`verify: true` entry in `config/mapping.yaml` / `config/fields.yaml` before the mapping locks.

| file | purpose |
|---|---|
| `synthetic_delta.json` | 8 products in the recommended shape (StandardData `p`, FileData/ImageData `n`) covering every availability case, discontinued-with-stock, a built-to-order brand, a net-new SKU, a $1,000+ price, Dropbox/CDN URLs, case-variant duplicate columns, downrod schemes, the safety/location inversion, fan fields |
| `synthetic_delta_strings.json` | the same first two products in the all-`p` string shape (`Label:Value|Label:Value`) |
| `synthetic_resolution.json` | fake SuiteQL answers: by custitem7 and by itemid, including an ambiguous SKU and an inactive match |
| `synthetic_prices.json` | fake Shopify current price / compareAtPrice per SKU |
