import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { API, testBilling } from "../../test/handlers";
import { server } from "../../test/server";
import { fireEvent, renderWithProviders, screen, userEvent, waitFor, within } from "../../test/utils";
import SubscriptionCard from "./SubscriptionCard";

const at = (y, m, d) => new Date(y, m - 1, d, 12).toISOString(); // local noon: the same calendar day in every time zone
const elite = { id: 2, key: "elite", name: "Elite", priceCents: 9900, currency: "usd", interval: "month", modules: [] };
const active = () => ({
  ...testBilling,
  plan: elite,
  status: "active",
  currentPeriodEnd: at(2026, 2, 1),
  cancelAtPeriodEnd: false,
  endsAt: null,
  canceledAt: null,
  canReactivate: false,
});
const pending = () => ({ ...active(), cancelAtPeriodEnd: true, endsAt: at(2026, 2, 1), canceledAt: at(2026, 1, 10), canReactivate: true });

let state; // the subscription "on the server"
let posts;
const realLocation = window.location;

afterEach(() => Object.defineProperty(window, "location", { configurable: true, value: realLocation }));

beforeEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: { ...realLocation, href: "http://localhost/billing" } });
  state = active();
  posts = [];
  server.use(
    http.get(`${API}/api/billing/me`, () => HttpResponse.json(state)),
    http.post(`${API}/api/billing/cancel`, async ({ request }) => {
      const body = await request.json();
      posts.push({ path: "cancel", body });
      state = body.immediately ? { ...active(), status: "canceled", canceledAt: at(2026, 1, 10) } : pending();
      return HttpResponse.json(state);
    }),
    http.post(`${API}/api/billing/portal`, async ({ request }) => {
      posts.push({ path: "portal", body: await request.json() });
      return HttpResponse.json({ url: "https://billing.stripe.com/p/session/abc" });
    }),
    http.post(`${API}/api/billing/reactivate`, () => {
      posts.push({ path: "reactivate" });
      state = active();
      return HttpResponse.json(state);
    })
  );
});

const show = () => renderWithProviders(<SubscriptionCard />, { providers: ["router", "toast", "auth"] });
const toast = () => document.querySelector("[role=status][aria-live]")?.textContent || "";
const openDialog = async () => {
  await userEvent.click(await screen.findByRole("button", { name: "Cancel subscription" }));
  return screen.findByRole("dialog", { name: /cancel your subscription/i });
};

