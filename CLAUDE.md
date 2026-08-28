# CLAUDE.md - premier-xo-cutover

NetSuite side of Premier Lighting's LightsAmerica → XoLogic catalog cutover (go-live 2026-09-01).
Account 7513000 (prod) / 7513000-SB1 (sandbox). Owner: Jesse Wampole.

## Read first, in this order
1. `docs/XO_Sweep_Findings.md` - current state, approved decisions, next actions.
2. `docs/XO_Field_Scoping_Handoff.md` - locked decisions. **Primary guide; where the transition-plan doc disagrees, the handoff wins.**
3. `docs/Item_Form_Redesign.md` - the item entry form workstream (structure, and how the form is generated).
4. `data/XO_Reference_Matrix.csv` - the per-target evidence.

## Hard rules
- **Solupay / Versapay is out of scope.** Different vendor, different business area (decision 2026-08-25). Do not add its fields, scripts, or searches to any target list, matrix, or cleanup list.
- **Never hand-edit `data/`.** Regenerate with the scripts; CI fails on drift. Inputs captured from production SuiteQL (`populated_counts.csv`, `sweep_targets.csv`, `script_inventory.csv`, `deployment_inventory.csv`) are refreshed deliberately, in their own commit, with the query noted in the message.
- **Relabel, never change a scriptid** on a surviving field. 21 LA fields survive (the handoff's 20 + `custitem_la_max_wattage`); the rest retire after the cleanup lists are worked.
- **Zastro carve-out:** `customrecord_zastro_po_consolid`, `customrecord_zastro_unconsolidated_items`, `custcolcustcol_zastro_vendor`, `custcol_zastro_purchase_price`, `customlist_zas_tracking_carrier`, `custitem_zastro_special_order` are live PO-consolidation operations - KEEP. Only the LA catalog machinery retires.
- **Production deploys need Jesse's explicit sign-off in the conversation** and get recorded in the findings report. Sandbox deploys are fine.
- **Entry forms via SDF: create, never update a UI-born form.** Exports contain a duplicate `<subList id=ITEMLOCATIONS>` that fails install - strip it with `scripts/fix_form_export.py` and deploy under a new scriptid; SDF can then update that form freely. Updating `custform_217_7513000_136` (UI-created) fails regardless. New custom fields auto-land on existing forms; form-level label overrides do not follow field relabels.
- **The item entry form is generated, not hand-built.** `scripts/build_form.py` (layout in its `LAYOUT` dict) writes `custform_xo_inventory_item.xml` into the ACP; CI regenerates and fails on drift. Do not hand-edit that XML, and do not rebuild the form in the UI.
- **`Internal Server Error` from the CLI = the entryForm payload is unacceptable**, not a network blip - it prints before validation reports a single step. Two known causes, both bisected: reordering a field *inside* a NetSuite-standard field group (fields arriving from elsewhere are fine), and `<visible>F</visible>` on the `ITEMMATRIX` subtab (remove the element instead; NetSuite re-adds it on install anyway).
- **After `project:adddependencies` on the ACP, delete the `CHARGEBASEDBILLING` and `SUBSCRIPTIONBILLING` features** it adds - neither is enabled, and they fail ACCOUNT_SETTINGS_VALIDATION.
- **Bulk item writes** (backfills, mass updates): disable `FA | UE Sync - Update FA`, `Update FA Map/Reduce`, `Update NS Map/Reduce` first.

## Tooling facts
- SuiteCloud CLI **≥ 4.0.0** via `npx --yes @oracle/suitecloud-cli@latest`. Global 3.2.x fails on current entryform exports (schema drift) - that is a CLI artifact, not a project defect.
- `project.json` is git-ignored (machine-local auth binding). Copy `project.json.example`.
- `object:import` non-interactive needs `--destinationfolder /Objects/<type>` and the folder must exist. From Git Bash prefix `MSYS_NO_PATHCONV=1` or the path gets mangled.
- SDF ACP deploys are **not atomic** - a failing object does not roll back the others.
- SuiteQL: `customfield` is queryable (incl. `source`); `GROUP BY` on some tables errors - use `SUM(CASE ...)`; `scriptdeployment` filter with `WHERE UPPER(recordtype) LIKE '%ITEM%'`.
- Saved-search definitions ARE SDF-importable (`--type savedsearch --scriptid ALL`) and greppable - no introspection Suitelet needed.

## Working conventions
- Corpus snapshots are immutable: add `corpus/prod-YYYY-MM-DD/` (or `corpus/sb1-YYYY-MM-DD/` for a sandbox capture), never edit an existing one. `scripts/common.py` resolves `CORPUS` to the newest `prod-*` only.
- Keep the findings report as the running narrative; add dated entries rather than rewriting history.
- Concise, direct communication. Jesse is a Business Systems Analyst / Integration Specialist who writes SuiteScript - no hand-holding.
