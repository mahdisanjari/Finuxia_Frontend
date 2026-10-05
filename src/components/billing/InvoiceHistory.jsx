import { ExternalLink } from "lucide-react";
import useAsync from "../../hooks/useAsync";
import { api } from "../../lib/api";
import { formatCents } from "../../lib/currency";
import { formatLongDate } from "../../lib/dates";
import { invoiceStatusMeta } from "../../lib/statusMeta";
import { Badge, Table, TBody, Td, Th, THead, Tr } from "../ui";
import ErrorNotice from "../ui/ErrorNotice";

/**
 * The customer's invoices, as Stripe reports them, each with Stripe's own links to the invoice page and its PDF. Nothing is shown
 * before payments are connected or before a first payment: there is nothing to list.
 */
export default function InvoiceHistory() {
  const { data, loading, error, reload } = useAsync(() => api.getInvoices(), []);

  if (loading && !data) return <p className="text-sm text-slate-400">Loading invoices...</p>;
  if (error) return <ErrorNotice error={error} onRetry={reload} />;
  if (!data?.available || data.invoices.length === 0) return null;

  return (
    <section aria-label="Invoices" className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-navy">Invoices</h2>
      <Table caption="Your invoices">
        <THead>
          <Tr>
            <Th>Date</Th>
            <Th>Invoice</Th>
            <Th align="right">Amount</Th>
            <Th>Status</Th>
            <Th>
              <span className="sr-only">Links</span>
            </Th>
          </Tr>
        </THead>
        <TBody>
          {data.invoices.map((invoice) => {
            const status = invoiceStatusMeta(invoice.status);
            const label = invoice.number || invoice.id;
            return (
              <Tr key={invoice.id}>
                <Td>{formatLongDate(invoice.date) || "—"}</Td>
                <Td>
                  <span className="font-medium text-navy">{label}</span>
                  {invoice.description && <span className="block text-xs text-slate-500">{invoice.description}</span>}
                </Td>
                <Td align="right">{formatCents(invoice.amountCents, invoice.currency)}</Td>
                <Td>
                  <Badge tone={status.tone} size="sm">
                    {status.label}
                  </Badge>
                </Td>
                <Td>
                  <span className="flex flex-wrap justify-end gap-3 text-xs font-semibold text-gold-dark">
                    {invoice.hostedUrl && (
                      <a
                        href={invoice.hostedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`View invoice ${label}`}
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        View <ExternalLink size={11} aria-hidden="true" />
                      </a>
                    )}
                    {invoice.pdfUrl && (
                      <a
                        href={invoice.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Download PDF of invoice ${label}`}
                        className="hover:underline"
                      >
                        PDF
                      </a>
                    )}
                  </span>
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </section>
  );
}
