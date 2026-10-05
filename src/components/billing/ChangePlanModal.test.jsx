import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { API } from "../../test/handlers";
import { server } from "../../test/server";
import { renderWithProviders, screen, userEvent, waitFor, within } from "../../test/utils";
import ChangePlanModal from "./ChangePlanModal";

const at = (y, m, d) => new Date(y, m - 1, d, 12).toISOString();
const elite = { id: 2, key: "elite", name: "Elite", priceCents: 9900, currency: "usd", interval: "month" };
const pro = { id: 1, key: "professional", name: "Professional", priceCents: 4900, currency: "usd", interval: "month" };

const upgrade = (over = {}) => ({
  kind: "upgrade",
  effective: "now",
  effectiveAt: null,
  plan: elite,
  currentPlan: pro,
  totalCents: 3300,
  amountDueCents: 3300,
  currency: "usd",
  lines: [
    { description: "Unused time on Professional", amountCents: -2450, proration: true },
    { description: "Remaining time on Elite", amountCents: 5750, proration: true },
  ],
  prorationDate: 1767225600,
  billingDate: at(2026, 2, 1),
  modulesGained: ["Strategy Prep", "Zoom Integration"],
  modulesLost: [],
  warnings: [],
  alreadyScheduled: false,
  ...over,
});
const downgrade = (over = {}) => ({
  kind: "downgrade",
  effective: "period_end",
  effectiveAt: at(2026, 2, 1),
  plan: pro,
  currentPlan: elite,
  totalCents: 0,
  amountDueCents: 0,
  currency: "usd",
  lines: [],
  prorationDate: null,
  billingDate: at(2026, 2, 1),
  modulesGained: [],
  modulesLost: ["Strategy Prep"],
  warnings: [
    "On February 1, 2026 you move to Professional. Until then nothing changes.",
    "You will lose access to Strategy Prep then. Nothing is deleted: your data stays.",
  ],
  alreadyScheduled: false,
  ...over,
});

let calls;
const serve = (preview, change) => {
  calls = { previews: [], changes: [] };
  server.use(
    http.post(`${API}/api/billing/plan-change/preview`, async ({ request }) => {
      calls.previews.push(await request.json());
      return typeof preview === "function" ? preview(calls.previews.length) : HttpResponse.json(preview);
    }),
    http.post(`${API}/api/billing/plan-change`, async ({ request }) => {
      calls.changes.push(await request.json());
      return change ? change(calls.changes.length) : HttpResponse.json({ outcome: "upgraded", plan: elite, status: "active" });
    })
  );
};
const show = (plan = elite, props = {}) => {
  const onClose = vi.fn();
  const onChanged = vi.fn();
  renderWithProviders(<ChangePlanModal plan={plan} onClose={onClose} onChanged={onChanged} {...props} />, {
    providers: ["router", "toast"],
  });
  return { onClose, onChanged };
};
const dialog = () => screen.findByRole("dialog");

