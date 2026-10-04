import { describe, expect, it } from "vitest";
import { formatCurrencyInput } from "./currency";

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
