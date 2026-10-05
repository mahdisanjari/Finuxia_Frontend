import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { API } from "../../test/handlers";
import { server } from "../../test/server";
import { renderWithProviders, screen } from "../../test/utils";
import ComplianceProfilePanel from "./ComplianceProfilePanel";

describe("ComplianceProfilePanel", () => {
  it("renders its fields with real class names (not a function) and without React warnings", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(
      http.get(`${API}/api/auth/me`, () =>
        HttpResponse.json({
          user: { id: 1, name: "T", email: "t@e.com", username: "t", licensedProvinces: [], quebecSectors: [], companiesRepresented: [] },
        })
      )
    );
    renderWithProviders(<ComplianceProfilePanel />, { providers: ["router", "toast", "auth"] });
    const field = await screen.findByLabelText(/agent code/i);
    expect(typeof field.className).toBe("string");
    expect(field.className).toContain("rounded-lg");
    expect(errors.mock.calls.flat().join(" ")).not.toMatch(/Invalid value for prop/);
    errors.mockRestore();
  });
});
