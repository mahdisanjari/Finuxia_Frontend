import { forwardRef } from "react";

/** The class string every text field uses (also for inputs that are not <Input>, e.g. a select or textarea). */
export function inputClass(error) {
  return `w-full rounded-lg border px-3 py-2 text-sm text-navy outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30 disabled:bg-slate-50 disabled:text-slate-400 ${
    error ? "border-av-red" : "border-slate-200"
  }`;
}

/** A text input. `error` (a message or true) turns the border red and sets aria-invalid; pass it through <Field> for the message. */
const Input = forwardRef(function Input({ error, className = "", ...props }, ref) {
  return <input ref={ref} aria-invalid={error ? true : undefined} className={`${inputClass(error)} ${className}`} {...props} />;
});

export default Input;
