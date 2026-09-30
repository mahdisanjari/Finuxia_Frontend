/**
 * Formats digits as they're typed into a Canadian/NANP phone number:
 * (123) 456-7890. Non-digit input (spaces, dashes, parens already typed) is
 * stripped and re-applied, so pasting a raw number works the same as typing.
 */
export function formatCanadianPhone(value) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  const len = digits.length;
  if (len === 0) return "";
  if (len < 4) return `(${digits}`;
  if (len < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
