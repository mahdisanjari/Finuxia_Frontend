import { TONES } from "../../lib/statusMeta";

/** A small pill. `tone`: blue, green, amber, red, purple or slate (see lib/statusMeta). `size`: "sm" or "md". */
export default function Badge({ tone = "slate", size = "md", icon: Icon, className = "", children }) {
  const sizing = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full font-semibold ${sizing} ${TONES[tone] ?? TONES.slate} ${className}`}
    >
      {Icon && <Icon size={11} aria-hidden="true" />}
      {children}
    </span>
  );
}
