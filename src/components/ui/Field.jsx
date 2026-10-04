/**
 * A labelled form field: the label wraps its control (so they are associated), a required marker, and an error message
 * that is announced to screen readers.
 *
 *   <Field label="First Name" required error={errors.first}><Input value={..} onChange={..} error={errors.first} /></Field>
 */
export default function Field({ label, required = false, error, children, className = "" }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
        {required && <span className="text-av-red"> *</span>}
      </span>
      {children}
      {error && (
        <span role="alert" className="text-xs text-av-red">
          {error}
        </span>
      )}
    </label>
  );
}
