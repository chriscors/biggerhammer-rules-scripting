/**
 * Test: After Unpaid Meal Shortfall Survives a Later New-Call
 *
 * Bug: Adding an evening call (8:45 PM - 11:45 PM) causes the 1.5 hr
 * after-meal shortfall from the morning (09:30) to vanish.
 *
 * Scenario:
 *   Clock 1: 03:00 AM - 08:00 AM  (5 hrs — satisfies before-meal)
 *   Clock 2: 09:00 AM - 09:30 AM  (0.5 hrs after 1-hour meal gap)
 *   Clock 3: 08:45 PM - 11:45 PM  (3 hrs — new call, gap > max_meal_break)
 *
 * Expected:
 *   - The 8:00-9:00 gap is within max_meal_break → treated as unpaid meal
 *   - After-meal shortfall = 2.0 - 0.5 = 1.5 hrs starting at 09:30
 *   - The 9:30 AM - 8:45 PM gap exceeds max_meal_break → new call
 *   - PM call should NOT erase the AM after-meal shortfall
 *
 * Suspected root cause: In Part 2, the > max_meal_break branch (line 203)
 * falls through to lines 246-249 which unconditionally reset $since_unpaid_meal
 * to 0 and increment $meal_counter. This erases the AM shortfall info. Then
 * Part 3 sees $since_unpaid_meal = 3 (from PM work) and thinks the after-meal
 * rule is satisfied.
 */

import { afterAll, describe, expect, it } from "vitest";
import { cleanupAll } from "../../helpers/cleanup.js";
import {
	applyRules,
	assertId,
	createClockTCL,
	createTimeCard,
	getContract,
	getResultTCLs,
	parseTimeToHours,
	requireEnv,
} from "../../helpers/factories.js";

const TEST_DATE = "2026-05-20";

describe("B/A After-Meal Shortfall + New Call", () => {
	const createdTcdIds: string[] = [];

	afterAll(async () => {
		await cleanupAll(createdTcdIds);
	});

	it("should preserve AM after-meal shortfall when PM call is added", async () => {
		const contractId = process.env.TEST_CONTRACT_ID_UNWORKED;
		if (!contractId) {
			console.warn("Skipping: TEST_CONTRACT_ID_UNWORKED not set.");
			return;
		}

		const contactId = requireEnv("TEST_CONTACT_ID");
		const eventId = requireEnv("TEST_EVENT_ID");

		const contract = await getContract(contractId);
		const hrsAfter = contract.hrs_after_unpaid_meal ?? 0;
		const hrsBefore = contract.hrs_before_unpaid_meal ?? 0;
		const hrsMax = contract.hrs_meal_break_max ?? 24;
		const hrsMinCall = contract.hrs_minimum_call ?? 0;

		console.log(
			`Contract: before=${hrsBefore}, after=${hrsAfter}, max=${hrsMax}, ` +
				`minCall=${hrsMinCall}, minimums_worked=${contract.minimums_are_worked_time}`,
		);

		if (hrsAfter <= 0.5) {
			console.warn("Skipping: hrs_after_unpaid_meal too small for this test.");
			return;
		}

		const tcd = await createTimeCard({
			contactId,
			eventId,
			contractId,
			date: TEST_DATE,
		});
		const tcdId = assertId(tcd);
		createdTcdIds.push(tcdId);

		// Clock 1: 3:00 AM - 8:00 AM (5 hrs before meal)
		await createClockTCL({
			timecardId: tcdId,
			contactId,
			eventId,
			contractId,
			date: TEST_DATE,
			timeIn: "03:00:00",
			timeOut: "08:00:00",
		});

		// Clock 2: 9:00 AM - 9:30 AM (0.5 hrs after meal)
		await createClockTCL({
			timecardId: tcdId,
			contactId,
			eventId,
			contractId,
			date: TEST_DATE,
			timeIn: "09:00:00",
			timeOut: "09:30:00",
		});

		// Clock 3: 8:45 PM - 11:45 PM (3 hrs — new call)
		await createClockTCL({
			timecardId: tcdId,
			contactId,
			eventId,
			contractId,
			date: TEST_DATE,
			timeIn: "20:45:00",
			timeOut: "23:45:00",
		});

		const result = await applyRules(tcdId);
		expect(result.error).toBe(0);

		const tcls = await getResultTCLs(tcdId);

		// Log all generated records
		console.log("\n=== All generated TCL records ===");
		for (const r of tcls.all) {
			if (r._timecardline_id) {
				console.log(
					`  ${r.time_in}-${r.time_out} | isBill=${r.isBill} isPay=${r.isPay} ` +
						`isMinimumCall=${r.isMinimumCall} hrsUnworked=${r.hrsUnworked ?? "null"} ` +
						`noteRule="${r.noteRule ?? ""}"`,
				);
			}
		}

		// KEY ASSERTION: AM after-meal shortfall should exist at 09:30
		const amShortfallEntries = tcls.all.filter((r) => {
			if (!r._timecardline_id) return false;
			if (!r.time_in || !r.isBill) return false;
			// After-meal entries start at 09:30, before the PM call
			return (
				parseTimeToHours(r.time_in) >= 9.5 &&
				parseTimeToHours(r.time_in) < 12
			);
		});

		console.log(
			`\nAM shortfall entries (09:30-12:00 range): ${amShortfallEntries.length}`,
		);
		for (const e of amShortfallEntries) {
			console.log(
				`  ${e.time_in}-${e.time_out} hrsUnworked=${e.hrsUnworked ?? "null"} ` +
					`noteRule="${e.noteRule ?? ""}"`,
			);
		}

		const expectedShortfall = hrsAfter - 0.5;
		expect(
			amShortfallEntries.length,
			`Expected AM after-meal shortfall at 09:30. Employee worked 0.5 hr after meal, ` +
				`rule requires ${hrsAfter} hrs → ${expectedShortfall} hrs shortfall. ` +
				`Adding a PM call should NOT erase the AM shortfall.`,
		).toBeGreaterThan(0);

		// Verify the shortfall duration
		let amUnworkedTotal = 0;
		for (const r of amShortfallEntries) {
			if (r.hrsUnworked) {
				const parts = r.hrsUnworked.split(":");
				if (parts.length === 3) {
					amUnworkedTotal +=
						parseInt(parts[0], 10) +
						parseInt(parts[1], 10) / 60 +
						parseInt(parts[2], 10) / 3600;
				}
			}
		}

		if (amUnworkedTotal > 0) {
			expect(amUnworkedTotal).toBeCloseTo(expectedShortfall, 1);
		}
	});
});
