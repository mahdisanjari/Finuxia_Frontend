import { http, HttpResponse } from "msw";

export const API = "http://api.test";

// The user the default handlers sign in as.
export const testUser = {
  id: 1,
  name: "Test Advisor",
  email: "advisor@example.com",
  username: "advisor",
  hasAvatar: false,
  subscriptionActive: true,
};

export const testBilling = {
  plan: { key: "professional", name: "Professional" },
  status: "active",
  moduleKeys: ["sales_package_prep", "documents"],
  currentPeriodEnd: null,
};

// Defaults every test starts from: a signed-in advisor with no clients. A test overrides what it cares
// about with `server.use(http.get(...))`; anything it does not override still answers, so a component never
// hits a real network (an unhandled request fails the test, see setup.js).
export const defaultHandlers = [
  http.get(`${API}/api/auth/me`, () => HttpResponse.json({ user: testUser })),
  http.get(`${API}/api/billing/me`, () => HttpResponse.json(testBilling)),
  http.get(`${API}/api/clients`, () => HttpResponse.json([])),
  http.get(`${API}/api/state`, () => HttpResponse.json({ doneTasks: {}, groups: [] })),
  http.post(`${API}/api/auth/logout`, () => new HttpResponse(null, { status: 204 })),
];
