import { describe, expect, it } from "vitest";

import { formatPhone, phoneHref } from "./phone";

describe("formatPhone", () => {
  it.each([
    // Both spellings Overture actually uses for Montreal numbers.
    ["+15149491792", "(514) 949-1792"],
    ["5147255273", "(514) 725-5273"],
    ["+1 438-874-9207", "(438) 874-9207"],
    ["(514) 555-0100", "(514) 555-0100"],
    ["1-514-555-0100", "(514) 555-0100"],
  ])("formats %j as %j", (raw, expected) => {
    expect(formatPhone(raw)).toBe(expected);
  });

  it.each([
    ["+33 1 42 68 53 00"],
    ["514-555-0100 ext. 22"],
    ["514 555 0100 / 514 555 0199"],
    ["911"],
  ])("leaves %j exactly as given rather than guessing", (raw) => {
    expect(formatPhone(raw)).toBe(raw);
  });
});

describe("phoneHref", () => {
  it("dials a plain North American number in E.164", () => {
    expect(phoneHref("5147255273")).toBe("tel:+15147255273");
    expect(phoneHref("+15149491792")).toBe("tel:+15149491792");
  });

  it("offers no link for a number it cannot read with confidence", () => {
    expect(phoneHref("514-555-0100 ext. 22")).toBeNull();
    expect(phoneHref("+33 1 42 68 53 00")).toBeNull();
  });
});
