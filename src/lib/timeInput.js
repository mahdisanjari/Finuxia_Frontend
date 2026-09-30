/**
 * Lenient parser for a typed time string -> "HH:MM" (24-hour), or null if it
 * can't be made sense of. Accepts both 12-hour ("9:30am", "930p", "2 PM")
 * and 24-hour ("14:00", "0930") input, with or without a colon.
 */
export function parseTimeInput(raw) {
  const text = (raw || "").trim().toLowerCase();
  if (!text) return null;

  const match = text.match(/^(\d{1,2}):?(\d{2})?\s*(am|pm|a|p)?$/);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = match[2] !== undefined ? Number(match[2]) : 0;
  const meridiem = match[3];

  if (Number.isNaN(hour) || Number.isNaN(minute) || minute > 59) return null;

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    const isPM = meridiem[0] === "p";
    hour = hour % 12;
    if (isPM) hour += 12;
  } else if (hour > 23) {
    return null;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
