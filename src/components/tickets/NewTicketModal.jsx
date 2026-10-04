import { Button, Field, Input, inputClass } from "../ui";
import Modal, { ModalTitle } from "../ui/Modal";
import { useState } from "react";
import { X, Bug, Sparkles } from "lucide-react";
import { api } from "../../lib/api";
import { useToast } from "../../context/ToastContext";

const TYPE_OPTIONS = [
  { value: "bug", label: "Bug report", icon: Bug },
  { value: "feature", label: "Feature request", icon: Sparkles },
];

export default function NewTicketModal({ open, onClose, onCreated }) {
  const { addToast } = useToast();
  const [type, setType] = useState("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleClose = () => {
    setType("bug");
    setTitle("");
    setDescription("");
    setErrors({});
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!title.trim()) nextErrors.title = "Title is required";
    if (!description.trim()) nextErrors.description = "Please add some detail";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    try {
      const ticket = await api.createTicket({ type, title: title.trim(), description: description.trim() });
      addToast("Ticket submitted — thanks for the feedback!");
      onCreated?.(ticket);
      handleClose();
    } catch (err) {
      addToast(err.message || "Could not submit the ticket");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={handleClose} variant="sheet" panelClassName="max-h-[90vh] overflow-y-auto rounded-t-2xl sm:max-w-lg sm:rounded-2xl">
      <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
        <ModalTitle className="text-lg font-semibold text-navy">New Ticket</ModalTitle>
        <button
          onClick={handleClose}
          className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-navy"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-5">
        <div className="grid grid-cols-2 gap-3">
          {TYPE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = type === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${
                  active ? "border-gold bg-gold/10 text-gold-dark" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                <Icon size={15} />
                {opt.label}
              </button>
            );
          })}
        </div>

        <Field label="Title" required error={errors.title}>
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.title}
            placeholder={type === "bug" ? "Short summary of the bug" : "Short summary of the idea"}
          />
        </Field>

        <Field label="Description" required error={errors.description}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className={inputClass(errors.description)}
            placeholder={
              type === "bug"
                ? "What happened? What did you expect instead? Steps to reproduce, if you can."
                : "What would you like Finuxia to do?"
            }
          />
        </Field>

        <div className="mt-2 flex justify-end gap-3">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting} size="lg">
            {submitting ? "Submitting..." : "Submit Ticket"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
