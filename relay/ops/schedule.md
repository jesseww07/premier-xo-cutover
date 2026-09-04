# Operations: where it runs, when, and what to do when it breaks

## 1. Host and egress (BLOCKED on the IT ticket)

The only hard requirement is **one stable public IPv4 address** that XO can allowlist. Everything
else (NetSuite, Shopify) authenticates by token and does not care where the call comes from.

Questions the IT ticket must answer before a token is requested:

1. Is the site's public IPv4 ISP-static or DHCP? (DHCP = not acceptable; a lease change is a silent 403.)
2. Is there multi-WAN / failover / SD-WAN that could present more than one egress address? If so,
   list every address - XO accepts multiple, no practical limit.
3. Is a cloud proxy / SASE / Zscaler-type service in the path for outbound 443? If yes, the address
   XO sees is the vendor's, and it rotates - the host must bypass it for `*.xologic.com`.
4. Is the host dual-stack? IPv6 must be disabled or the relay's IPv4 pin must be confirmed with
   `curl -4 -v https://<db>.xologic.com/api/doc`.
5. Is outbound 443 to `*.xologic.com`, `*.suitetalk.api.netsuite.com`, `*.myshopify.com` permitted?

Options, in order of preference:

| option | egress IPv4 | notes |
|---|---|---|
| Existing on-prem server / VM with the office static IP | the office IP | zero new infra; needs Python 3.11+, Task Scheduler, and answers to 1-4 above |
| Small VPS (Lightsail / DigitalOcean / Azure B1s) | the VPS's static IP | ~$5-10/mo; simplest clean answer if the office egress is unsuitable |
| AWS Lambda + NAT Gateway + Elastic IP | the EIP | more moving parts than the volume justifies; only if a serverless mandate exists |

**Do not** run it from a laptop, from Claude Cowork's sandbox, or from any GitHub-hosted runner:
none of those have a fixed IPv4.

Confirm the address the relay actually presents before sending it to XO:
`curl -4 -s https://api.ipify.org` **from the host**, twice, a day apart.

## 2. Secrets

Environment variables only (`relay/.env`, git-ignored; `.env.example` lists every key). On Windows
Task Scheduler, set them on the task's environment or in a `.env` readable only by the service
account. The NetSuite private key (`NS_PRIVATE_KEY_PATH`) is a file with ACLs limited to that
account. Nothing is ever committed.

## 3. Schedule

Weekly to start, matching today's cadence; move to daily once Phase 1 is boring.

```
# Windows Task Scheduler (weekly, Monday 06:30, service account)
Program:   C:\Python314\python.exe
Arguments: run_delta.py --since -8days --out C:\relay\out
Start in:  C:\relay\relay
```

`--since -8days` on a weekly run: the window overlaps by a day on purpose. `lastMod` returns full
current records, so overlap is idempotent (same values written twice), and a run that fails and
is rerun the next day still catches everything. A missed week is fixed by rerunning with `-15days`.

```
# cron equivalent (Linux VPS)
30 6 * * 1  cd /opt/relay/relay && /usr/bin/python3 run_delta.py --since -8days --out /opt/relay/out >> /var/log/xo-relay.log 2>&1
```

## 4. What a run produces and who acts on it

| output | action |
|---|---|
| `relay_report_<stamp>.md` | read first; exit code 0 = Shopify file valid |
| `xo_netsuite_UPDATE_*.csv` | **Phase 1:** import via the saved map (Update, Internal ID). Disable `FA \| UE Sync - Update FA`, `Update FA Map/Reduce`, `Update NS Map/Reduce` first, per the standing bulk-op rule. |
| `xo_netsuite_ADD_*.csv` | review `vendor` blanks, then import (Add, Inventory Item) |
| `xo_netsuite_SKIPPED_*.json` | ambiguous matches - resolve by hand in NetSuite, they will match next run |
| `shoppremier_delta_Products_*.csv` + `upload` manifest in the report | Step 4 of the scheduled `xologic-weekly-delta-import` task (Matrixify MCP upload -> "Ready to Import" -> confirm "by Variant" -> start) |

## 5. Alerting

The run exits non-zero and the report's `errors` list is non-empty when the Shopify file must not
be imported. Wire the scheduler's failure action (email / Teams webhook) to that exit code. In the
report, treat these as page-worthy:

- `XOAuthError` (401/403) - egress IP changed or token revoked. Human action, do not retry.
- `XOServerError` - XO down after the 5-minute retry. Rerun next day with a wider window.
- `parse_failures` in compare-at - a new number format in the feed (the comma bug class).
- `warnings` mentioning "systematic price inflation" - hold the Shopify import, look at the file.
- `records == 0` on a weekly run - XO's change dates stopped moving; ask XO before assuming quiet.

## 6. FarApp: fix before scheduled NetSuite writes

`FA | UE Sync - Update FA` fires on every item save (CSV import, Mass Update, Map/Reduce, REST) and
makes a ~5 s external call per record. Disabling it before each bulk run stops being viable once
writes are scheduled. Durable fix, in this order:

1. Create a dedicated **integration role** (copy of the role the CSV imports use today, minus UI
   permissions) and bind the OAuth 2.0 client credentials mapping to it.
2. On the **script deployment** record of `FA | UE Sync - Update FA` (not the script - the SuiteApp
   script may not be editable), set Audience > Roles to every role **except** the integration role.
3. Verify in SB1: a REST PATCH from the integration role saves an item without a FarApp call in the
   execution log; a UI save by a normal user still triggers it.
4. Keep the two Map/Reduce scripts disabled only during one-off bulk operations, as today.

Record the deployment change in `docs/XO_Sweep_Findings.md`.

## 7. Recovery

- **Rotated egress IP:** every run 403s. Get the new address from the host, send to
  clientservices@xologic.com, wait for confirmation, rerun with `--since -15days`.
- **XO outage:** nothing to do; `lastMod` self-heals when it returns.
- **Bad mapping shipped:** Phase 1 is CSV, so nothing reaches NetSuite without a human import. In
  Phase 2, `RELAY_DRY_RUN=1` produces the bodies without sending; keep it on for the first live week.
- **Duplicate created:** the ADD path dedupes by `itemid` and `custitem7`; a duplicate means one of
  those was blank on the existing item. Inactivate the newer one, backfill `custitem7` on the older.
