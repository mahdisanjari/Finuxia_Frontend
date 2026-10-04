/**
 * A plain data table: scrolls sideways on a narrow screen instead of breaking the page, with the app's header and row
 * styling. Compose it from the parts below.
 *
 *   <Table caption="Recent calls">
 *     <THead><Tr><Th>Feature</Th><Th align="right">Credits</Th></Tr></THead>
 *     <TBody><Tr><Td>Letter</Td><Td align="right">5</Td></Tr></TBody>
 *   </Table>
 */
export function Table({ caption, className = "", children }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className={`w-full text-left text-sm ${className}`}>
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export const THead = ({ children }) => <thead className="border-b border-slate-200 bg-slate-50">{children}</thead>;
export const TBody = ({ children }) => <tbody className="divide-y divide-slate-100">{children}</tbody>;
export const Tr = ({ children, className = "" }) => <tr className={className}>{children}</tr>;

const ALIGN = { left: "text-left", right: "text-right", center: "text-center" };

export const Th = ({ align = "left", children, className = "" }) => (
  <th scope="col" className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 ${ALIGN[align]} ${className}`}>
    {children}
  </th>
);
export const Td = ({ align = "left", children, className = "" }) => (
  <td className={`px-4 py-2.5 text-navy ${ALIGN[align]} ${className}`}>{children}</td>
);
