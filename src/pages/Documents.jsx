import { useState } from "react";
import { FileStack, Plus, Download, FileText } from "lucide-react";
import useAsync from "../hooks/useAsync";
import { api } from "../lib/api";
import { useToast } from "../context/ToastContext";
import { documentStatusMeta } from "../lib/statusMeta";
import { Badge, Button } from "../components/ui";
import SubmitDocumentModal from "../components/documents/SubmitDocumentModal";

export default function Documents() {
  const { addToast } = useToast();
  const {
    data: { documents, mine },
    loading,
    error,
    reload: load,
  } = useAsync(
    async () => {
      const [documents, mine] = await Promise.all([api.getDocuments(), api.getMyDocuments()]);
      return { documents, mine };
    },
    [],
    { initialData: { documents: [], mine: [] } }
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  const handleDownload = async (doc) => {
    setDownloadingId(doc.id);
    try {
      await api.downloadDocument(doc.id, doc.fileName);
    } catch (err) {
      addToast(err.message || "Could not download this document");
    } finally {
      setDownloadingId(null);
    }
  };

  // My own pending/rejected submissions aren't in the public list yet — show
  // them separately so the advisor can still track/download them.
  const pendingOrRejectedMine = mine.filter((d) => d.status !== "approved");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-gold">
            <FileStack size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-navy">Documents</h1>
            <p className="text-sm text-slate-500">Client-education guides advisors can browse and download.</p>
          </div>
        </div>
        <Button variant="gold" onClick={() => setModalOpen(true)}>
          <Plus size={16} strokeWidth={2.5} />
          Submit Document
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-12 text-sm text-slate-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-gold" />
          Loading…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-dashed border-av-red/30 bg-white px-6 py-10 text-center text-sm text-av-red">
          {error.message}
        </div>
      ) : (
        <>
          {pendingOrRejectedMine.length > 0 && (
            <section>
              <h2 className="mb-2.5 text-sm font-semibold text-navy">My Submissions</h2>
              <div className="flex flex-col gap-2.5">
                {pendingOrRejectedMine.map((doc) => {
                  const meta = documentStatusMeta(doc.status);
                  const StatusIcon = meta.icon;
                  return (
                    <div key={doc.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-navy">{doc.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{doc.summary}</p>
                        </div>
                        <Badge tone={meta.tone} icon={StatusIcon}>
                          {meta.label}
                        </Badge>
                      </div>
                      {doc.status === "rejected" && doc.rejectionNote && (
                        <p className="mt-2 rounded-lg bg-av-red/5 px-2.5 py-1.5 text-xs text-av-red">{doc.rejectionNote}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section>
            {pendingOrRejectedMine.length > 0 && <h2 className="mb-2.5 text-sm font-semibold text-navy">All Documents</h2>}
            {documents.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                <FileStack size={24} className="text-slate-300" />
                <p className="text-sm text-slate-400">No documents yet. Be the first to submit one.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {documents.map((doc) => (
                  <div key={doc.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy/5 text-navy">
                        <FileText size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-navy">{doc.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{doc.summary}</p>
                        {doc.keywords?.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {doc.keywords.map((k) => (
                              <span key={k} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                                {k}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="mt-2.5 text-[11px] text-slate-400">Uploaded by {doc.uploadedByName}</p>
                      </div>
                      <button
                        onClick={() => handleDownload(doc)}
                        disabled={downloadingId === doc.id}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-navy transition hover:bg-slate-50 disabled:opacity-60"
                      >
                        <Download size={13} />
                        {downloadingId === doc.id ? "Downloading..." : "Download"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {modalOpen && <SubmitDocumentModal onClose={() => setModalOpen(false)} onSubmitted={load} />}
    </div>
  );
}
