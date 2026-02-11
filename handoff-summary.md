# CurtainTime Rules Engine — Handoff Summary

## What This Is

A complex FileMaker invoicing application for event services. Contacts (workers) are punched in/out at events throughout the day. Punch records are consolidated into Clock Time Card Lines (TCLs), then a rules engine processes those Clock lines into Billable and Payable TCLs by applying contract-specific rules (meal penalties, minimum calls, overtime, night rate, etc.).

## Architecture

- **3 FileMaker files:** UI, Scripting, Data
- **In-memory processing:** Clock TCLs are loaded into repeating global variables (`$$bill[1..n]`, `$$pay[1..n]`) by "Create Rule Variables." Rule sub-scripts mutate these arrays. "Write to Disk" persists the final state as actual Billable/Payable TCL records.
- **`$$unwork[1..n]`** is a separate array for non-worked premium entries (meal penalties, turnaround, etc.)

## The Bug

**When converting billable/payable records with multiple breaks (2+ unpaid meals/gaps between Clock lines), the last Clock line(s) are not processed correctly — they're skipped or missing from the output.**

## Root Cause Found

**The "Before/After Unpaid Meal" script** is the primary culprit. When a worker hasn't met the required hours before/after a meal break, it calls "Create Worked Entry" which inserts a new entry into the `$$bill`/`$$pay` array via "Duplicate Rule Variable" (which shifts all subsequent elements down and increments `$$<mode>_count`).

However, in the "Before/After Unpaid Meal" script:

1. **`$record_count` is NOT incremented** after insertions — it was intentionally commented out (KL, Dec 2021 / VM, Feb 2022) because it caused an infinite loop
2. **`$tcl_loop` (the loop counter) is also NOT incremented** — so the next iteration re-processes the newly inserted entry

The infinite loop originally happened because `$tcl_loop` wasn't advanced past the inserted entry, causing the same record to repeatedly trigger the rule. The "fix" of commenting out `$record_count + 1` stopped the infinite loop by making the loop exit early, but introduced the current bug: the loop terminates before reaching the final Clock lines.

**The correct fix requires BOTH** (at all 7 locations in the script where the increment is commented out):
```
Set Variable [ $tcl_loop ; Value: $tcl_loop + 1 ]           // skip past inserted entry
Set Variable [ $record_count ; Value: $record_count + 1 ]   // track new array size
```

This is the exact pattern used correctly by "Minimum Calls - BH" which works properly.

## Secondary Bug

**"Meal Penalty - Multiplicative"** also caches `$record_count` before its main loop and never refreshes it after calling "Duplicate Rule Variable" for splits. Same last-entry-skipped behavior, but only affects contracts using the multiplicative meal penalty variant. Fix: re-read `$$<mode>_count` after each split.

## Minor Bugs Also Found

- **Weekly Overtime:** In the split case, sets `time_out_ts_c` instead of `time_in_ts_c` on the new record
- **Consecutive Days:** Unworked entry loop uses `$ordinal` (never set) instead of `$next_ordinal`
- **Create Unworked Entry:** Commented-out timestamp fix (Chris Corsi, Jul-Aug 2024) means `time_in_ts_c`/`time_out_ts_c` don't match provided `time_in`/`time_out` values

## Full `$record_count` Audit

| Script | Updates count? | Advances loop? | Status |
|---|---|---|---|
| Midnight Split | No (cached) | Exits after 1st | ✓ OK by design |
| Meal Penalty - Limited V2 | N/A (no splits) | N/A | ✓ OK |
| Meal Penalty - Limited | N/A (no splits) | N/A | ✓ OK |
| **Meal Penalty - Multiplicative** | **NO** | Yes | **⚠️ BUG** |
| Minimum Calls - BH | Yes | Yes | ✓ OK |
| Minimum Call - BH | Yes | Yes | ✓ OK |
| **Before/After Unpaid Meal** | **NO (commented out)** | **NO** | **⚠️ ROOT CAUSE** |
| Night Rate | Yes | Yes | ✓ OK |
| Daily Overtime | Yes | Yes | ✓ OK |
| Weekly Overtime | Yes | Yes | ✓ OK |
| Consecutive Days | N/A (no splits) | N/A | ✓ OK |
| Day of Week | N/A (no splits) | N/A | ✓ OK |

## What's Been Documented

A comprehensive Markdown artifact ("CurtainTime Rules Engine — Workflow Documentation") was created covering:
- Data model and table relationships
- Full Phase 1 (UI script) and Phase 2 (Contract Rules orchestrator) workflow
- Detailed documentation of every rule sub-script:
  - Validate Time Card, Create Rule Variables, Midnight Split
  - Meal Penalty (all 3 variants), Minimum Calls (both variants)
  - Before/After Unpaid Meal, Night Rate, Daily Overtime, Weekly Overtime
  - Consecutive Days, Day of Week
- Helper scripts: Duplicate Rule Variable, Create Worked Entry, Create Unworked Entry
- Known bug analysis with root cause and fix

## What's Left To Do

1. **Review "Write to Disk - BH"** — This is the script that persists the final `$$bill`/`$$pay`/`$$unwork` arrays back to actual TCL records. We haven't seen it yet. Important to verify it reads `$$<mode>_count` (the global, not a cached value) and handles the array correctly.

2. **Implement the fix in "Before/After Unpaid Meal"** — Add both `$tcl_loop + 1` and `$record_count + 1` at all 7 commented-out locations. Test with 0, 1, 2, and 3+ breaks.

3. **Fix "Meal Penalty - Multiplicative"** — Add `$record_count` refresh after each "Duplicate Rule Variable" call.

4. **Test the fixes** — Use the example scenario: punches at 3:00 AM, 8:00 AM, 9:00 AM, 9:30 AM, 8:45 PM, 11:45 PM → 3 Clock lines (3:00-8:00, 9:00-9:30, 8:45-11:45) with 2 breaks.

5. **Optionally fix minor bugs** (Weekly OT timestamp, Consecutive Days variable name, Create Unworked Entry timestamps).

## Scripts Not Yet Reviewed

- Write to Disk - BH
- Create History Variables
- Clear OutOfWhack flags
- Client Router
