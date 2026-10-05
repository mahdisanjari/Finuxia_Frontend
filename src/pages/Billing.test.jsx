import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { planBeforeCheckout } from "../lib/checkout";
import { API, testBilling } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/utils";
import Billing from "./Billing";

const plans = [
  { id: 1, key: "professional", name: "Professional", description: "", priceCents: 4900, currency: "usd", interval: "month", modules: [] },
  { id: 2, key: "elite", name: "Elite", description: "", priceCents: 9900, currency: "usd", interval: "month", modules: [] },
];
const realLocation = window.location;

beforeEach(() => {
  sessionStorage.clear();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...realLocation, origin: realLocation.origin, href: "http://localhost/billing" },
  });
});
afterEach(() => Object.defineProperty(window, "location", { configurable: true, value: realLocation }));

describe("starting a purchase", () => {
  it("remembers the plan the account is on, so the return page can tell the purchase really went through", async () => {
    server.use(
      http.get(`${API}/api/billing/plans`, () => HttpResponse.json({ plans, stripeConfigured: true, purchasesOpen: true })),
      http.get(`${API}/api/billing/me`, () =>
        HttpResponse.json({ ...testBilling, plan: { key: "starter", name: "Starter", priceCents: 0 } })
      ),
      http.post(`${API}/api/billing/purchase`, () => HttpResponse.json({ checkoutUrl: "https://checkout.example/session" }))
    );
    renderWithProviders(<Billing />, { providers: ["router", "toast", "auth"] });
    const subscribe = await screen.findAllByRole("button", { name: "Subscribe" });
    await userEvent.click(subscribe[0]);
    await waitFor(() => expect(window.location.href).toBe("https://checkout.example/session"));
    expect(planBeforeCheckout()).toBe("starter");
  });
});

