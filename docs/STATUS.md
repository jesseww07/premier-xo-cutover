# XO Cutover - Status

Auto-generated from the committed data. Narrative status, decisions, and next actions live in
[XO_Sweep_Findings.md](XO_Sweep_Findings.md).

<!-- STATUS:START -->
_(populated by `scripts/build_status.py` on first CI run)_
<!-- STATUS:END -->

## Key dates

| Date | Milestone |
|---|---|
| 2026-08-21 | Field scoping handoff written; 20-field keep list locked |
| 2026-08-25 | Reference sweep complete; `la_max_wattage` kept as 21st survivor; Solupay excluded; ACP fields deployed to sandbox |
| 2026-09-01 | **XO go-live.** Freeze LA/Zastro writers; snapshot LA custom records to Box |
| 2026-09-05 → 09-15 | Reference sweep cleanup (searches, scripts, FarApp remap) |
| 2026-09-15 → 09-30 | Inactivate retired fields, LA records, LA searches, Zastro LA deployments |
| ~2026-12-01 | Delete after 60-day soak (second Box snapshot check first) |
