import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { API } from "../../test/handlers";
import { server } from "../../test/server";
import { renderWithProviders, screen, within } from "../../test/utils";
import AiUsagePanel from "./AiUsagePanel";

const usage = (over = {}) => ({
  plan: "Professional",
  aiIncluded: true,
  unlimited: false,
  period: { start: "2026-01-01T00:00:00Z", end: "2026-02-01T00:00:00Z", resetsAt: "2026-02-01T00:00:00Z" },
  credits: { included: 100, extra: 0, total: 100, used: 30, inFlight: 0, remaining: 70 },
  percentUsed: 30,
  warning: null,
  byFeature: [{ feature: "reason_why_letter", label: "Reason Why Letter", calls: 2, credits: 10 }],
  wallet: { balanceCents: 500 },
  recentUsage: [],
  restriction: { switchedOff: false, switchedOffMessage: "", disabled: false, disabledFeatures: [] },
  ...over,
});

describe("AiUsagePanel", () => {
  it("shows the recent calls as an accessible table, with what came from the wallet", async () => {
    server.use(
      http.get(`${API}/api/billing/ai-usage`, () =>
        HttpResponse.json(
          usage({
            recentUsage: [
              { feature: "reason_why_letter", label: "Reason Why Letter", costCents: 0, credits: 5, createdAt: "2026-01-10T12:00:00Z" },
              { feature: "followup_draft", label: "Follow-up draft", costCents: 3, credits: 2, createdAt: "2026-01-11T12:00:00Z" },
            ],
          })
        )
      )
    );
    renderWithProviders(<AiUsagePanel />, { providers: ["router", "toast", "auth"] });
    const table = await screen.findByRole("table", { name: "Recent AI use" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent)
    ).toEqual(["Feature", "Date", "Credits"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Reason Why Letter")).toBeInTheDocument();
    expect(within(rows[1]).getByText("$0.03 from wallet")).toBeInTheDocument();
  });

  it("says so when there is no use yet", async () => {
    server.use(http.get(`${API}/api/billing/ai-usage`, () => HttpResponse.json(usage())));
    renderWithProviders(<AiUsagePanel />, { providers: ["router", "toast", "auth"] });
    expect(await screen.findByText(/Nothing yet/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
