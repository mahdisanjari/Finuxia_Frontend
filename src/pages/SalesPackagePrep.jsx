import Switch from "../components/Switch";
import useAiUsage from "../hooks/useAiUsage";
import AiUsageInline from "../components/AiUsageInline";
import AiBlockedNotice from "../components/AiBlockedNotice";
import { isAiBlocked } from "../lib/aiUsage";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Plus,
  Trash2,
  Upload,
  Download,
  CheckCircle2,
  Package,
  ChevronLeft,
  ChevronRight,
  Save,
  AlertTriangle,
  FileCheck2,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import SearchableSelect from "../components/SearchableSelect";
import { useClients } from "../context/ClientsContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { formatCurrencyInput } from "../lib/currency";
import { birthDateError, MIN_BIRTH_DATE, todayISO } from "../lib/dates";
import {
  CANADIAN_STATUSES,
  PROVINCES,
  MARITAL_STATUSES,
  DEPENDANT_RELATIONSHIPS,
  ACCOUNT_TYPES,
  FREQUENCIES,
  NEEDS,
  RISK_TOLERANCES,
  INVESTMENT_HORIZONS,
  INVESTMENT_OBJECTIVES,
  SOURCES_OF_FUNDS,
  EXISTING_COVERAGE_TYPES,
  INVESTMENT_BEARING_TYPES,
  UPLOADED_DOCUMENTS,
} from "../lib/salesPackageOptions";

const STEPS = ["Client", "Needs", "Products", "Details", "Reason Why Letter", "Compliance", "Documents", "Review"];

const emptySupervisionConfirmations = () => ({
  applicationReviewed: null,
  needsAnalysisReviewed: null,
  policyIllustrationsReviewed: null,
  lifeInsuranceReplacement: null,
  lirdReviewed: null,
  segFundsLeveraging: null,
  disclosureDocReviewed: null,
});

// lirdReviewed/disclosureDocReviewed only need an answer when their parent
// question was answered Yes.
const requiredSupervisionQuestions = (confirmations) => {
  const required = ["applicationReviewed", "needsAnalysisReviewed", "policyIllustrationsReviewed", "lifeInsuranceReplacement", "segFundsLeveraging"];
  if (confirmations.lifeInsuranceReplacement === true) required.push("lirdReviewed");
  if (confirmations.segFundsLeveraging === true) required.push("disclosureDocReviewed");
  return required;
};

const filled = (v) => (typeof v === "string" ? v.trim() !== "" : Boolean(v));

