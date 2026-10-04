/** A white card. `padding`: "md" (p-6, the default), "sm" (p-4) or "none". `as` changes the element (e.g. "section"). */
const PADDING = { none: "", sm: "p-4", md: "p-6" };

export default function Card({ as: Tag = "div", padding = "md", className = "", children, ...props }) {
  return (
    <Tag className={`rounded-2xl bg-white shadow-sm ${PADDING[padding]} ${className}`} {...props}>
      {children}
    </Tag>
  );
}