describe("an upgrade", () => {
  it("says what you pay today, how it is worked out, and that the billing date stays", async () => {
    serve(upgrade());
    show();
    const d = await dialog();
    expect(await within(d).findByText("Switch to Elite now")).toBeInTheDocument();
    expect(within(d).getByText("$33.00")).toBeInTheDocument();
    expect(within(d).getByText(/less credit for the time you haven't used on Professional/)).toBeInTheDocument();
    expect(within(d).getByText("February 1, 2026")).toBeInTheDocument();
    const lines = within(d).getByRole("list", { name: "How the price is worked out" });
    expect(within(lines).getByText("Unused time on Professional")).toBeInTheDocument();
    expect(within(lines).getByText("-$24.50")).toBeInTheDocument();
    expect(within(d).getByText(/You get: Strategy Prep, Zoom Integration\./)).toBeInTheDocument();
    expect(calls.previews).toEqual([{ planId: 2 }]);
  });

  it("confirming sends the total that was shown and the instant it was worked out at", async () => {
    serve(upgrade());
    const { onChanged, onClose } = show();
    await userEvent.click(await screen.findByRole("button", { name: "Upgrade now" }));
    await waitFor(() => expect(calls.changes).toEqual([{ planId: 2, expectedTotalCents: 3300, prorationDate: 1767225600 }]));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(onChanged.mock.calls[0][0].outcome).toBe("upgraded");
    expect(onClose).toHaveBeenCalled();
  });

  it("with no breakdown and nothing gained it shows neither an empty list nor an empty 'You get'", async () => {
    serve(upgrade({ lines: [], modulesGained: [] }));
    show();
    const d = await dialog();
    await within(d).findByText(/Today you pay/);
    expect(within(d).queryByRole("list")).not.toBeInTheDocument();
    expect(within(d).queryByText(/You get:/)).not.toBeInTheDocument();
  });

  it("a credit says nothing is due and how much goes to the next invoice", async () => {
    serve(upgrade({ totalCents: -1500, amountDueCents: 0 }));
    show();
    const d = await dialog();
    expect(await within(d).findByText(/Nothing to pay today\./)).toBeInTheDocument();
    expect(within(d).getByText("$15.00")).toBeInTheDocument();
    expect(within(d).getByText(/credit of/)).toBeInTheDocument();
  });

  it("a zero total says nothing is due, without inventing a credit", async () => {
    serve(upgrade({ totalCents: 0, amountDueCents: 0 }));
    show();
    const d = await dialog();
    expect(await within(d).findByText(/Nothing to pay today\./)).toBeInTheDocument();
    expect(within(d).queryByText(/credit of/)).not.toBeInTheDocument();
  });

  it("if the price moved, the new figure is shown to confirm again, and the second confirmation uses it", async () => {
    serve(upgrade(), (n) =>
      n === 1
        ? HttpResponse.json(
            {
              error: "The price has changed.",
              code: "price_changed",
              preview: upgrade({ totalCents: 4100, amountDueCents: 4100, prorationDate: 1767226000 }),
            },
            { status: 409 }
          )
        : HttpResponse.json({ outcome: "upgraded" })
    );
    const { onChanged } = show();
    await userEvent.click(await screen.findByRole("button", { name: "Upgrade now" }));
    const d = await dialog();
    expect(await within(d).findByText(/The price changed since you last looked/)).toBeInTheDocument();
    expect(within(d).getByText("$41.00")).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
    await userEvent.click(within(d).getByRole("button", { name: "Upgrade now" }));
    await waitFor(() => expect(calls.changes[1]).toEqual({ planId: 2, expectedTotalCents: 4100, prorationDate: 1767226000 }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("another failure is shown in the dialog, which stays open", async () => {
    serve(upgrade(), () => HttpResponse.json({ error: "Your card was declined." }, { status: 502 }));
    const { onClose, onChanged } = show();
    await userEvent.click(await screen.findByRole("button", { name: "Upgrade now" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your card was declined.");
    expect(onClose).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Upgrade now" })).toBeEnabled();
  });
});

describe("a downgrade", () => {
  it("says when it happens, what is lost, and that nothing is deleted", async () => {
    serve(downgrade());
    show(pro);
    const d = await dialog();
    expect(await within(d).findByText("Switch to Professional on February 1, 2026")).toBeInTheDocument();
    expect(within(d).getByText(/Until then nothing changes\./)).toBeInTheDocument();
    expect(within(d).getByText(/You will lose access to Strategy Prep then\. Nothing is deleted/)).toBeInTheDocument();
    expect(within(d).queryByText(/Today you pay/)).not.toBeInTheDocument();
  });

  it("confirming schedules it, with no price or date sent", async () => {
    serve(downgrade(), () => HttpResponse.json({ outcome: "scheduled" }));
    const { onChanged } = show(pro);
    await userEvent.click(await screen.findByRole("button", { name: "Schedule the change" }));
    await waitFor(() => expect(calls.changes).toEqual([{ planId: 1, expectedTotalCents: 0 }]));
    await waitFor(() => expect(onChanged.mock.calls[0][0].outcome).toBe("scheduled"));
  });

  it("an already scheduled change cannot be scheduled again", async () => {
    serve(downgrade({ alreadyScheduled: true }));
    show(pro);
    expect(await screen.findByText("This change is already scheduled.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Schedule the change" })).toBeDisabled();
  });

  it("falls back to the end of the billing period when there is no date", async () => {
    serve(downgrade({ effectiveAt: null }));
    show(pro);
    expect(await screen.findByText("Switch to Professional on the end of your billing period")).toBeInTheDocument();
  });
});

describe("the dialog itself", () => {
  it("cannot be confirmed before the price is known", async () => {
    serve(() => new Promise(() => {}));
    show();
    await dialog();
    expect(screen.getByText("Working out the price...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });

  it("a preview that fails says so, can be retried, and changes nothing", async () => {
    serve((n) => (n === 1 ? HttpResponse.json({ error: "Stripe is unreachable." }, { status: 502 }) : HttpResponse.json(upgrade())));
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent("Stripe is unreachable.");
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Switch to Elite now")).toBeInTheDocument();
    expect(calls.previews).toHaveLength(2);
    expect(calls.changes).toEqual([]);
  });

  it("'Not now' and Escape close it without changing anything", async () => {
    serve(upgrade());
    const { onClose } = show();
    await userEvent.click(await screen.findByRole("button", { name: "Not now" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2));
    expect(calls.changes).toEqual([]);
  });

  it("is a labelled modal dialog", async () => {
    serve(upgrade());
    show();
    const d = await dialog();
    expect(d).toHaveAttribute("aria-modal", "true");
    expect(await screen.findByRole("dialog", { name: /Switch to Elite now/ })).toBeInTheDocument();
  });
});