// Per-step completion for the stepper: `complete` = everything required on
// that step is done; `started` = something's been entered but it isn't
// finished (shown orange). `needsVisit` marks steps with nothing required
// that only count as done once the advisor has actually looked at them.
function computeStepStates({ data, documents, status }) {
  const investmentProducts = data.products.filter((p) => INVESTMENT_BEARING_TYPES.has(p.type));
  const allocationsOk = investmentProducts.every(
    (p) => p.allocations.length > 0 && Math.abs(p.allocations.reduce((sum, a) => sum + (parseFloat(a.allocationPct) || 0), 0) - 100) < 0.01
  );
  const productStarted = data.products.some((p) => p.companyId || p.productId || p.coverageAmount || p.premium || p.frequency);
  const productsComplete =
    data.products.length > 0 &&
    data.products.every((p) => p.companyId && p.productId && p.coverageAmount && p.frequency && p.premium && (p.type !== "segregated_fund" || p.accountType)) &&
    allocationsOk;
  const profile = data.investmentProfile || {};
  const profileFields = [profile.riskTolerance, profile.investmentHorizon, profile.investmentObjective, profile.sourceOfFunds];
  const clientRequired = [data.policyOwner, data.insuredPerson, data.canadianStatus, data.province, data.dateOfBirth];
  const confirmations = data.supervisionConfirmations || {};
  const requiredQs = requiredSupervisionQuestions(confirmations);

  return [
    {
      complete: clientRequired.every(filled) && !birthDateError(data.dateOfBirth) && data.dependants.every((d) => !birthDateError(d.dateOfBirth)),
      started: clientRequired.some(filled) || filled(data.maritalStatus) || filled(data.occupation) || filled(data.annualIncome) || data.dependants.length > 0,
    },
    { complete: data.needs.length > 0, started: data.needs.length > 0 || filled(data.otherNeed) },
    { complete: productsComplete, started: productStarted },
    {
      complete: investmentProducts.length > 0 ? profileFields.every(filled) : true,
      started: profileFields.some(filled) || data.existingCoverage.length > 0 || filled(data.advisorNotes),
      needsVisit: investmentProducts.length === 0,
    },
    { complete: filled(data.reasonWhyLetterText), started: filled(data.reasonWhyLetterText) },
    {
      complete: requiredQs.every((k) => confirmations[k] !== null && confirmations[k] !== undefined),
      started: Object.values(confirmations).some((v) => v !== null && v !== undefined),
    },
    { complete: documents.every((d) => d.uploaded), started: documents.some((d) => d.uploaded) },
    { complete: status === "completed", started: false, needsVisit: true },
  ];
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const emptyDependant = () => ({ id: uid(), fullName: "", relationship: "", relationshipOther: "", dateOfBirth: "" });
const emptyProduct = () => ({
  id: uid(),
  companyId: "",
  company: "",
  productId: "",
  productName: "",
  type: "",
  accountType: "",
  coverageAmount: "",
  premium: "",
  frequency: "",
  purpose: "",
  allocations: [],
});
const emptyAllocation = () => ({ id: uid(), fundId: "", fundName: "", allocationPct: "" });
const emptyCoverage = () => ({ id: uid(), provider: "", type: "", amount: "" });

const emptyData = () => ({
  policyOwner: "",
  insuredPerson: "",
  canadianStatus: "",
  province: "",
  dateOfBirth: "",
  maritalStatus: "",
  occupation: "",
  annualIncome: "",
  dependants: [],
  homeowner: false,
  mortgageBalance: "",
  otherMajorDebt: "",
  needs: [],
  otherNeed: "",
  products: [emptyProduct()],
  investmentProfile: { riskTolerance: "", investmentHorizon: "", investmentObjective: "", sourceOfFunds: "" },
  existingCoverage: [],
  advisorNotes: "",
  reasonWhyLetterText: "",
  supervisionConfirmations: emptySupervisionConfirmations(),
});

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30";

export default function SalesPackagePrep() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const packageId = searchParams.get("id");

  const [mode, setMode] = useState("loading"); // loading | picker | wizard
  const [myPackages, setMyPackages] = useState([]);

  const [status, setStatus] = useState("draft");
  const [data, setData] = useState(emptyData());
  const [documents, setDocuments] = useState(UPLOADED_DOCUMENTS.map((d) => ({ ...d, uploaded: false })));
  const [step, setStep] = useState(0);
  const [docVersion, setDocVersion] = useState(0);
  const [visited, setVisited] = useState(() => new Set([0]));
  const [saving, setSaving] = useState(false);
  // The server version this wizard's data is based on; a save sends it so a stale tab can't overwrite a newer save.
  const packageVersionRef = useRef(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const [companies, setCompanies] = useState([]);
  const [productsByCompany, setProductsByCompany] = useState({});
  const [fundsByKey, setFundsByKey] = useState({});

  const [uploadProgress, setUploadProgress] = useState({});
  const [letterDrafting, setLetterDrafting] = useState(false);
  // The advisor's AI allowance (for the 80% / 95% warnings) and, if a draft was blocked, why.
  const { usage: aiUsage, refresh: refreshAiUsage } = useAiUsage();
  const [letterBlocked, setLetterBlocked] = useState(null);
  const [disclosureGenerating, setDisclosureGenerating] = useState(false);
  const [supervisionGenerating, setSupervisionGenerating] = useState(false);

  // --- bootstrap ---
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (packageId) {
        setMode("loading");
        try {
          const pkg = await api.getSalesPackage(packageId);
          if (cancelled) return;
          loadPackageInto(pkg);
          setMode("wizard");
        } catch (err) {
          if (!cancelled) addToast(err.message || "Could not load this sales package.");
        }
        return;
      }
      setMode("loading");
      try {
        const list = await api.getSalesPackages();
        if (cancelled) return;
        if (list.length > 0) {
          setMyPackages(list);
          setMode("picker");
        } else {
          await startNewDraft();
        }
      } catch (err) {
        if (!cancelled) addToast(err.message || "Could not load your sales packages.");
      }
    }
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once per package id; startNewDraft and addToast are not stable and must not retrigger it
  }, [packageId]);

  useEffect(() => {
    api.getSalesPackageCompanies().then(setCompanies).catch(() => {});
  }, []);

  // Bumping docVersion makes the Review step's inline previews refetch.
  const applyDocuments = (docs) => {
    setDocuments(docs);
    setDocVersion((v) => v + 1);
  };

  const loadPackageInto = (pkg) => {
    packageVersionRef.current = pkg.version;
    const products = pkg.data.products?.length ? pkg.data.products : [emptyProduct()];
    setStatus(pkg.status);
    setData({ ...emptyData(), ...pkg.data, products });
    applyDocuments(pkg.documents);
    setConfirmChecked(false);
    setStep(0);
    setVisited(new Set([0]));
    // Pre-fetch each row's product/fund dropdown data — otherwise a
    // reopened draft shows blank "Select Product"/"Select fund" dropdowns
    // even though a selection is already saved, since those lists are
    // normally only fetched on the change handler, not on load.
    for (const p of products) {
      if (p.companyId) loadProductsFor(p.companyId);
      if (p.companyId && p.type && INVESTMENT_BEARING_TYPES.has(p.type)) loadFundsFor(p.companyId, p.type);
    }
  };

  const startNewDraft = async () => {
    try {
      const created = await api.createSalesPackage();
      const next = new URLSearchParams(searchParams);
      next.set("id", String(created.id));
      setSearchParams(next, { replace: true });
      loadPackageInto(created);
      setMode("wizard");
    } catch (err) {
      addToast(err.message || "Could not start a new sales package.");
    }
  };

  const resumePackage = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set("id", String(id));
    setSearchParams(next, { replace: true });
  };

  const handleDeleteDraft = async (id, label) => {
    if (!window.confirm(`Delete "${label || "this draft"}"? This can't be undone.`)) return;
    try {
      await api.deleteSalesPackage(id);
      setMyPackages((list) => list.filter((p) => p.id !== id));
      addToast("Sales package deleted");
    } catch (err) {
      addToast(err.message || "Could not delete this sales package");
    }
  };

  const loadProductsFor = async (companyId) => {
    if (!companyId || productsByCompany[companyId]) return;
    try {
      const list = await api.getSalesPackageProducts(companyId);
      setProductsByCompany((m) => ({ ...m, [companyId]: list }));
    } catch {
      /* leave dropdown empty on failure */
    }
  };

  const loadFundsFor = async (companyId, investmentType) => {
    const key = `${companyId}-${investmentType}`;
    if (!companyId || !investmentType || fundsByKey[key]) return;
    try {
      const list = await api.getSalesPackageFunds(companyId, investmentType);
      setFundsByKey((m) => ({ ...m, [key]: list }));
    } catch {
      /* leave dropdown empty on failure */
    }
  };

  const patch = (fields) => setData((d) => ({ ...d, ...fields }));

  const saveDraft = async ({ silent = false } = {}) => {
    if (!packageId) return;
    setSaving(true);
    try {
      const saved = await api.saveSalesPackageDraft(packageId, data, packageVersionRef.current);
      packageVersionRef.current = saved.version;
      if (!silent) addToast("Draft saved");
      return true;
    } catch (err) {
      if (err.status === 409 && err.data?.package) {
        // Saved from another tab/device first — show that version rather than overwrite it.
        loadPackageInto(err.data.package);
        addToast("This package was changed elsewhere — showing the latest version. Re-apply your edits if needed.");
      } else {
        addToast(err.message || "Could not save draft");
      }
      return false;
    } finally {
      setSaving(false);
    }
  };

  const productsNeedingAllocation = () =>
    data.products.filter((p) => INVESTMENT_BEARING_TYPES.has(p.type)).filter((p) => {
      const total = p.allocations.reduce((sum, a) => sum + (parseFloat(a.allocationPct) || 0), 0);
      return p.allocations.length === 0 || Math.abs(total - 100) > 0.01;
    });

  const goStep = async (next) => {
    if (next > step && step === 0) {
      const badDob = birthDateError(data.dateOfBirth) || data.dependants.map((d) => birthDateError(d.dateOfBirth)).find(Boolean);
      if (badDob) {
        addToast(`Fix the date of birth first: ${badDob}`);
        return;
      }
    }
    if (next > step && step === 2) {
      const noAccount = data.products.find((p) => p.type === "segregated_fund" && !p.accountType);
      if (noAccount) {
        addToast(`Choose an Account Type for ${noAccount.productName || "the Segregated Fund"} before continuing.`);
        return;
      }
      const incomplete = productsNeedingAllocation();
      if (incomplete.length > 0) {
        addToast(`Fund allocations must total 100% before continuing (${incomplete[0].productName || "a product"} isn't there yet).`);
        return;
      }
    }
    if (next > step && step === 4 && !data.reasonWhyLetterText.trim()) {
      addToast("Generate and save the Reason Why Letter before continuing.");
      return;
    }
    if (next > step && step === 5) {
      const unanswered = requiredSupervisionQuestions(data.supervisionConfirmations).filter(
        (key) => data.supervisionConfirmations[key] === null || data.supervisionConfirmations[key] === undefined
      );
      if (unanswered.length > 0) {
        addToast("Answer all compliance confirmation questions before continuing.");
        return;
      }
    }
    await saveDraft({ silent: true });
    setStep(next);
    setVisited((v) => new Set(v).add(next));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ---- Products helpers ----
  const updateProduct = (id, fields) => patch({ products: data.products.map((p) => (p.id === id ? { ...p, ...fields } : p)) });
  const addProduct = () => patch({ products: [...data.products, emptyProduct()] });
  const removeProduct = (id) => patch({ products: data.products.length > 1 ? data.products.filter((p) => p.id !== id) : data.products });

  const handleCompanyChange = (productRowId, companyId) => {
    const company = companies.find((c) => String(c.id) === String(companyId));
    updateProduct(productRowId, { companyId, company: company?.name || "", productId: "", productName: "", type: "", accountType: "", allocations: [] });
    loadProductsFor(companyId);
  };

  const handleProductChange = (productRowId, productId) => {
    const row = data.products.find((p) => p.id === productRowId);
    const list = productsByCompany[row.companyId] || [];
    const product = list.find((p) => String(p.id) === String(productId));
    updateProduct(productRowId, { productId, productName: product?.name || "", type: product?.type || "", accountType: "", allocations: [] });
    if (product && INVESTMENT_BEARING_TYPES.has(product.type)) {
      loadFundsFor(row.companyId, product.type);
    }
  };

  const addAllocation = (productRowId) => {
    const row = data.products.find((p) => p.id === productRowId);
    updateProduct(productRowId, { allocations: [...row.allocations, emptyAllocation()] });
  };
  const updateAllocation = (productRowId, allocId, fields) => {
    const row = data.products.find((p) => p.id === productRowId);
    updateProduct(productRowId, { allocations: row.allocations.map((a) => (a.id === allocId ? { ...a, ...fields } : a)) });
  };
  const removeAllocation = (productRowId, allocId) => {
    const row = data.products.find((p) => p.id === productRowId);
    updateProduct(productRowId, { allocations: row.allocations.filter((a) => a.id !== allocId) });
  };

  const hasInvestmentProduct = data.products.some((p) => INVESTMENT_BEARING_TYPES.has(p.type));

  // ---- Documents ----
  const handleUploadDoc = async (key, label, file) => {
    if (!file) return;
    const wordAllowed = key === "reasonWhyLetter";
    const lower = file.name.toLowerCase();
    if (!(lower.endsWith(".pdf") || (wordAllowed && lower.endsWith(".docx")))) {
      addToast(wordAllowed ? `${label} must be a PDF or Word (.docx) file.` : `${label} must be a PDF file.`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      addToast(`${label} is larger than 10 MB.`);
      return;
    }
    setUploadProgress((p) => ({ ...p, [key]: 0 }));
    try {
      const pkg = await api.uploadSalesPackageDocument(packageId, key, file, (pct) =>
        setUploadProgress((p) => ({ ...p, [key]: pct }))
      );
      applyDocuments(pkg.documents);
      addToast(wordAllowed && lower.endsWith(".docx") ? `${label} uploaded and converted to PDF` : `${label} uploaded`);
    } catch (err) {
      addToast(err.message || `Could not upload ${label}`);
    } finally {
      setUploadProgress((p) => {
        const next = { ...p };
        delete next[key];
        return next;
      });
    }
  };

  // ---- Letter + Agent Disclosure ----
  const handleDraftLetter = async () => {
    setLetterDrafting(true);
    setLetterBlocked(null);
    try {
      const { text } = await api.draftReasonWhyLetter(packageId);
      patch({ reasonWhyLetterText: text });
    } catch (err) {
      // An out-of-credit / not-in-plan answer is explained on the page with a way out, not flashed as a toast.
      if (isAiBlocked(err)) setLetterBlocked(err);
      else addToast(err.message || "Could not draft the Reason Why Letter");
    } finally {
      setLetterDrafting(false);
      refreshAiUsage();
    }
  };
  const handleSaveLetter = async () => {
    try {
      const pkg = await api.saveReasonWhyLetter(packageId, data.reasonWhyLetterText, packageVersionRef.current);
      // The letter is part of the package, so saving it advanced the package version.
      packageVersionRef.current = pkg.version;
      setStatus(pkg.status);
      applyDocuments(pkg.documents);
      addToast("Reason Why Letter saved");
    } catch (err) {
      if (err.status === 409 && err.data?.package) {
        loadPackageInto(err.data.package);
        addToast("This package was changed elsewhere — showing the latest version. Re-apply your edits if needed.");
      } else {
        addToast(err.message || "Could not save the letter");
      }
    }
  };
  const handleGenerateDisclosure = async () => {
    setDisclosureGenerating(true);
    try {
      const pkg = await api.generateAgentDisclosure(packageId);
      applyDocuments(pkg.documents);
      addToast("Agent Disclosure Form generated and attached");
    } catch (err) {
      addToast(err.message || "Could not generate the Agent Disclosure Form");
    } finally {
      setDisclosureGenerating(false);
    }
  };

  const handleGenerateSupervisionForm = async () => {
    setSupervisionGenerating(true);
    try {
      const pkg = await api.generateSupervisionForm(packageId, data.supervisionConfirmations);
      applyDocuments(pkg.documents);
      addToast("Supervision Form generated and attached");
    } catch (err) {
      addToast(err.message || "Could not generate the Supervision Form");
    } finally {
      setSupervisionGenerating(false);
    }
  };

  const handleDownloadDocument = async (key, label, generated = false) => {
    try {
      await api.downloadSalesPackageDocument(packageId, key, `${label.replace(/\s+/g, "_")}.pdf`, generated);
    } catch (err) {
      addToast(err.message || `Could not download ${label}`);
    }
  };

  const handleDownloadLetterPdf = async () => {
    try {
      await api.downloadReasonWhyLetterPdf(packageId);
    } catch (err) {
      addToast(err.message || "Could not download the letter");
    }
  };

  // ---- Generate ----
  const handleGenerate = async () => {
    setError("");
    // Never confirm/generate from data that wasn't saved (e.g. a version conflict reloaded newer data).
    if (!(await saveDraft({ silent: true }))) return;
    setGenerating(true);
    try {
      await api.confirmSalesPackage(packageId);
      const insured = (data.insuredPerson || "Client").trim().replace(/\s+/g, "_");
      await api.generateSalesPackage(packageId, `${insured}_DocuSeal_Package.pdf`);
      setStatus("completed");
      addToast("Sales package generated");
    } catch (err) {
      setError(err.message || "Could not generate the sales package.");
    } finally {
      setGenerating(false);
    }
  };

  if (mode === "loading") {
    return <div className="py-20 text-center text-sm text-slate-400">Loading...</div>;
  }

  if (mode === "picker") {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-navy">Sales Package Prep</h1>
          <p className="text-sm text-slate-500">You have saved sales packages in progress — continue one, or start a new one.</p>
        </div>
        <div className="flex flex-col gap-2.5">
          {myPackages.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-gold"
            >
              <button type="button" onClick={() => resumePackage(p.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold text-navy">
                  {p.insuredPerson || p.policyOwner || "Untitled package"}
                </p>
                <p className="text-xs text-slate-400">
                  {p.status === "completed" ? "Completed" : "Draft"} · last saved {new Date(p.updatedAt).toLocaleString()}
                </p>
              </button>
              <button
                type="button"
                onClick={() => handleDeleteDraft(p.id, p.insuredPerson || p.policyOwner)}
                className="flex shrink-0 items-center justify-center rounded-lg p-2 text-slate-400 transition hover:bg-av-red/10 hover:text-av-red"
                title="Delete"
                aria-label="Delete draft"
              >
                <Trash2 size={15} />
              </button>
              <button
                type="button"
                onClick={() => resumePackage(p.id)}
                className="shrink-0 rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white"
              >
                Continue
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={startNewDraft}
          className="flex w-fit items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-navy transition hover:bg-gold-light"
        >
          <Plus size={15} />
          Start a New Sales Package
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Sales Package Prep</h1>
          <p className="text-sm text-slate-500">Enter client information, select products, upload documents, and create a complete package.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => saveDraft()}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-navy transition hover:bg-slate-50 disabled:opacity-60"
          >
            <Save size={14} />
            {saving ? "Saving..." : "Save Draft"}
          </button>
        </div>
      </div>

      <Stepper
        steps={STEPS}
        current={step}
        statuses={computeStepStates({ data, documents, status }).map((st, i) => {
          const done = st.complete && (!st.needsVisit || visited.has(i));
          if (done) return "complete";
          return st.started || visited.has(i) ? "incomplete" : "pending";
        })}
        onSelect={(i) => goStep(i)}
      />

      {step === 0 && <ClientStep data={data} patch={patch} />}
      {step === 1 && <NeedsStep data={data} patch={patch} />}
      {step === 2 && (
        <ProductsStep
          data={data}
          companies={companies}
          productsByCompany={productsByCompany}
          fundsByKey={fundsByKey}
          onAddProduct={addProduct}
          onRemoveProduct={removeProduct}
          onCompanyChange={handleCompanyChange}
          onProductChange={handleProductChange}
          onFieldChange={updateProduct}
          onAddAllocation={addAllocation}
          onUpdateAllocation={updateAllocation}
          onRemoveAllocation={removeAllocation}
        />
      )}
      {step === 3 && <DetailsStep data={data} patch={patch} hasInvestmentProduct={hasInvestmentProduct} />}
      {step === 4 && (
        <LetterStep
          data={data}
          patch={patch}
          letterDoc={documents.find((d) => d.key === "reasonWhyLetter")}
          onDownload={handleDownloadDocument}
          onDownloadLetterPdf={handleDownloadLetterPdf}
          onDraftLetter={handleDraftLetter}
          letterDrafting={letterDrafting}
          aiUsage={aiUsage}
          letterBlocked={letterBlocked}
          onDismissBlocked={() => setLetterBlocked(null)}
          onSaveLetter={handleSaveLetter}
        />
      )}
      {step === 5 && <ComplianceStep data={data} patch={patch} profile={user} />}
      {step === 6 && (
        <DocumentsStep
          documents={documents}
          uploadProgress={uploadProgress}
          onUpload={handleUploadDoc}
          onDownload={handleDownloadDocument}
          onDownloadLetterPdf={handleDownloadLetterPdf}
          onGenerateDisclosure={handleGenerateDisclosure}
          disclosureGenerating={disclosureGenerating}
          onGenerateSupervisionForm={handleGenerateSupervisionForm}
          supervisionGenerating={supervisionGenerating}
        />
      )}
      {step === 7 && (
        <ReviewStep
          data={data}
          patch={patch}
          packageId={packageId}
          docVersion={docVersion}
          uploadProgress={uploadProgress}
          advisorName={user?.name}
          documents={documents}
          onUpload={handleUploadDoc}
          onDownload={handleDownloadDocument}
          onSaveLetter={handleSaveLetter}
          confirmChecked={confirmChecked}
          setConfirmChecked={setConfirmChecked}
          onGenerate={handleGenerate}
          generating={generating}
          error={error}
          status={status}
        />
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => goStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
        >
          <ChevronLeft size={15} />
          Back
        </button>
        {step < STEPS.length - 1 && (
          <button
            type="button"
            onClick={() => goStep(Math.min(STEPS.length - 1, step + 1))}
            className="flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light"
          >
            Next
            <ChevronRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

function Stepper({ steps, current, statuses, onSelect }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center overflow-x-auto rounded-2xl border border-slate-200 bg-white p-3">
        {steps.map((label, i) => {
          const st = statuses[i];
          const isCurrent = i === current;
          const circle = isCurrent
            ? "bg-navy text-white"
            : st === "complete"
              ? "bg-av-green text-white"
              : st === "incomplete"
                ? "bg-amber-100 text-amber-700 ring-1 ring-amber-400"
                : "bg-slate-100 text-slate-400";
          const text = isCurrent ? "text-navy" : st === "complete" ? "text-av-green" : st === "incomplete" ? "text-amber-600" : "text-slate-400";
          return (
            <button key={label} type="button" onClick={() => onSelect(i)} className="flex shrink-0 items-center gap-2 px-2">
              <span className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${circle}`}>
                {st === "complete" && !isCurrent ? <CheckCircle2 size={15} /> : st === "incomplete" && !isCurrent ? <AlertTriangle size={13} /> : i + 1}
                {isCurrent && st === "incomplete" && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-amber-400" />}
                {isCurrent && st === "complete" && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-av-green" />}
              </span>
              <span className={`whitespace-nowrap text-sm font-medium ${text}`}>{label}</span>
              {i < steps.length - 1 && <span className="mx-2 h-px w-6 shrink-0 bg-slate-200" />}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-4 px-1 text-[11px] text-slate-400">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-av-green" /> Complete</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> Incomplete</span>
      </div>
    </div>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-navy">{title}</h2>
      {subtitle && <p className="mb-4 mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </section>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label} {required && <span className="text-av-red">*</span>}
      </span>
      {children}
    </label>
  );
}

// A currency-formatted <input> that preserves the cursor position while
// typing — reformatting on every keystroke (to insert commas as the
// advisor types) otherwise moves the cursor to the end, so typing a digit
// or decimal point anywhere but the very end scrambles the value.
function CurrencyInput({ value, onChange, className, placeholder, disabled, title }) {
  const ref = useRef(null);
  const handleChange = (e) => {
    const input = e.target;
    const prevCursor = input.selectionStart ?? input.value.length;
    const digitsBeforeCursor = input.value.slice(0, prevCursor).replace(/[^\d.]/g, "").length;
    const formatted = formatCurrencyInput(input.value);
    let seen = 0;
    let cursor = formatted.length;
    for (let i = 0; i < formatted.length; i++) {
      if (/[\d.]/.test(formatted[i])) seen++;
      if (seen >= digitsBeforeCursor) {
        cursor = i + 1;
        break;
      }
    }
    onChange(formatted);
    requestAnimationFrame(() => ref.current?.setSelectionRange(cursor, cursor));
  };
  return (
    <input
      ref={ref}
      inputMode="decimal"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      title={title}
      onChange={handleChange}
      className={className}
    />
  );
}

function CurrencyField({ label, value, onChange, placeholder }) {
  return (
    <Field label={label}>
      <CurrencyInput value={value} onChange={onChange} placeholder={placeholder} className={inputClass} />
    </Field>
  );
}

function ClientStep({ data, patch }) {
  const { clients } = useClients();
  const clientOptions = clients.map((c) => {
    const name = `${c.first || ""} ${c.last || ""}`.trim();
    return { value: String(c.id), label: name, search: `${name} ${c.email || ""} ${c.phone || ""}` };
  }).filter((o) => o.label);
  const updateDependant = (id, fields) => patch({ dependants: data.dependants.map((d) => (d.id === id ? { ...d, ...fields } : d)) });
  const addDependant = () => patch({ dependants: [...data.dependants, emptyDependant()] });
  const removeDependant = (id) => patch({ dependants: data.dependants.filter((d) => d.id !== id) });

  return (
    <>
      <Card title="Client Information" subtitle="Enter the basic details for this sales package.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Policy Owner" required>
            <SearchableSelect
              freeText
              placeholder="Type a name or pick one of your clients"
              value={data.policyOwner}
              options={clientOptions}
              onChange={(name, option) => {
                const picked = option ? clients.find((c) => String(c.id) === option.value) : null;
                if (!picked) return patch({ policyOwner: name });
                // Pull in what's already on file for this client — but never
                // overwrite something the advisor has already typed.
                const fill = (current, incoming) => (current ? current : incoming || "");
                patch({
                  policyOwner: name,
                  insuredPerson: fill(data.insuredPerson, name),
                  dateOfBirth: fill(data.dateOfBirth, picked.dateOfBirth),
                  province: fill(data.province, picked.province),
                  occupation: fill(data.occupation, picked.job),
                });
              }}
            />
          </Field>
          <Field label="Insured Person" required>
            <input className={inputClass} value={data.insuredPerson} onChange={(e) => patch({ insuredPerson: e.target.value })} />
          </Field>
          <Field label="Canadian Status" required>
            <select className={inputClass} value={data.canadianStatus} onChange={(e) => patch({ canadianStatus: e.target.value })}>
              <option value="">Select...</option>
              {CANADIAN_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Province" required>
            <select className={inputClass} value={data.province} onChange={(e) => patch({ province: e.target.value })}>
              <option value="">Select...</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="Date of Birth" required>
            <input
              type="date"
              min={MIN_BIRTH_DATE}
              max={todayISO()}
              className={`${inputClass} ${birthDateError(data.dateOfBirth) ? "border-av-red focus:border-av-red focus:ring-av-red/20" : ""}`}
              value={data.dateOfBirth}
              onChange={(e) => patch({ dateOfBirth: e.target.value })}
            />
            {birthDateError(data.dateOfBirth) && <span className="text-xs text-av-red">{birthDateError(data.dateOfBirth)}</span>}
          </Field>
          <Field label="Marital Status">
            <select className={inputClass} value={data.maritalStatus} onChange={(e) => patch({ maritalStatus: e.target.value })}>
              <option value="">Select...</option>
              {MARITAL_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Occupation">
            <input className={inputClass} value={data.occupation} onChange={(e) => patch({ occupation: e.target.value })} />
          </Field>
          <CurrencyField label="Annual Income" value={data.annualIncome} onChange={(v) => patch({ annualIncome: v })} placeholder="$120,000" />
        </div>
      </Card>

      <Card title="Financial Situation" subtitle="Mortgage and other debt obligations.">
        <div className="mb-4 flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
          <span className="text-sm text-navy">Homeowner?</span>
          <Switch label="Homeowner?" checked={data.homeowner} onChange={(e) => patch({ homeowner: e.target.checked })} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {data.homeowner && (
            <CurrencyField label="Mortgage Balance" value={data.mortgageBalance} onChange={(v) => patch({ mortgageBalance: v })} placeholder="$400,000" />
          )}
          <CurrencyField label="Other Major Debt" value={data.otherMajorDebt} onChange={(v) => patch({ otherMajorDebt: v })} />
        </div>
      </Card>

      <Card title="Family" subtitle="Dependants for this client.">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Dependants</span>
          <button type="button" onClick={addDependant} className="flex items-center gap-1 text-xs font-semibold text-gold-dark hover:underline">
            <Plus size={12} />
            {data.dependants.length ? "Add Another Dependant" : "Add Dependant"}
          </button>
        </div>
        <div className="mt-2 flex flex-col gap-3">
          {data.dependants.map((dep) => (
            <div key={dep.id} className="rounded-xl border border-slate-200 p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Full Name</span>
                  <input
                    placeholder="Full name"
                    value={dep.fullName}
                    onChange={(e) => updateDependant(dep.id, { fullName: e.target.value })}
                    className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-navy outline-none focus:border-gold"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Relationship</span>
                  <select
                    value={dep.relationship}
                    onChange={(e) => updateDependant(dep.id, { relationship: e.target.value })}
                    className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-navy outline-none focus:border-gold"
                  >
                    <option value="">Select...</option>
                    {DEPENDANT_RELATIONSHIPS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </label>
                {dep.relationship === "Other" && (
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Specify Relationship</span>
                    <input
                      placeholder="e.g. Grandchild"
                      value={dep.relationshipOther}
                      onChange={(e) => updateDependant(dep.id, { relationshipOther: e.target.value })}
                      className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-navy outline-none focus:border-gold"
                    />
                  </label>
                )}
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Date of Birth</span>
                  <input
                    type="date"
                    min={MIN_BIRTH_DATE}
                    max={todayISO()}
                    value={dep.dateOfBirth}
                    onChange={(e) => updateDependant(dep.id, { dateOfBirth: e.target.value })}
                    className={`rounded-lg border px-2.5 py-2 text-sm text-navy outline-none focus:border-gold ${birthDateError(dep.dateOfBirth) ? "border-av-red" : "border-slate-200"}`}
                  />
                  {birthDateError(dep.dateOfBirth) && <span className="text-xs text-av-red">{birthDateError(dep.dateOfBirth)}</span>}
                </label>
              </div>
              <button
                type="button"
                onClick={() => removeDependant(dep.id)}
                className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-400 transition hover:text-av-red"
              >
                <Trash2 size={13} />
                Remove dependant
              </button>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function NeedsStep({ data, patch }) {
  const toggleNeed = (need) =>
    patch({ needs: data.needs.includes(need) ? data.needs.filter((n) => n !== need) : [...data.needs, need] });
  return (
    <Card title="Client Needs & Objectives" subtitle="Select all that apply for this client.">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {NEEDS.map((need) => (
          <label
            key={need}
            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
              data.needs.includes(need) ? "border-gold bg-gold/10 text-gold-dark" : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <input type="checkbox" checked={data.needs.includes(need)} onChange={() => toggleNeed(need)} className="accent-gold" />
            {need}
          </label>
        ))}
      </div>
      <label className="mt-4 flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Other (optional)</span>
        <input className={inputClass} value={data.otherNeed} onChange={(e) => patch({ otherNeed: e.target.value })} />
      </label>
    </Card>
  );
}

function ProductsStep({
  data,
  companies,
  productsByCompany,
  fundsByKey,
  onAddProduct,
  onRemoveProduct,
  onCompanyChange,
  onProductChange,
  onFieldChange,
  onAddAllocation,
  onUpdateAllocation,
  onRemoveAllocation,
}) {
  return (
    <Card title="Products Sold / Recommended" subtitle="Add all products for this client.">
      <div className="flex flex-col gap-3">
        {data.products.map((p) => {
          const products = productsByCompany[p.companyId] || [];
          const isInvestmentBearing = INVESTMENT_BEARING_TYPES.has(p.type);
          const fundKey = `${p.companyId}-${p.type}`;
          const funds = fundsByKey[fundKey] || [];
          const total = p.allocations.reduce((sum, a) => sum + (parseFloat(a.allocationPct) || 0), 0);
          return (
            <div key={p.id} className="rounded-xl border border-slate-200 p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-center">
                <select
                  value={p.companyId}
                  onChange={(e) => onCompanyChange(p.id, e.target.value)}
                  className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-navy outline-none focus:border-gold sm:col-span-3"
                >
                  <option value="">Select Company</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select
                  value={p.productId}
                  onChange={(e) => onProductChange(p.id, e.target.value)}
                  disabled={!p.companyId}
                  className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-navy outline-none focus:border-gold disabled:bg-slate-50 disabled:text-slate-400 sm:col-span-3"
                >
                  <option value="">{p.companyId ? "Select Product" : "Pick a company first"}</option>
                  {products.map((prod) => (
                    <option key={prod.id} value={prod.id}>{prod.name}</option>
                  ))}
                </select>
                <CurrencyInput
                  value={p.coverageAmount}
                  onChange={(v) => onFieldChange(p.id, { coverageAmount: v })}
                  placeholder="Face Amount"
                  className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-navy outline-none focus:border-gold sm:col-span-2"
                />
                <select
                  value={p.frequency}
                  onChange={(e) => onFieldChange(p.id, { frequency: e.target.value })}
                  className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-navy outline-none focus:border-gold sm:col-span-2"
                >
                  <option value="">Frequency</option>
                  {FREQUENCIES.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
                <CurrencyInput
                  value={p.premium}
                  disabled={!p.frequency}
                  onChange={(v) => onFieldChange(p.id, { premium: v })}
                  placeholder={p.frequency ? "Premium" : "Pick frequency"}
                  title={p.frequency ? undefined : "Select a frequency first"}
                  className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-navy outline-none focus:border-gold disabled:bg-slate-50 disabled:text-slate-400 sm:col-span-1"
                />
                <button type="button" onClick={() => onRemoveProduct(p.id)} className="flex items-center justify-center rounded-lg p-2 text-slate-400 transition hover:bg-av-red/10 hover:text-av-red sm:col-span-1">
                  <Trash2 size={15} />
                </button>
              </div>

              {/* Fund allocation — rendered immediately under THIS product's own
                  row, never in a separate section, so it's unambiguous which
                  product each allocation belongs to. */}
              {p.type === "segregated_fund" && (
                <label className="mt-3 flex max-w-xs flex-col gap-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Account Type <span className="text-av-red">*</span>
                  </span>
                  <select
                    value={p.accountType || ""}
                    onChange={(e) => onFieldChange(p.id, { accountType: e.target.value })}
                    className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-navy outline-none focus:border-gold"
                  >
                    <option value="">Select account type...</option>
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
              )}

              {isInvestmentBearing && (
                <div className="mt-3 rounded-lg bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Fund Allocation — {p.productName}
                    </span>
                    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${Math.abs(total - 100) < 0.01 ? "bg-av-green/10 text-av-green" : "bg-av-red/10 text-av-red"}`}>
                      {Math.abs(total - 100) < 0.01 ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                      {total}% allocated
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {p.allocations.map((a) => (
                      <div key={a.id} className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-center">
                        <SearchableSelect
                          className="sm:col-span-8"
                          placeholder="Select fund — type to search"
                          value={a.fundId}
                          options={funds.map((f) => ({
                            value: String(f.id),
                            label: f.category ? `${f.category} — ${f.displayName}` : f.displayName,
                          }))}
                          onChange={(fundId) => {
                            const fund = funds.find((f) => String(f.id) === String(fundId));
                            onUpdateAllocation(p.id, a.id, { fundId, fundName: fund?.displayName || "" });
                          }}
                        />
                        <div className="relative sm:col-span-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={a.allocationPct}
                            onChange={(e) => onUpdateAllocation(p.id, a.id, { allocationPct: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-navy outline-none focus:border-gold"
                          />
                          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                        </div>
                        <button type="button" onClick={() => onRemoveAllocation(p.id, a.id)} className="flex items-center justify-center rounded-lg p-2 text-slate-400 transition hover:bg-av-red/10 hover:text-av-red sm:col-span-1">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => onAddAllocation(p.id)}
                    className="mt-2 flex items-center gap-1 text-xs font-semibold text-gold-dark hover:underline"
                  >
                    <Plus size={12} />
                    {p.allocations.length ? "Add Another Fund" : "Add Fund"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button type="button" onClick={onAddProduct} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-gold-dark transition hover:underline">
        <Plus size={14} />
        Add Another Product
      </button>
    </Card>
  );
}

function DetailsStep({ data, patch, hasInvestmentProduct }) {
  const updateCoverage = (id, fields) => patch({ existingCoverage: data.existingCoverage.map((c) => (c.id === id ? { ...c, ...fields } : c)) });
  const addCoverage = () => patch({ existingCoverage: [...data.existingCoverage, emptyCoverage()] });
  const removeCoverage = (id) => patch({ existingCoverage: data.existingCoverage.filter((c) => c.id !== id) });
  const patchInvestmentProfile = (fields) => patch({ investmentProfile: { ...data.investmentProfile, ...fields } });

  return (
    <>
      {hasInvestmentProduct && (
        <Card title="Investment Profile" subtitle="Complete investment profile for UL/Seg fund products.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Field label="Risk Tolerance">
              <select className={inputClass} value={data.investmentProfile.riskTolerance} onChange={(e) => patchInvestmentProfile({ riskTolerance: e.target.value })}>
                <option value="">Select...</option>
                {RISK_TOLERANCES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Investment Horizon">
              <select className={inputClass} value={data.investmentProfile.investmentHorizon} onChange={(e) => patchInvestmentProfile({ investmentHorizon: e.target.value })}>
                <option value="">Select...</option>
                {INVESTMENT_HORIZONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Investment Objective">
              <select className={inputClass} value={data.investmentProfile.investmentObjective} onChange={(e) => patchInvestmentProfile({ investmentObjective: e.target.value })}>
                <option value="">Select...</option>
                {INVESTMENT_OBJECTIVES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Source of Funds">
              <select className={inputClass} value={data.investmentProfile.sourceOfFunds} onChange={(e) => patchInvestmentProfile({ sourceOfFunds: e.target.value })}>
                <option value="">Select...</option>
                {SOURCES_OF_FUNDS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
          </div>
        </Card>
      )}

      <Card title="Existing Insurance & Investments" subtitle="Add any existing coverage the client has.">
        <div className="flex flex-col gap-2">
          {data.existingCoverage.map((c) => (
            <div key={c.id} className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-center">
              <input
                placeholder="Provider"
                value={c.provider}
                onChange={(e) => updateCoverage(c.id, { provider: e.target.value })}
                className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-navy outline-none focus:border-gold sm:col-span-4"
              />
              <select
                value={c.type}
                onChange={(e) => updateCoverage(c.id, { type: e.target.value })}
                className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-navy outline-none focus:border-gold sm:col-span-4"
              >
                <option value="">Type</option>
                {EXISTING_COVERAGE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <CurrencyInput
                placeholder="$0"
                value={c.amount}
                onChange={(v) => updateCoverage(c.id, { amount: v })}
                className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-navy outline-none focus:border-gold sm:col-span-3"
              />
              <button type="button" onClick={() => removeCoverage(c.id)} className="flex items-center justify-center rounded-lg p-2 text-slate-400 transition hover:bg-av-red/10 hover:text-av-red sm:col-span-1">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addCoverage} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-gold-dark transition hover:underline">
          <Plus size={14} />
          Add Existing Coverage
        </button>
      </Card>

      <Card title="Advisor Notes / Special Circumstances" subtitle="Optional — Anything relevant that doesn't fit the fields above such as Disability Waiver of Charges.">
        <textarea
          rows={4}
          value={data.advisorNotes}
          onChange={(e) => patch({ advisorNotes: e.target.value })}
          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
        />
      </Card>
    </>
  );
}

// A line wrapped in **double asterisks** is a heading/label line (the
// letter's title, Owner/Insured/Advisor lines, each product's amount/
// premium line, "Premium and Existing Coverage Considerations") — same
// convention the backend's PDF renderer uses (see form_filler.py /
// pdf_builder.py). Every other line is an ordinary paragraph.
function LetterPreview({ text }) {
  const rawLines = (text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (rawLines.length === 0) {
    return <p className="text-sm text-slate-400">Click "Generate Draft" below to draft the letter.</p>;
  }
  // Group into blocks: a line with "____" blanks separated by 3+ spaces is a
  // row of side-by-side columns (signature / date lines) and must render as
  // a grid — HTML collapses the spaces, which runs the halves together.
  const blocks = [];
  let seenTitle = false;
  for (const line of rawLines) {
    const bold = /^\*\*(.+)\*\*$/.exec(line);
    if (bold) {
      blocks.push({ type: seenTitle ? "heading" : "title", text: bold[1] });
      seenTitle = true;
      continue;
    }
    const cells = line.split(/\s{3,}/);
    if (cells.length >= 2 && line.includes("____")) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === "columns") last.rows.push(cells);
      else blocks.push({ type: "columns", rows: [cells] });
      continue;
    }
    blocks.push({ type: "para", text: line });
  }
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((b, i) => {
        if (b.type === "title") return <p key={i} className="text-lg font-bold text-navy">{b.text}</p>;
        if (b.type === "heading") return <p key={i} className="mt-1 font-semibold text-navy">{b.text}</p>;
        if (b.type === "columns") {
          return (
            <div key={i} className="mt-4 grid grid-cols-1 gap-x-8 gap-y-5 text-sm text-slate-700 sm:grid-cols-2">
              {b.rows.flatMap((row, r) => row.map((cell, c) => <p key={`${r}-${c}`} className="break-words">{cell}</p>))}
            </div>
          );
        }
        return <p key={i} className="text-sm leading-relaxed text-slate-700">{b.text}</p>;
      })}
    </div>
  );
}

function LetterStep({ data, patch, letterDoc, onDownload, onDownloadLetterPdf, onDraftLetter, letterDrafting, aiUsage, letterBlocked, onDismissBlocked, onSaveLetter }) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <Card title="Reason Why Letter" subtitle="Must be generated and reviewed before moving on. The Agent Disclosure and Supervision forms are handled later, on the Documents step.">
        <AiUsageInline usage={aiUsage} className="mb-3" />
        {letterBlocked && <AiBlockedNotice error={letterBlocked} onDismiss={onDismissBlocked} className="mb-3" />}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onDraftLetter}
            disabled={letterDrafting}
            className="flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light disabled:opacity-60"
          >
            <Sparkles size={15} />
            {letterDrafting ? "Drafting..." : data.reasonWhyLetterText ? "Regenerate Draft" : "Generate Draft"}
          </button>
          {data.reasonWhyLetterText && (
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-navy transition hover:bg-slate-50"
            >
              {editing ? "Preview" : "Edit text"}
            </button>
          )}
        </div>

        {editing ? (
          <textarea
            rows={16}
            value={data.reasonWhyLetterText}
            onChange={(e) => patch({ reasonWhyLetterText: e.target.value })}
            placeholder={'Click "Generate Draft" above, then review/edit the letter here before saving.'}
            className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
          />
        ) : (
          <div className="max-h-[600px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-5">
            <LetterPreview text={data.reasonWhyLetterText} />
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onSaveLetter}
          disabled={!data.reasonWhyLetterText.trim()}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-navy transition hover:bg-slate-50 disabled:opacity-40"
        >
          <Save size={14} />
          Save Letter
        </button>
        {letterDoc?.generatedFileName && (
          <button
            type="button"
            onClick={() => onDownload(letterDoc.key, "Reason Why Letter", true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-navy transition hover:bg-slate-50"
          >
            <Download size={14} />
            Download Word (.docx)
          </button>
        )}
        {letterDoc?.generatedFileName && (
          <button
            type="button"
            onClick={onDownloadLetterPdf}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-navy transition hover:bg-slate-50"
          >
            <Download size={14} />
            Download PDF
          </button>
        )}
        </div>
      </Card>
    </>
  );
}

function YesNo({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-slate-200 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-navy">{label}</span>
      <div className="flex shrink-0 gap-3">
        {[
          ["Yes", true],
          ["No", false],
        ].map(([text, val]) => (
          <label key={text} className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
            <input type="radio" checked={value === val} onChange={() => onChange(val)} className="accent-gold" />
            {text}
          </label>
        ))}
      </div>
    </div>
  );
}

function ProfileLine({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-sm text-navy">{children || <span className="text-amber-600">Not set</span>}</span>
    </div>
  );
}

function ComplianceProfileCard({ profile }) {
  const provinces = profile?.licensedProvinces || [];
  const companies = profile?.companiesRepresented || [];
  const incomplete = provinces.length === 0 || companies.length === 0 || !profile?.agencyName || (profile?.supervisorRequired && !profile?.supervisorName);
  return (
    <Card title="Your Compliance Profile" subtitle="This is what the Agent Disclosure and Supervision forms are filled from.">
      {incomplete && (
        <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <AlertTriangle size={13} />
          Some details are missing — complete them so the forms come out right.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ProfileLine label="Agency / Dealer">{profile?.agencyName}</ProfileLine>
        <ProfileLine label="Branch">{profile?.businessBranchName}</ProfileLine>
        <ProfileLine label="Agent Code">{profile?.agentCode}</ProfileLine>
        <ProfileLine label="Licensed In">{provinces.join(", ")}</ProfileLine>
        <ProfileLine label="Companies Represented">{companies.join(", ")}</ProfileLine>
        <ProfileLine label="Supervisor">
          {profile?.supervisorRequired
            ? [profile.supervisorName, profile.supervisorTitle].filter(Boolean).join(" — ")
            : "Not required"}
        </ProfileLine>
      </div>
      <Link to="/profile?tab=compliance" className="mt-3 inline-block text-xs font-semibold text-gold-dark hover:underline">
        Edit in Profile → Compliance
      </Link>
    </Card>
  );
}

function ComplianceStep({ data, patch, profile }) {
  const c = data.supervisionConfirmations;
  const setC = (fields) => patch({ supervisionConfirmations: { ...c, ...fields } });
  return (
    <>
    <ComplianceProfileCard profile={profile} />
    <Card
      title="Compliance Confirmations"
      subtitle="Only you can answer these — they're never inferred, and they're used to generate the Supervision Form on the next step."
    >
      <div className="flex flex-col gap-2.5">
        <YesNo label="Insurance Application reviewed?" value={c.applicationReviewed} onChange={(v) => setC({ applicationReviewed: v })} />
        <YesNo label="Needs Analysis reviewed?" value={c.needsAnalysisReviewed} onChange={(v) => setC({ needsAnalysisReviewed: v })} />
        <YesNo label="Policy Illustrations reviewed?" value={c.policyIllustrationsReviewed} onChange={(v) => setC({ policyIllustrationsReviewed: v })} />
        <YesNo
          label="Is this a Life Insurance Replacement?"
          value={c.lifeInsuranceReplacement}
          onChange={(v) => setC({ lifeInsuranceReplacement: v, lirdReviewed: v ? c.lirdReviewed : null })}
        />
        {c.lifeInsuranceReplacement === true && (
          <YesNo label="LIRD / Written Comparative Analysis reviewed?" value={c.lirdReviewed} onChange={(v) => setC({ lirdReviewed: v })} />
        )}
        <YesNo
          label="Segregated Funds Leveraging?"
          value={c.segFundsLeveraging}
          onChange={(v) => setC({ segFundsLeveraging: v, disclosureDocReviewed: v ? c.disclosureDocReviewed : null })}
        />
        {c.segFundsLeveraging === true && (
          <YesNo label="Disclosure Document reviewed?" value={c.disclosureDocReviewed} onChange={(v) => setC({ disclosureDocReviewed: v })} />
        )}
      </div>
    </Card>
    </>
  );
}

function UploadProgressBar({ percent }) {
  if (percent === undefined || percent === null) return null;
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${percent}%` }} />
    </div>
  );
}

function GeneratedDocCard({ label, subtitle, doc, onDownload, onDownloadPdf, onGenerate, generating }) {
  return (
    <div className="rounded-xl border border-gold/40 bg-gold/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-navy">{label}</p>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {doc?.generatedFileName && (
            <button
              type="button"
              onClick={() => onDownload(doc.key, label, true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy transition hover:bg-slate-50"
            >
              <Download size={13} />
              {doc.generatedFileName.endsWith(".docx") ? "Download Word" : "Download"}
            </button>
          )}
          {doc?.generatedFileName && onDownloadPdf && (
            <button
              type="button"
              onClick={onDownloadPdf}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy transition hover:bg-slate-50"
            >
              <Download size={13} />
              Download PDF
            </button>
          )}
          {onGenerate && (
            <button
              type="button"
              onClick={onGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-navy-light disabled:opacity-60"
            >
              <FileCheck2 size={13} />
              {generating ? "Generating..." : doc?.generatedFileName ? "Regenerate" : "Generate for Me"}
            </button>
          )}
        </div>
      </div>
      {doc?.generatedFileName ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-av-green">
          <CheckCircle2 size={13} />
          Ready to download — {doc.generatedFileName}
        </p>
      ) : (
        !onGenerate && <p className="mt-2 text-xs text-slate-400">Not generated yet.</p>
      )}
    </div>
  );
}

function DocumentsStep({ documents, uploadProgress, onUpload, onDownload, onDownloadLetterPdf, onGenerateDisclosure, disclosureGenerating, onGenerateSupervisionForm, supervisionGenerating }) {
  const disclosureDoc = documents.find((d) => d.key === "agentDisclosureForm");
  const letterDoc = documents.find((d) => d.key === "reasonWhyLetter");
  const supervisionDoc = documents.find((d) => d.key === "supervisionForm");

  return (
    <>
      <Card title="Documents We Prepare For You" subtitle="Generate and download these, complete or sign them as needed, then upload the final versions in the next section.">
        <div className="flex flex-col gap-2.5">
          <GeneratedDocCard
            label="Reason Why Letter"
            subtitle="From the letter you reviewed and saved on the Reason Why Letter step — go back there to change it."
            doc={letterDoc}
            onDownload={onDownload}
            onDownloadPdf={onDownloadLetterPdf}
          />
          <GeneratedDocCard
            label="Agent Disclosure Form"
            subtitle="From your Compliance Profile (Profile → Compliance) plus this client's name."
            doc={disclosureDoc}
            onDownload={onDownload}
            onGenerate={onGenerateDisclosure}
            generating={disclosureGenerating}
          />
          <GeneratedDocCard
            label="Supervision Form"
            subtitle="From this package's products/needs, your Compliance Profile's supervisor, and the Compliance step's answers."
            doc={supervisionDoc}
            onDownload={onDownload}
            onGenerate={onGenerateSupervisionForm}
            generating={supervisionGenerating}
          />
        </div>
      </Card>

      <Card title="Upload Documents" subtitle={`Upload all ${documents.length} documents to create the final package — including the three above, in their final form.`}>
        <div className="flex flex-col gap-2.5">
          {documents.map((d, i) => (
            <div key={d.key} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy/5 text-xs font-bold text-navy">{i + 1}</div>
                <span className="w-full shrink-0 text-sm font-medium text-navy sm:w-48">{d.label} *</span>
                <label className="flex min-w-[200px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500 transition hover:border-gold hover:bg-gold/5">
                  {d.uploaded ? (
                    <span className="flex items-center gap-1.5 text-navy">
                      <CheckCircle2 size={14} className="text-av-green" />
                      {d.fileName || "Uploaded"}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Upload size={13} />
                      Choose file
                    </span>
                  )}
                  <input type="file" accept={d.key === "reasonWhyLetter" ? "application/pdf,.pdf,.docx" : "application/pdf,.pdf"} className="hidden" onChange={(e) => onUpload(d.key, d.label, e.target.files?.[0])} />
                </label>
                <span className="shrink-0 text-xs text-slate-400">{d.key === "reasonWhyLetter" ? "PDF or Word (Max 10 MB)" : "PDF (Max 10 MB)"}</span>
              </div>
              <UploadProgressBar percent={uploadProgress[d.key]} />
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function DocReviewCard({ packageId, doc, version, progress, onUpload, onDownload }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!doc.uploaded) {
      setUrl(null);
      return undefined;
    }
    let cancelled = false;
    let created = null;
    setFailed(false);
    api
      .previewSalesPackageDocument(packageId, doc.key)
      .then((u) => {
        if (cancelled) URL.revokeObjectURL(u);
        else {
          created = u;
          setUrl(u);
        }
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [packageId, doc.key, doc.uploaded, version]);

  return (
    <div className="rounded-xl border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-navy">{doc.label}</p>
          <p className="truncate text-xs text-slate-400">{doc.uploaded ? doc.fileName : "Missing — go back and add it"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {doc.uploaded && (
            <button type="button" onClick={() => onDownload(doc.key, doc.label)} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50">
              <Download size={12} />
              Download
            </button>
          )}
          <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-navy hover:bg-slate-50">
            <Upload size={12} />
            Replace file
            <input type="file" accept={doc.key === "reasonWhyLetter" ? "application/pdf,.pdf,.docx" : "application/pdf,.pdf"} className="hidden" onChange={(e) => onUpload(doc.key, doc.label, e.target.files?.[0])} />
          </label>
        </div>
      </div>
      {progress !== undefined && progress !== null && (
        <div className="px-4 pt-2">
          <UploadProgressBar percent={progress} />
        </div>
      )}
      {doc.uploaded &&
        (failed ? (
          <p className="px-4 py-6 text-center text-xs text-av-red">Couldn't load the preview — you can still download it.</p>
        ) : url ? (
          <iframe title={doc.label} src={url} className="h-[560px] w-full rounded-b-xl" />
        ) : (
          <p className="px-4 py-6 text-center text-xs text-slate-400">Loading preview...</p>
        ))}
    </div>
  );
}

function ReviewStep({
  data,
  packageId,
  docVersion,
  uploadProgress,
  advisorName,
  documents,
  onUpload,
  onDownload,
  confirmChecked,
  setConfirmChecked,
  onGenerate,
  generating,
  error,
  status,
}) {
  const missingDocs = documents.filter((d) => !d.uploaded);
  const blockers = [
    !data.policyOwner && "Policy Owner is missing (Client step)",
    !data.insuredPerson && "Insured Person is missing (Client step)",
    data.products.length === 0 && "No products added (Products step)",
    ...missingDocs.map((d) => `${d.label} hasn't been uploaded yet (Documents step)`),
    !confirmChecked && "Check the confirmation box below",
  ].filter(Boolean);
  const canGenerate = blockers.length === 0;

  return (
    <>
      <Card title="Review & Generate" subtitle="Check everything below — every uploaded document is shown as it will appear in the package.">
        <div className="flex flex-col gap-4 text-sm">
          <SummaryRow label="Advisor">{advisorName || "—"}</SummaryRow>
          <SummaryRow label="Policy Owner">{data.policyOwner || "—"}</SummaryRow>
          <SummaryRow label="Insured Person">{data.insuredPerson || "—"}</SummaryRow>
          <SummaryRow label="Dependants">{data.dependants.filter((d) => d.fullName).length ? data.dependants.map((d) => d.fullName).filter(Boolean).join(", ") : "None"}</SummaryRow>
          <SummaryRow label="Needs">{data.needs.length ? data.needs.join(", ") : "None selected"}</SummaryRow>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Products</p>
            {data.products.filter((p) => p.productName).length === 0 ? (
              <p className="text-slate-400">No products added.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {data.products.filter((p) => p.productName).map((p) => (
                  <li key={p.id} className="rounded-lg bg-slate-50 px-3 py-2">
                    <span className="font-medium text-navy">{p.company} — {p.productName || "(not selected)"}{p.accountType ? ` (${p.accountType})` : ""}</span>
                    <span className="text-slate-500"> · {p.coverageAmount || "—"} · {p.premium || "—"} {p.frequency}</span>
                    {p.allocations.length > 0 && (
                      <div className="mt-1 text-xs text-slate-500">
                        {p.allocations.map((a) => `${a.fundName} (${a.allocationPct}%)`).join(", ")}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <SummaryRow label="Documents">
            {documents.filter((d) => d.uploaded).length} / {documents.length} ready
          </SummaryRow>
        </div>
      </Card>

      <Card title="Documents" subtitle="These are the files you uploaded — scroll through each. To change one, use Replace file. Nothing is sent anywhere.">
        <div className="flex flex-col gap-4">
          {documents.map((doc) => (
            <DocReviewCard key={doc.key} packageId={packageId} doc={doc} version={docVersion} progress={uploadProgress[doc.key]} onUpload={onUpload} onDownload={onDownload} />
          ))}
        </div>
      </Card>

      <Card title="Generate" subtitle="Confirm and create the final package.">
        {error && <p className="mb-3 text-xs text-av-red">{error}</p>}

        <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-navy">
          <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} className="mt-0.5 accent-gold" />
          I have reviewed the information above and confirm that it accurately reflects the client's circumstances, needs and recommendations.
        </label>

        {blockers.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
              <AlertTriangle size={13} />
              Not ready to generate yet:
            </p>
            <ul className="ml-1 list-disc pl-4 text-xs text-amber-700">
              {blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || generating}
          className="mt-4 flex items-center gap-1.5 rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light disabled:opacity-50"
        >
          {generating ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <Package size={15} />
          )}
          {generating ? "Generating..." : status === "completed" ? "Regenerate Package" : "Generate Package"}
        </button>

        {status === "completed" && (
          <div className="mt-5 border-t border-slate-100 pt-5">
            <p className="mb-2 text-sm font-semibold text-navy">Send for signature</p>
            <p className="mb-3 text-xs text-slate-500">
              Download the generated package above, then upload it into DocuSeal to add signature/date fields and send it to the client.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="https://docuseal.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-light"
              >
                <ExternalLink size={14} />
                Open DocuSeal
              </a>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

function SummaryRow({ label, children }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-navy">{children}</p>
    </div>
  );
}
