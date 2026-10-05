import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { API } from "../../test/handlers";
import { server } from "../../test/server";
import { renderWithProviders, screen, userEvent, waitFor, within } from "../../test/utils";
import InvoiceHistory from "./InvoiceHistory";

const at = (y, m, d) => new Date(y, m - 1, d, 12).toISOString();
const paid = {
  id: "in_2",
  number: "A1B2C3D4-0002",
  date: at(2026, 3, 1),
  amountCents: 9900,
  currency: "usd",
  status: "paid",
  description: "1 x Elite (at $99.00 / month)",
  hostedUrl: "https://invoice.stripe.com/i/acct/test_in_2",
  pdfUrl: "https://pay.stripe.com/invoice/acct/test_in_2/pdf",
};
const due = {
  ...paid,
  id: "in_1",
  number: "A1B2C3D4-0001",
  date: at(2026, 2, 1),
  status: "open",
  amountCents: 4950,
  currency: "cad",
  hostedUrl: "",
  pdfUrl: "",
};

const serve = (body, status = 200) => server.use(http.get(`${API}/api/billing/invoices`, () => HttpResponse.json(body, { status })));
const show = () => renderWithProviders(<InvoiceHistory />, { providers: ["router", "toast"] });

describe("the invoice history", () => {
  it("lists each invoice: date, number, what it was for, the amount, whether it was paid", async () => {
    serve({ available: true, invoices: [paid, due] });
    show();
    const table = await screen.findByRole("table", { name: "Your invoices" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("March 1, 2026")).toBeInTheDocument();
    expect(within(rows[0]).getByText("A1B2C3D4-0002")).toBeInTheDocument();
    expect(within(rows[0]).getByText("1 x Elite (at $99.00 / month)")).toBeInTheDocument();
    expect(within(rows[0]).getByText("$99.00")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Paid")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Payment due")).toBeInTheDocument();
    expect(within(rows[1]).getByText("CA$49.50")).toBeInTheDocument(); // in the invoice's own currency
  });

  it("links to Stripe's own invoice page and PDF, opened safely in a new tab", async () => {
    serve({ available: true, invoices: [paid] });
    show();
    const view = await screen.findByRole("link", { name: "View invoice A1B2C3D4-0002" });
    expect(view).toHaveAttribute("href", paid.hostedUrl);
    expect(view).toHaveAttribute("target", "_blank");
    expect(view).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(screen.getByRole("link", { name: "Download PDF of invoice A1B2C3D4-0002" })).toHaveAttribute("href", paid.pdfUrl);
  });

  it("shows no link where Stripe sent none", async () => {
    serve({ available: true, invoices: [due] });
    show();
    await screen.findByText("A1B2C3D4-0001");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText("View")).not.toBeInTheDocument();
    expect(screen.queryByText("PDF")).not.toBeInTheDocument();
  });

  it("an invoice with no number is named by its id", async () => {
    serve({ available: true, invoices: [{ ...paid, number: "" }] });
    show();
    expect(await screen.findByRole("link", { name: "View invoice in_2" })).toBeInTheDocument();
  });

  it("a status Stripe adds later is shown as its own word, not hidden", async () => {
    serve({ available: true, invoices: [{ ...paid, status: "scheduled" }] });
    show();
    expect(await screen.findByText("Scheduled")).toBeInTheDocument();
  });

  it("shows nothing before payments are connected or before a first invoice", async () => {
    for (const body of [
      { available: false, invoices: [] },
      { available: true, invoices: [] },
    ]) {
      serve(body);
      const { container, unmount } = show();
      await waitFor(() => expect(screen.queryByText("Loading invoices...")).not.toBeInTheDocument());
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });

  it("says it is loading, then shows the list", async () => {
    serve({ available: true, invoices: [paid] });
    show();
    expect(screen.getByText("Loading invoices...")).toBeInTheDocument();
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("a failure is explained in place, and retrying loads the list", async () => {
    serve({ error: "Stripe is unreachable." }, 502);
    show();
    expect(await screen.findByText(/Stripe is unreachable\./)).toBeInTheDocument();
    serve({ available: true, invoices: [paid] });
    await userEvent.click(screen.getByRole("button", { name: /retry|try again/i }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });
});
