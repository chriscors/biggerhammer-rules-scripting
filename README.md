# BiggerHammer Rules Scripting

Documentation and script specs for the **CurtainTime / BiggerHammer** rules engine: the logic that turns Clock time-card lines into Billable and Payable lines (and related Unworked entries) based on contract rules.

## Overview

The rules engine runs in a **scripting file** and is triggered from the UI via **Apply Contract Rules**. It does not edit Time Card Line (TCL) records directly. Instead it:

1. Loads Clock TCLs into in-memory global arrays (`$$bill[n]`, `$$pay[n]`, `$$unwork[n]`)
2. Runs a sequence of rule sub-scripts that split, extend, and flag entries in those arrays
3. Writes the final arrays back to Billable, Payable, and Unworked TCL records (**Write to Disk**)

So the pipeline is: **Create Rule Variables → apply rules in order → Write to Disk**.

## Full workflow and architecture

For data model, architecture, phase-by-phase flow, and rule order, see:

**[workflow-doc.md](workflow-doc.md)**

It covers:

- Core tables (Contact, Event, Time Card, Time Card Line, Contract, Contract Rule, etc.)
- UI script (Apply Contract Rules) and scripting-file contract rules script (Client Router)
- Per-TCD setup, validation, and the rule processing loop
- Rule sub-scripts (Validate Time Card, Create Rule Variables, Midnight Split, meal penalties, minimum calls, before/after unpaid meal, night rate, daily/weekly OT, consecutive days, day of week)
- Write to Disk behavior and recycling of TCL records
- Known bug (multiple breaks / Before–After Unpaid Meal) and investigation notes

## Scripts in this repo

The **`scripts/`** folder holds one markdown file per rule or helper. Each describes purpose, parameters, returns, and logic (and, where relevant, bug or edge-case notes). Naming matches the script names in FileMaker where possible.

| Script | Purpose |
|--------|--------|
| [apply-contract-rules-ui.md](scripts/apply-contract-rules-ui.md) | UI entry point: Apply Contract Rules |
| [client-router.md](scripts/client-router.md) | Routes from UI to scripting file with batch TCD IDs and globals |
| [contract-rules.md](scripts/contract-rules.md) | Main contract rules script (per-TCD setup, rule loop, write/cleanup) |
| [validate-time-card.md](scripts/validate-time-card.md) | Overlap/continuity validation for Clock lines |
| [create-rule-variables.md](scripts/create-rule-variables.md) | Load Clock TCLs into `$$bill[n]` / `$$pay[n]` |
| [create-history-variables.md](scripts/create-history-variables.md) | Load prior TCDs into `$$history[n]` for meal-penalty lookback |
| [create-worked-entry.md](scripts/create-worked-entry.md) | Insert a worked entry into bill/pay arrays |
| [create-unworked-entry.md](scripts/create-unworked-entry.md) | Add an entry to `$$unwork[n]` (e.g. meal penalty) |
| [duplicate-rule-variable.md](scripts/duplicate-rule-variable.md) | Duplicate one array slot and shift the rest (used by splits/inserts) |
| [midnight-split.md](scripts/midnight-split.md) | Split segments that span midnight |
| [meal-penalty-limited-v2.md](scripts/meal-penalty-limited-v2.md) | Meal penalty (definitive): additive, single penalty entry |
| [meal-penalty-limited.md](scripts/meal-penalty-limited.md) | Meal penalty (limited): two tiers, inline penalty entries |
| [meal-penalty-multiplicative.md](scripts/meal-penalty-multiplicative.md) | Meal penalty (multiplicative): flag + split lines |
| [minimum-call-bh.md](scripts/minimum-call-bh.md) | Single-tier minimum call |
| [minimum-calls-bh.md](scripts/minimum-calls-bh.md) | Multi-tier minimum calls |
| [before-after-unpaid-meal.md](scripts/before-after-unpaid-meal.md) | Adjust hours before/after unpaid meal breaks |
| [night-rate.md](scripts/night-rate.md) | Night differential multiplier |
| [daily-overtime.md](scripts/daily-overtime.md) | Daily OT thresholds and multipliers |
| [weekly-overtime.md](scripts/weekly-overtime.md) | Weekly cumulative OT |
| [consecutive-days-bh.md](scripts/consecutive-days-bh.md) | Consecutive-day premium |
| [day-of-week.md](scripts/day-of-week.md) | Day-of-week premium (e.g. weekends/holidays) |
| [write-to-disk-bh.md](scripts/write-to-disk-bh.md) | Persist `$$bill` / `$$pay` / `$$unwork` to TCL records |
| [clear-outofwhack-flags.md](scripts/clear-outofwhack-flags.md) | Clear out-of-whack flags after a successful run |

Use **workflow-doc.md** for the exact rule order, conditions, and dependencies.

## Known bug (multiple breaks)

When a time card has **multiple breaks** (e.g. multiple unpaid meals or gaps), the last Clock line(s) can be processed incorrectly. Root cause is in **Before/After Unpaid Meal**: after **Create Worked Entry** (which calls **Duplicate Rule Variable** and increments the array), the script does not advance the loop index or update its cached `$record_count`, so the loop exits early. Details and a proposed fix are in **workflow-doc.md** under “Known Bug: Multiple Breaks”.

---

For full pipeline, data model, and script behavior, always refer to **[workflow-doc.md](workflow-doc.md)**.
