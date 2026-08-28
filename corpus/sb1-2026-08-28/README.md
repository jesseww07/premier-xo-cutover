# Sandbox snapshot - SB1 (7513000-sb1), 2026-08-28

Immutable, like the `prod-*` snapshots. Captured with
`suitecloud object:import --type entryform --scriptid custform_xo_confirm`.

## Why this file exists

`custform_xo_confirm` is the SDF-owned copy of SB1's live inventory item entry form
`custform_217_7513000_136`, created during the 2026-08-28 bisection (findings 4a). It is
`custform_217` after two things happened to it:

1. the stray `<subList id="ITEMLOCATIONS">` was stripped (`scripts/fix_form_export.py`), and
2. NetSuite round-tripped it through SDF, so it is known-deployable as written.

It also reflects the placement ACP deployed to SB1 the same day: the 20 new `custitem_xo_*`
fields and the `custtab_xo_integrations` subtab are present with their planned defaults.

It is the input to `scripts/build_form.py`, which rewrites it into the redesigned form
`custform_xo_inventory_item` (docs/Item_Form_Redesign.md).

Diff vs a fresh import of SB1 `custform_217_7513000_136` on the same day: the duplicate
Locations subList (the install-breaking defect), an empty `fulfillment` field group, four
empty Web Store field groups, and two extra quick-view fields. Nothing that carries data.