describe("what the card shows", () => {
  it("a paid plan: its name, when it renews, and a way to cancel", async () => {
    show();
    expect(await screen.findByText("Elite")).toBeInTheDocument();
    expect(screen.getByText("Renews on February 1, 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel subscription" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Keep my subscription" })).not.toBeInTheDocument();
  });

  it("nothing for a free plan, the grandfathered plan, or no plan: there is nothing to cancel", async () => {
    for (const billing of [
      { ...active(), plan: { ...elite, key: "starter", name: "Starter", priceCents: 0 } },
      { ...active(), plan: { ...elite, key: "legacy", name: "Legacy Access", priceCents: 0 } },
      { ...active(), plan: null, status: null },
    ]) {
      state = billing;
      const { unmount } = show();
      await waitFor(() => expect(screen.queryByText(/Your subscription/)).not.toBeInTheDocument());
      expect(screen.queryByRole("button", { name: "Cancel subscription" })).not.toBeInTheDocument();
      unmount();
    }
  });

  it("a pending cancellation: when access ends, with a way to take it back", async () => {
    state = pending();
    show();
    expect(await screen.findByText(/Your subscription ends on February 1, 2026\. You keep full access until then\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep my subscription" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel subscription" })).not.toBeInTheDocument();
  });

  it("a cancellation whose period is over can no longer be taken back: it points at the plans", async () => {
    state = { ...pending(), canReactivate: false };
    show();
    expect(await screen.findByText("To continue, choose a plan below.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Keep my subscription" })).not.toBeInTheDocument();
  });

  it("an ended subscription says so and that coming back is at today's price", async () => {
    state = { ...active(), status: "canceled", canceledAt: at(2026, 1, 10) };
    show();
    expect(
      await screen.findByText(/Your subscription has ended\. Choose a plan below to subscribe again at today's price\./)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel subscription" })).not.toBeInTheDocument();
  });

  it("an ended subscription never also claims to be 'ending'", async () => {
    state = { ...active(), status: "canceled", cancelAtPeriodEnd: true, endsAt: at(2026, 2, 1), canceledAt: at(2026, 1, 10) };
    show();
    expect(await screen.findByText(/Your subscription has ended/)).toBeInTheDocument();
    expect(screen.queryByText(/Your subscription ends on/)).not.toBeInTheDocument();
  });

  it("a failed payment says features are paused while it is retried", async () => {
    state = { ...active(), status: "past_due" };
    show();
    expect(await screen.findByText(/couldn't take your last payment/)).toBeInTheDocument();
  });
});

describe("cancelling", () => {
  it("is a dialog that says what happens: access until the end date, no more charges, no refund", async () => {
    show();
    const dialog = await openDialog();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByText("February 1, 2026")).toBeInTheDocument();
    expect(within(dialog).getByText(/won't renew/)).toBeInTheDocument();
    expect(within(dialog).getByText(/doesn't refund what you've already paid/)).toBeInTheDocument();
  });

  it("cancels at the period end by default, sends the reason, and then shows when access ends", async () => {
    show();
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole("radio", { name: "It costs too much" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel at period end" }));
    await waitFor(() =>
      expect(posts).toEqual([{ path: "cancel", body: { reason: "It costs too much", immediately: false, confirmImmediate: false } }])
    );
    expect(await screen.findByText(/Your subscription ends on February 1, 2026/)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(toast()).toMatch(/You keep access until the end of the period/);
    expect(screen.queryByRole("button", { name: "Cancel subscription" })).not.toBeInTheDocument();
  });

  it("the reason is optional", async () => {
    show();
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel at period end" }));
    await waitFor(() => expect(posts[0].body.reason).toBe(""));
  });

  it("'Other' sends what the customer wrote", async () => {
    show();
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole("radio", { name: "Other" }));
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Tell us more" }), "Retiring in March");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel at period end" }));
    await waitFor(() => expect(posts[0].body.reason).toBe("Other: Retiring in March"));
  });

  it("'Keep my plan' and Escape close the dialog without asking the server for anything", async () => {
    show();
    let dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: "Keep my plan" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    dialog = await openDialog();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(posts).toEqual([]);
  });

  it("a server error is shown in the dialog, which stays open, and nothing changes", async () => {
    server.use(
      http.post(`${API}/api/billing/cancel`, () => HttpResponse.json({ error: "Stripe is unreachable. Try again." }, { status: 502 }))
    );
    show();
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel at period end" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Stripe is unreachable. Try again.");
    expect(within(dialog).getByRole("button", { name: "Cancel at period end" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cancel subscription", hidden: true })).toBeInTheDocument(); // behind the dialog, so hidden from the tree
  });
});

describe("ending it now", () => {
  const tick = async (dialog) => userEvent.click(within(dialog).getByRole("checkbox", { name: /End it now/ }));

  it("needs a second, explicit confirmation before the button works", async () => {
    show();
    const dialog = await openDialog();
    await tick(dialog);
    const end = within(dialog).getByRole("button", { name: "End my subscription now" });
    expect(end).toBeDisabled();
    expect(within(dialog).getByText(/Your Elite plan will end right now/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("checkbox", { name: /I understand I lose access/ }));
    expect(end).toBeEnabled();
  });

  it("cannot be submitted around the button: no confirmation, no request", async () => {
    show();
    const dialog = await openDialog();
    await tick(dialog);
    fireEvent.submit(dialog.querySelector("form")); // e.g. Enter in a field, or a script
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(posts).toEqual([]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("sends the confirmation with the request, and the subscription then shows as ended", async () => {
    show();
    const dialog = await openDialog();
    await tick(dialog);
    await userEvent.click(within(dialog).getByRole("checkbox", { name: /I understand/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: "End my subscription now" }));
    await waitFor(() => expect(posts).toEqual([{ path: "cancel", body: { reason: "", immediately: true, confirmImmediate: true } }]));
    expect(await screen.findByText(/Your subscription has ended\. Choose a plan below/)).toBeInTheDocument();
    expect(toast()).toMatch(/Your subscription has ended\./);
  });

  it("changing your mind about ending now forgets the confirmation", async () => {
    show();
    const dialog = await openDialog();
    await tick(dialog);
    await userEvent.click(within(dialog).getByRole("checkbox", { name: /I understand/ }));
    await tick(dialog); // back to "at the period end"
    expect(within(dialog).queryByRole("checkbox", { name: /I understand/ })).not.toBeInTheDocument();
    await tick(dialog);
    expect(within(dialog).getByRole("checkbox", { name: /I understand/ })).not.toBeChecked();
    expect(within(dialog).getByRole("button", { name: "End my subscription now" })).toBeDisabled();
  });
});

describe("taking a cancellation back", () => {
  it("keeps the subscription, with nothing to pay", async () => {
    state = pending();
    show();
    await userEvent.click(await screen.findByRole("button", { name: "Keep my subscription" }));
    await waitFor(() => expect(posts).toEqual([{ path: "reactivate" }]));
    expect(await screen.findByRole("button", { name: "Cancel subscription" })).toBeInTheDocument();
    expect(screen.queryByText(/Your subscription ends on/)).not.toBeInTheDocument();
    expect(toast()).toMatch(/Nothing to pay now/);
  });

  it("if the period ended in the meantime it says so and shows the plans to choose from", async () => {
    state = pending();
    server.use(
      http.post(`${API}/api/billing/reactivate`, () => {
        state = { ...active(), status: "canceled", canceledAt: at(2026, 1, 10) };
        return HttpResponse.json(
          { error: "Your subscription has ended. Choose a plan to subscribe again at today's price.", code: "purchase_required" },
          { status: 409 }
        );
      })
    );
    show();
    await userEvent.click(await screen.findByRole("button", { name: "Keep my subscription" }));
    expect(await screen.findByText(/Your subscription has ended\. Choose a plan below/)).toBeInTheDocument();
    expect(toast()).toMatch(/Choose a plan to subscribe again/);
  });
});

describe("the card and the invoices live at Stripe", () => {
  it("'Manage payment method & invoices' sends the customer to Stripe's page", async () => {
    show();
    await userEvent.click(await screen.findByRole("button", { name: "Manage payment method & invoices" }));
    await waitFor(() => expect(window.location.href).toBe("https://billing.stripe.com/p/session/abc"));
    expect(posts).toEqual([{ path: "portal", body: {} }]); // no flow, and no return address: the server decides that
  });

  it("the customer cannot click twice while the browser is leaving", async () => {
    show();
    const button = await screen.findByRole("button", { name: "Manage payment method & invoices" });
    await userEvent.click(button);
    await waitFor(() => expect(window.location.href).toBe("https://billing.stripe.com/p/session/abc"));
    expect(button).toBeDisabled();
  });

  it("when a payment failed, 'Update card' goes straight to the card form", async () => {
    state = { ...active(), status: "past_due" };
    show();
    await userEvent.click(await screen.findByRole("button", { name: "Update card" }));
    await waitFor(() => expect(posts).toEqual([{ path: "portal", body: { flow: "payment_method_update" } }]));
    expect(window.location.href).toBe("https://billing.stripe.com/p/session/abc");
  });

  it("there is no 'Update card' while payments are fine", async () => {
    show();
    await screen.findByText("Elite");
    expect(screen.queryByRole("button", { name: "Update card" })).not.toBeInTheDocument();
  });

  it("a failure is a message and the page stays where it is", async () => {
    server.use(
      http.post(`${API}/api/billing/portal`, () => HttpResponse.json({ error: "Could not open billing management." }, { status: 502 }))
    );
    show();
    const button = await screen.findByRole("button", { name: "Manage payment method & invoices" });
    await userEvent.click(button);
    await waitFor(() => expect(toast()).toMatch(/Could not open billing management/));
    expect(window.location.href).toBe("http://localhost/billing");
    expect(button).toBeEnabled();
  });

  it("a customer who has never paid is told there is nothing to manage", async () => {
    server.use(
      http.post(`${API}/api/billing/portal`, () =>
        HttpResponse.json(
          { error: "You haven't paid for a plan yet, so there is no billing account to manage.", code: "no_billing_account" },
          { status: 409 }
        )
      )
    );
    show();
    await userEvent.click(await screen.findByRole("button", { name: "Manage payment method & invoices" }));
    await waitFor(() => expect(toast()).toMatch(/no billing account to manage/));
    expect(window.location.href).toBe("http://localhost/billing");
  });
});
