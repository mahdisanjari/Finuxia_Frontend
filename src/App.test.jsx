import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import App from "./App";
import { API } from "./test/handlers";
import { server } from "./test/server";
import { renderWithProviders, screen, userEvent, within } from "./test/utils";

const signedOut = () =>
  server.use(
    http.get(`${API}/api/auth/me`, () => new HttpResponse(null, { status: 401 })),
    http.post(`${API}/api/auth/refresh`, () => new HttpResponse(null, { status: 401 }))
  );

describe("unknown addresses", () => {
  it("a signed-out visitor with a mistyped URL sees a not-found page, not the login page", async () => {
    signedOut();
    renderWithProviders(<App />, { route: "/dashbord" });
    expect(await screen.findByText("We can't find that page")).toBeInTheDocument();
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.queryByText("Welcome back")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the login page" })).toHaveAttribute("href", "/login");
  });

  it("a signed-in user gets the same page, with a way back to the dashboard", async () => {
    renderWithProviders(<App />, { route: "/no/such/page" });
    expect(await screen.findByText("We can't find that page")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Back to the dashboard" })).toHaveAttribute("href", "/dashboard");
  });

  it("does not redirect: the address stays as typed", async () => {
    signedOut();
    renderWithProviders(<App />, { route: "/nonsense" });
    await screen.findByText("We can't find that page");
    expect(screen.queryByText("Welcome back")).not.toBeInTheDocument();
  });

  it("the known public pages still work", async () => {
    signedOut();
    renderWithProviders(<App />, { route: "/login" });
    expect(await screen.findByText("Welcome back")).toBeInTheDocument();
  });
});

describe("the meetings page", () => {
  it("is reachable from the navigation (Meetings menu), not only by typing the URL", async () => {
    renderWithProviders(<App />, { route: "/meetings" });
    const nav = await screen.findByRole("navigation");
    await userEvent.click(within(nav).getByRole("button", { name: /meetings/i }));
    expect(await screen.findByRole("link", { name: "Calendar Meetings" })).toHaveAttribute("href", "/meetings"); // the menu is portaled to the body
  });
});

describe("the payment-return routes are registered", () => {
  it("/billing/success asks the server before saying anything", async () => {
    renderWithProviders(<App />, { route: "/billing/success?checkout=success" });
    expect(await screen.findByText(/Confirming your payment|haven't received confirmation/)).toBeInTheDocument();
    expect(screen.queryByText("You're all set")).not.toBeInTheDocument();
  });

  it("/billing/cancel is its own page", async () => {
    renderWithProviders(<App />, { route: "/billing/cancel" });
    expect(await screen.findByText("Checkout cancelled")).toBeInTheDocument();
  });
});
