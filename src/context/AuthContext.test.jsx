import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { API } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/utils";
import { useAuth } from "./AuthContext";

function Probe() {
  const { user, initializing, billing, hasModule, login, logout } = useAuth();
  if (initializing) return <p>loading</p>;
  return (
    <div>
      <p>{user ? `signed in as ${user.name}` : "signed out"}</p>
      <p>{hasModule("documents") ? "has documents" : "no documents"}</p>
      <p>{billing ? `plan ${billing.plan.name}` : "no plan"}</p>
      <button onClick={() => login("advisor", "pw").catch(() => {})}>log in</button>
      <button onClick={logout}>log out</button>
    </div>
  );
}

const noSession = () =>
  server.use(
    http.get(`${API}/api/auth/me`, () => new HttpResponse(null, { status: 401 })),
    http.post(`${API}/api/auth/refresh`, () => new HttpResponse(null, { status: 401 }))
  );

describe("AuthProvider", () => {
  it("restores the session at boot, then loads the plan's modules", async () => {
    renderWithProviders(<Probe />, { providers: ["router", "toast", "auth"] });
    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(await screen.findByText("signed in as Test Advisor")).toBeInTheDocument();
    expect(await screen.findByText("has documents")).toBeInTheDocument();
    expect(screen.getByText("plan Professional")).toBeInTheDocument();
  });

  it("stays signed out when there is no valid session", async () => {
    noSession();
    renderWithProviders(<Probe />, { providers: ["router", "toast", "auth"] });
    expect(await screen.findByText("signed out")).toBeInTheDocument();
    expect(screen.getByText("no documents")).toBeInTheDocument();
  });

  it("logs in", async () => {
    noSession();
    server.use(http.post(`${API}/api/auth/login`, () => HttpResponse.json({ user: { id: 2, name: "Pat", email: "p@example.com" } })));
    renderWithProviders(<Probe />, { providers: ["router", "toast", "auth"] });
    await screen.findByText("signed out");
    await userEvent.click(screen.getByText("log in"));
    expect(await screen.findByText("signed in as Pat")).toBeInTheDocument();
  });

  it("logging out clears the cached client data, so the next person at a shared computer cannot read it", async () => {
    localStorage.setItem("advisorpilot.clients.advisor@example.com", "[{\"id\":1}]");
    renderWithProviders(<Probe />, { providers: ["router", "toast", "auth"] });
    await screen.findByText("signed in as Test Advisor");
    await userEvent.click(screen.getByText("log out"));
    expect(await screen.findByText("signed out")).toBeInTheDocument();
    expect(localStorage.getItem("advisorpilot.clients.advisor@example.com")).toBeNull();
  });

  it("a session that can no longer be refreshed signs the user out and wipes the cache", async () => {
    server.use(http.get(`${API}/api/billing/me`, () => new HttpResponse(null, { status: 401 })), http.post(`${API}/api/auth/refresh`, () => new HttpResponse(null, { status: 401 })));
    localStorage.setItem("advisorpilot.clients.advisor@example.com", "[]");
    renderWithProviders(<Probe />, { providers: ["router", "toast", "auth"] });
    expect(await screen.findByText("signed out")).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem("advisorpilot.clients.advisor@example.com")).toBeNull());
  });
});
