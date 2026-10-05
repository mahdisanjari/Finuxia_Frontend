import { describe, expect, it } from "vitest";
import { formatCents, formatCurrencyInput } from "./currency";

describe("formatCurrencyInput", () => {
  it.each([
    ["", ""],
    [null, ""],
    ["1234567", "$1,234,567"],
    ["1234.5", "$1,234.5"],
    ["1234.567", "$1,234.56"],
    ["abc12x3", "$123"],
    ["1.2.3", "$1.23"],
    [".5", "$0.5"],
  ])("formats %j as %j", (input, expected) => {
    expect(formatCurrencyInput(input)).toBe(expected);
  });
});

describe("formatCents", () => {
  it("reads as money", () => {
    expect(formatCents(9900, "usd")).toBe("$99.00");
    expect(formatCents(4950, "USD")).toBe("$49.50");
    expect(formatCents(0, "usd")).toBe("$0.00");
    expect(formatCents(100000, "usd")).toBe("$1,000.00");
  });

  it("does not fail on a currency the browser does not know, or on nothing", () => {
    expect(formatCents(1234, "zzzz")).toBe("12.34 ZZZZ");
    expect(formatCents(null, "usd")).toBe("$0.00");
    expect(formatCents(undefined)).toBe("$0.00");
  });
});
