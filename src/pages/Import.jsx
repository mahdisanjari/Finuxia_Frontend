import { useRef, useState } from "react";
import { UploadCloud, FileSpreadsheet, CheckCircle2, XCircle, Download } from "lucide-react";
import { useClients } from "../context/ClientsContext";
import { useToast } from "../context/ToastContext";

// The columns the importer understands. Kept in one place so the downloadable
// template always matches what the parser expects.
const TEMPLATE_COLUMNS = [
  "Name",
  "Phone",
  "Email",
  "Telegram",
  "Referred By",
  "Stage",
  "Last Contact",
  "Next Follow-up",
];
// Sample row — its Name carries a clear "delete" marker; the importer skips
// any row whose name says SAMPLE + delete, so it can never become a real client.
const TEMPLATE_SAMPLE = {
  Name: "SAMPLE — delete this row before importing",
  Phone: "(555) 123-4567",
  Email: "jane.doe@email.com",
  Telegram: "@janedoe",
  "Referred By": "John Smith",
  Stage: "CP",
  "Last Contact": "2026-08-01",
  "Next Follow-up": "2026-08-20",
};

export default function Import() {
  const { importClients } = useClients();
  const { addToast } = useToast();
  const fileRef = useRef(null);

  const handleDownloadTemplate = async () => {
    // xlsx-js-style (a styled fork of SheetJS) so we can paint the sample row red.
    const XLSX = await import("xlsx-js-style");
    const ws = XLSX.utils.json_to_sheet([TEMPLATE_SAMPLE], { header: TEMPLATE_COLUMNS });
    ws["!cols"] = TEMPLATE_COLUMNS.map(() => ({ wch: 22 }));

    const headerStyle = { font: { bold: true } };
    const sampleStyle = {
      fill: { patternType: "solid", fgColor: { rgb: "FFFF0000" } }, // red
      font: { bold: true, color: { rgb: "FFFFFFFF" } },
    };
    TEMPLATE_COLUMNS.forEach((_, c) => {
      const head = ws[XLSX.utils.encode_cell({ r: 0, c })];
      if (head) head.s = headerStyle;
      const sample = ws[XLSX.utils.encode_cell({ r: 1, c })];
      if (sample) sample.s = sampleStyle;
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clients");
    XLSX.writeFile(wb, "advisorpilot-import-template.xlsx");
    addToast("Template downloaded");
  };
  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState(null);
  const [result, setResult] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");

  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setParseError("");
    setParsing(true);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      // cellDates + raw:false + dateNF → date cells arrive as "YYYY-MM-DD"
      // strings instead of Excel serial numbers, so Last Contact / Next
      // Follow-up parse correctly (no more 1970 dates).
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, {
        defval: "",
        raw: false,
        dateNF: "yyyy-mm-dd",
      });
      setParsedRows(rows);
    } catch (err) {
      setParseError("Could not read this file. Make sure it's a valid .xlsx or .csv export.");
      setParsedRows(null);
    } finally {
      setParsing(false);
    }
  };

  const handleImport = () => {
    if (!parsedRows) return;
    const res = importClients(parsedRows);
    setResult(res);
    if (res.successCount > 0) addToast(`Imported ${res.successCount} client${res.successCount === 1 ? "" : "s"}`);
  };

  const reset = () => {
    setFileName("");
    setParsedRows(null);
    setResult(null);
    setParseError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Import Clients</h1>
          <p className="text-sm text-slate-500">Upload a spreadsheet to bring your existing pipeline into Finuxia.</p>
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-navy shadow-sm transition hover:bg-slate-50"
        >
          <Download size={14} />
          Download Template
        </button>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="mb-4 text-sm text-slate-500">
          Expected columns:{" "}
          <span className="font-medium text-navy">
            Name, Phone, Email, Telegram, Referred By, Stage, Last Contact, Next Follow-up
          </span>
          . Only <span className="font-medium text-navy">Name</span> is required.
        </p>

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-6 py-10 text-center transition hover:border-gold hover:bg-gold/5">
          <UploadCloud size={28} className="text-slate-400" />
          <span className="text-sm font-semibold text-navy">
            {fileName || "Click to choose a .xlsx or .csv file"}
          </span>
          <span className="text-xs text-slate-400">or drag and drop</span>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>

        {parsing && <p className="mt-3 text-sm text-slate-500">Reading file...</p>}
        {parseError && <p className="mt-3 text-sm text-av-red">{parseError}</p>}

        {parsedRows && !result && (
          <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-navy">
              <FileSpreadsheet size={16} className="text-gold-dark" />
              {parsedRows.length} row{parsedRows.length === 1 ? "" : "s"} detected in {fileName}
            </div>
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                className="rounded-lg bg-navy px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-light"
              >
                Import
              </button>
            </div>
          </div>
        )}
      </section>

      {result && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-av-green/10 p-4">
              <div className="flex items-center gap-2 text-av-green">
                <CheckCircle2 size={16} />
                <span className="text-xs font-semibold uppercase tracking-wide">Success</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-navy">{result.successCount}</p>
            </div>
            <div className="rounded-xl bg-av-red/10 p-4">
              <div className="flex items-center gap-2 text-av-red">
                <XCircle size={16} />
                <span className="text-xs font-semibold uppercase tracking-wide">Failed</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-navy">{result.failedRows.length}</p>
            </div>
          </div>

          {result.failedRows.length > 0 && (
            <div className="mt-4 flex flex-col gap-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Errors</p>
              {result.failedRows.map((f, i) => (
                <p key={i} className="text-sm text-slate-600">
                  Row {f.row}: {f.error}
                </p>
              ))}
            </div>
          )}

          <button
            onClick={reset}
            className="mt-5 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-light"
          >
            Import Another File
          </button>
        </section>
      )}
    </div>
  );
}
