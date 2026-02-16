/**
 * Test: After Unpaid Meal Shortfall on Unworked Contract
 *
 * Scenario: Employee on an unworked-minimums contract:
 *   Clock 1: 03:00 AM - 08:00 AM  (5 hrs of work — satisfies before-meal rule)
 *   Clock 2: 09:00 AM - 09:30 AM  (0.5 hrs after a 1-hour meal gap)
 *
 * The 1-hour gap (08:00-09:00) is within max_meal_break, so it's treated as
 * an unpaid meal dismissal, not a new call.
 *
 * Expected: hrs_after_unpaid_meal = 2, actual post-meal work = 0.5
 *           → shortfall of 1.5 hrs as an unworked entry starting at 09:30.
 *
 * This test was created to reproduce a production issue where the after-meal
 * shortfall entry was not being generated on the unworked contract.
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

const TEST_DATE = "2026-05-19";

describe("B/A After-Meal Shortfall (Unworked Contract)", () => {
	const createdTcdIds: string[] = [];

	afterAll(async () => {
		await cleanupAll(createdTcdIds);
	});

	it("should create 1.5 hr after-meal shortfall for 3:00-8:00 + 9:00-9:30", async () => {
		const contractId = process.env.TEST_CONTRACT_ID_UNWORKED;
		if (!contractId) {
			console.warn("Skipping: TEST_CONTRACT_ID_UNWORKED not set.");
			return;
		}

		const contactId = requireEnv("TEST_CONTACT_ID");
		const eventId = requireEnv("TEST_EVENT_ID");

		// Read contract to understand rule configuration
		const contract = await getContract(contractId);
		const hrsAfter = contract.hrs_after_unpaid_meal ?? 0;
		const hrsBefore = contract.hrs_before_unpaid_meal ?? 0;
		const hrsMax = contract.hrs_meal_break_max ?? 24;
		const hrsMinCall = contract.hrs_minimum_call ?? 0;

		console.log(
			`Contract config: before=${hrsBefore}, after=${hrsAfter}, max=${hrsMax}, ` +
				`minCall=${hrsMinCall}, minimums_worked=${contract.minimums_are_worked_time}`,
		);

		// Validate contract is suitable for this test
		if (hrsAfter <= 0) {
			console.warn(
				"Skipping: hrs_after_unpaid_meal not set on this contract.",
			);
			return;
		}
		if (hrsAfter <= 0.5) {
			console.warn(
				`Skipping: hrs_after_unpaid_meal (${hrsAfter}) <= 0.5. ` +
					`Employee's 0.5 hr post-meal work would satisfy the rule.`,
			);
			return;
		}
		// The 1-hour gap must be within max_meal_break to be treated as a meal
		if (1.0 >= hrsMax) {
			console.warn(
				`Skipping: 1-hour gap >= max_meal_break (${hrsMax}). ` +
					`Gap would be treated as a new call, not a meal.`,
			);
			return;
		}

		// Create the time card
		const tcd = await createTimeCard({
			contactId,
			eventId,
			contractId,
			date: TEST_DATE,
		});
		const tcdId = assertId(tcd);
		createdTcdIds.push(tcdId);

		// Clock 1: 3:00 AM - 8:00 AM (5 hours of work)
		await createClockTCL({
			timecardId: tcdId,
			contactId,
			eventId,
			contractId,
			date: TEST_DATE,
			timeIn: "03:00:00",
			timeOut: "08:00:00",
		});

		// Clock 2: 9:00 AM - 9:30 AM (0.5 hours after 1-hour meal gap)
		await createClockTCL({
			timecardId: tcdId,
			contactId,
			eventId,
			contractId,
			date: TEST_DATE,
			timeIn: "09:00:00",
			timeOut: "09:30:00",
		});

		// Apply rules
		const result = await applyRules(tcdId);
		expect(result.error).toBe(0);

		const tcls = await getResultTCLs(tcdId);

		// Log all generated records for diagnosis
		console.log("\n=== All generated TCL records ===");
		for (const r of tcls.all) {
			console.log(
				`  ${r.time_in}-${r.time_out} | isBill=${r.isBill} isPay=${r.isPay} ` +
					`isMinimumCall=${r.isMinimumCall} hrsUnworked=${r.hrsUnworked} ` +
					`noteRule="${r.noteRule ?? ""}" _timecardline_id=${r._timecardline_id ?? "clock"}`,
			);
		}

		// Find after-meal shortfall entries (bill-side unworked starting at or after 09:30)
		const afterMealEntries = tcls.unworked.filter((r) => {
			if (!r.isBill) return false;
			if (!r.time_in) return false;
			return r.time_in >= "09:30:00";
		});

		console.log(
			`\nAfter-meal unworked entries found: ${afterMealEntries.length}`,
		);
		for (const e of afterMealEntries) {
			console.log(
				`  ${e.time_in}-${e.time_out} hrsUnworked=${e.hrsUnworked} noteRule="${e.noteRule}"`,
			);
		}

		// KEY ASSERTION: After-meal shortfall entries should exist
		const expectedShortfall = hrsAfter - 0.5;
		expect(
			afterMealEntries.length,
			`Expected after-meal shortfall entries starting at 09:30. ` +
				`Employee worked 0.5 hr after meal, rule requires ${hrsAfter} hrs. ` +
				`Shortfall of ${expectedShortfall} hrs should generate unworked entries.`,
		).toBeGreaterThan(0);

		// Verify total unworked hours from after-meal entries ≈ expectedShortfall
		let totalAfterMealUnworked = 0;
		for (const r of afterMealEntries) {
			if (r.hrsUnworked) {
				const parts = r.hrsUnworked.split(":");
				if (parts.length === 3) {
					totalAfterMealUnworked +=
						parseInt(parts[0], 10) +
						parseInt(parts[1], 10) / 60 +
						parseInt(parts[2], 10) / 3600;
				}
			}
		}

		console.log(
			`Total after-meal unworked: ${totalAfterMealUnworked} hrs (expected ${expectedShortfall})`,
		);

		expect(totalAfterMealUnworked).toBeCloseTo(expectedShortfall, 1);
	});
});
