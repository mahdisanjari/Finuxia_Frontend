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
        HttpResponse.json({ ...testBilling, plan: { key: "professional", name: "Professional", priceCents: 4900 } })
      ),
      http.post(`${API}/api/billing/purchase`, () => HttpResponse.json({ checkoutUrl: "https://checkout.example/session" }))
    );
    renderWithProviders(<Billing />, { providers: ["router", "toast", "auth"] });
    const subscribe = await screen.findAllByRole("button", { name: "Subscribe" }); // Professional is the current plan ("Active")
    await userEvent.click(subscribe[0]);
    await waitFor(() => expect(window.location.href).toBe("https://checkout.example/session"));
    expect(planBeforeCheckout()).toBe("professional");
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
