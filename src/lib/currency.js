// Formats a raw digit string into "$1,234,567.89" as the advisor types —
// strips everything but digits and a single decimal point, re-inserts
// thousand-separator commas into the integer part, and keeps up to 2
// decimal digits as typed. Used for every money field in Sales Package
// Prep (Annual Income, Mortgage Balance, Coverage, Premium, ...).
export function formatCurrencyInput(value) {
  let cleaned = String(value ?? "").replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
  }
  const [intPart, decPart] = cleaned.split(".");
  if (!intPart && decPart === undefined) return "";
  const withCommas = (intPart || "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  let result = `$${withCommas || "0"}`;
  if (decPart !== undefined) result += `.${decPart.slice(0, 2)}`;
  return result;
}

/**
 * An amount in minor units (cents) as money for a person to read: 9900, "usd" -> "$99.00". A currency the browser does not know is
 * shown as its code after the number rather than failing.
 * @param {number | null | undefined} cents
 * @param {string} [currency]
 */
export function formatCents(cents, currency = "usd") {
  const amount = (Number(cents) || 0) / 100;
  try {
    return amount.toLocaleString("en-US", { style: "currency", currency: currency.toUpperCase() });
  } catch {
    return `${amount.toFixed(2)} ${String(currency).toUpperCase()}`;
  }
}
