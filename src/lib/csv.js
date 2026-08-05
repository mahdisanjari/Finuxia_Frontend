/** Quote a CSV cell only when needed (comma, quote, or newline present). */
function cell(value) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** rows: array of arrays. Returns a CSV string with CRLF line endings. */
export function toCsv(rows) {
  return rows.map((row) => row.map(cell).join(",")).join("\r\n");
}

/** Triggers a client-side download of `content` as `filename`. No network. */
export function downloadCsv(filename, content) {
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" }); // BOM for Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