describe("the subscription card on the page", () => {
  it("sits above the plans for a paid plan, so a customer can cancel from Plans & Billing", async () => {
    server.use(
      http.get(`${API}/api/billing/plans`, () => HttpResponse.json({ plans, stripeConfigured: true, purchasesOpen: true })),
      http.get(`${API}/api/billing/me`, () =>
        HttpResponse.json({
          ...testBilling,
          plan: { ...plans[1] },
          currentPeriodEnd: new Date(2026, 1, 1, 12).toISOString(),
          cancelAtPeriodEnd: false,
        })
      )
    );
    renderWithProviders(<Billing />, { providers: ["router", "toast", "auth"] });
    expect(await screen.findByRole("button", { name: "Cancel subscription" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Your subscription" })).toBeInTheDocument();
  });

  it("is not there for a free plan", async () => {
    server.use(
      http.get(`${API}/api/billing/plans`, () => HttpResponse.json({ plans, stripeConfigured: true, purchasesOpen: true })),
      http.get(`${API}/api/billing/me`, () =>
        HttpResponse.json({ ...testBilling, plan: { key: "starter", name: "Starter", priceCents: 0 } })
      )
    );
    renderWithProviders(<Billing />, { providers: ["router", "toast", "auth"] });
    await screen.findAllByRole("button", { name: /Subscribe/ });
    expect(screen.queryByRole("region", { name: "Your subscription" })).not.toBeInTheDocument();
  });
});

describe("the invoices on the page", () => {
  const paidMe = () => http.get(`${API}/api/billing/me`, () => HttpResponse.json({ ...testBilling, plan: { ...plans[1] } }));
  const invoice = {
    id: "in_1",
    number: "INV-0001",
    date: new Date(2026, 0, 5, 12).toISOString(),
    amountCents: 9900,
    currency: "usd",
    status: "paid",
    description: "",
    hostedUrl: "",
    pdfUrl: "",
  };

  it("a paid plan shows its invoices", async () => {
    server.use(
      http.get(`${API}/api/billing/plans`, () => HttpResponse.json({ plans, stripeConfigured: true, purchasesOpen: true })),
      paidMe(),
      http.get(`${API}/api/billing/invoices`, () => HttpResponse.json({ available: true, invoices: [invoice] }))
    );
    renderWithProviders(<Billing />, { providers: ["router", "toast", "auth"] });
    expect(await screen.findByRole("region", { name: "Invoices" })).toBeInTheDocument();
    expect(screen.getByText("INV-0001")).toBeInTheDocument();
  });

  it("a free plan asks for no invoices", async () => {
    let asked = 0;
    server.use(
      http.get(`${API}/api/billing/plans`, () => HttpResponse.json({ plans, stripeConfigured: true, purchasesOpen: true })),
      http.get(`${API}/api/billing/me`, () =>
        HttpResponse.json({ ...testBilling, plan: { key: "starter", name: "Starter", priceCents: 0 } })
      ),
      http.get(`${API}/api/billing/invoices`, () => {
        asked += 1;
        return HttpResponse.json({ available: true, invoices: [invoice] });
      })
    );
    renderWithProviders(<Billing />, { providers: ["router", "toast", "auth"] });
    await screen.findAllByRole("button", { name: /Subscribe/ });
    expect(screen.queryByRole("region", { name: "Invoices" })).not.toBeInTheDocument();
    expect(asked).toBe(0);
  });
});

describe("changing plan from the page", () => {
  const meAs = (plan, extra = {}) =>
    http.get(`${API}/api/billing/me`, () => HttpResponse.json({ ...testBilling, status: "active", plan, ...extra }));
  const withPlans = () =>
    http.get(`${API}/api/billing/plans`, () =>
      HttpResponse.json({
        plans: [
          { id: 0, key: "starter", name: "Starter", description: "", priceCents: 0, currency: "usd", interval: "month", modules: [] },
          ...plans,
        ],
        stripeConfigured: true,
        purchasesOpen: true,
      })
    );
  const upgradePreview = {
    kind: "upgrade",
    effective: "now",
    effectiveAt: null,
    plan: plans[1],
    currentPlan: plans[0],
    totalCents: 3300,
    amountDueCents: 3300,
    currency: "usd",
    lines: [],
    prorationDate: 1767225600,
    billingDate: new Date(2026, 1, 1, 12).toISOString(),
    modulesGained: [],
    modulesLost: [],
    warnings: [],
    alreadyScheduled: false,
  };

  it("a paying customer is offered Upgrade and Downgrade, not Subscribe", async () => {
    server.use(withPlans(), meAs(plans[0]));
    renderWithProviders(<Billing />, { providers: ["router", "toast", "auth"] });
    expect(await screen.findByRole("button", { name: "Upgrade" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Downgrade" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Active" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Subscribe" })).not.toBeInTheDocument();
  });

  it("choosing one opens the preview, and confirming an upgrade says so on the page", async () => {
    let state = plans[0];
    server.use(
      withPlans(),
      http.get(`${API}/api/billing/me`, () => HttpResponse.json({ ...testBilling, status: "active", plan: state })),
      http.post(`${API}/api/billing/plan-change/preview`, () => HttpResponse.json(upgradePreview)),
      http.post(`${API}/api/billing/plan-change`, () => {
        state = plans[1];
        return HttpResponse.json({ outcome: "upgraded" });
      })
    );
    renderWithProviders(<Billing />, { providers: ["router", "toast", "auth"] });
    await userEvent.click(await screen.findByRole("button", { name: "Upgrade" }));
    expect(await screen.findByRole("dialog", { name: /Switch to Elite now/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Upgrade now" }));
    await waitFor(() => expect(document.querySelector("[role=status][aria-live]")?.textContent).toMatch(/Your plan has been upgraded/));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Upgrade" })).not.toBeInTheDocument()); // now on the top plan: nothing above it
    expect(screen.getAllByRole("button", { name: "Downgrade" })).toHaveLength(2);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("a downgrade says it is scheduled and that nothing changes yet", async () => {
    server.use(
      withPlans(),
      meAs(plans[1]),
      http.post(`${API}/api/billing/plan-change/preview`, () =>
        HttpResponse.json({
          ...upgradePreview,
          kind: "downgrade",
          effective: "period_end",
          effectiveAt: new Date(2026, 1, 1, 12).toISOString(),
          plan: plans[0],
          currentPlan: plans[1],
          totalCents: 0,
          amountDueCents: 0,
          prorationDate: null,
          warnings: ["Until then nothing changes."],
        })
      ),
      http.post(`${API}/api/billing/plan-change`, () => HttpResponse.json({ outcome: "scheduled" }))
    );
    renderWithProviders(<Billing />, { providers: ["router", "toast", "auth"] });
    const buttons = await screen.findAllByRole("button", { name: "Downgrade" });
    await userEvent.click(buttons[0]);
    await userEvent.click(await screen.findByRole("button", { name: "Schedule the change" }));
    await waitFor(() =>
      expect(document.querySelector("[role=status][aria-live]")?.textContent).toMatch(/Nothing changes until your current period ends/)
    );
  });

  it("while a cancellation is pending, or a payment has failed, changing is blocked with the reason", async () => {
    server.use(
      withPlans(),
      meAs(plans[0], { cancelAtPeriodEnd: true, endsAt: new Date(2026, 1, 1, 12).toISOString(), canReactivate: true })
    );
    const first = renderWithProviders(<Billing />, { providers: ["router", "toast", "auth"] });
    const blocked = await screen.findAllByRole("button", { name: "Keep your subscription first" });
    expect(blocked.length).toBeGreaterThan(0);
    blocked.forEach((b) => expect(b).toBeDisabled());
    first.unmount();
    server.use(meAs(plans[0], { status: "past_due" }));
    renderWithProviders(<Billing />, { providers: ["router", "toast", "auth"] });
    const failed = await screen.findAllByRole("button", { name: "Fix your payment first" });
    failed.forEach((b) => expect(b).toBeDisabled());
  });

  it("a customer on the free plan still sees Subscribe", async () => {
    server.use(withPlans(), meAs({ key: "starter", name: "Starter", priceCents: 0 }));
    renderWithProviders(<Billing />, { providers: ["router", "toast", "auth"] });
    expect((await screen.findAllByRole("button", { name: "Subscribe" })).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Upgrade" })).not.toBeInTheDocument();
  });
});
