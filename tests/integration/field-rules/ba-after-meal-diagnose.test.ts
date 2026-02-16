/**
 * Diagnostic test: Re-apply rules on the user's existing time card
 * TCD_1BEC2670-3BD9-4883-BDE0-3B5E642D5814
 *
 * This runs the "Test - Apply Contract Rules" script on the actual TCD
 * and checks whether the after-meal shortfall entry is created.
 * Compares with the production output to diagnose the discrepancy.
 */

import { describe, expect, it } from "vitest";
import {
	applyRules,
	getResultTCLs,
} from "../../helpers/factories.js";

const USER_TCD_ID = "TCD_1BEC2670-3BD9-4883-BDE0-3B5E642D5814";

describe("Diagnose: Re-apply rules on existing TCD", () => {
	it("should produce after-meal shortfall on the user's time card", async () => {
		// Re-apply rules using the test script
		console.log(`Re-applying rules on TCD: ${USER_TCD_ID}`);
		const result = await applyRules(USER_TCD_ID);
		console.log("applyRules result:", result);
		expect(result.error).toBe(0);

		const tcls = await getResultTCLs(USER_TCD_ID);

		// Log all records for diagnosis
		console.log("\n=== All TCL records after re-apply ===");
		for (const r of tcls.all) {
			console.log(
				`  ${r.time_in}-${r.time_out} | isBill=${r.isBill} isPay=${r.isPay} ` +
					`isMinimumCall=${r.isMinimumCall} hrsUnworked=${r.hrsUnworked ?? "null"} ` +
					`noteRule="${r.noteRule ?? ""}" ` +
					`_timecardline_id=${r._timecardline_id ?? "clock"}`,
			);
		}

		// Check for after-meal shortfall entries
		const afterMealEntries = tcls.all.filter((r) => {
			if (!r._timecardline_id) return false; // skip clocks
			if (!r.time_in) return false;
			return r.time_in >= "09:30:00";
		});

		console.log(
			`\nAfter-meal entries (time_in >= 09:30): ${afterMealEntries.length}`,
		);
		for (const e of afterMealEntries) {
			console.log(
				`  ${e.time_in}-${e.time_out} hrsUnworked=${e.hrsUnworked ?? "null"} ` +
					`noteRule="${e.noteRule ?? ""}" isBill=${e.isBill} isPay=${e.isPay}`,
			);
		}

		// Check unworked entries specifically
		console.log(`\nUnworked entries: ${tcls.unworked.length}`);
		for (const u of tcls.unworked) {
			console.log(
				`  ${u.time_in}-${u.time_out} hrsUnworked=${u.hrsUnworked} ` +
					`noteRule="${u.noteRule ?? ""}"`,
			);
		}

		// Assert that the shortfall exists
		expect(
			afterMealEntries.length,
			"Expected after-meal shortfall entries starting at 09:30",
		).toBeGreaterThan(0);
	});
});
