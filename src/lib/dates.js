export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const MIN_BIRTH_DATE = "1900-01-01";

// Empty string = fine (or not filled in yet); otherwise a message. A browser
// date input will happily accept a 6-digit year typed by hand ("146753"), so
// the value itself has to be checked, not just the input's min/max.
export function birthDateError(value) {
  if (!value) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Enter a valid date with a 4-digit year.";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return "That isn't a real calendar date.";
  if (value < MIN_BIRTH_DATE) return "Date of birth can't be before 1900.";
  if (value > todayISO()) return "Date of birth can't be in the future.";
  return "";
}
