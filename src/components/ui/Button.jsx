import { forwardRef } from "react";

const VARIANTS = {
  primary: "bg-navy text-white shadow-sm hover:bg-navy-light",
  gold: "bg-gold text-navy shadow-sm hover:bg-gold-light",
  secondary: "border border-slate-200 bg-white text-navy hover:bg-slate-50",
  ghost: "text-slate-500 hover:bg-slate-100",
  danger: "text-av-red hover:bg-av-red/10",
};
const SIZES = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-sm",
};

/**
 * The app's button. `variant`: primary (navy), gold, secondary (outlined), ghost, danger. `size`: sm, md, lg.
 * `loading` disables it and marks it busy; `type` defaults to "button" so a button in a form never submits it by accident.
 * Anything else (onClick, disabled, aria-label, a ref...) passes through.
 */
const Button = forwardRef(function Button(
  { variant = "primary", size = "md", loading = false, disabled = false, type = "button", className = "", children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});

export default Button;
