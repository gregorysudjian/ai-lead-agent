import { describe, expect, it } from "vitest";

import { MONTHLY_CAP, monthStart, reserveCall, type UsageLedger } from "./usage";

function ledger(): UsageLedger & { recorded: number } {
  return {
    recorded: 0,
    async countThisMonth() {
      return this.recorded;
    },
    async record() {
      this.recorded += 1;
    },
  };
}

describe("the Google cost guard", () => {
  it("stays well inside Google's free 5,000 Text Search Pro calls a month", () => {
    expect(MONTHLY_CAP.text_search_pro).toBeLessThanOrEqual(4_500);
  });

  it("records a call before allowing it, and refuses once the cap is reached", async () => {
    const book = ledger();
    expect(await reserveCall(book, "text_search_pro", 0)).toBe(true);
    expect(book.recorded).toBe(1);
    expect(await reserveCall(book, "text_search_pro", MONTHLY_CAP.text_search_pro)).toBe(false);
    expect(book.recorded).toBe(1);
  });

  it("counts the month from a day early, the safe direction for Pacific-time billing", () => {
    expect(monthStart(new Date("2026-09-12T12:00:00Z")).toISOString()).toBe("2026-08-31T00:00:00.000Z");
  });
});
