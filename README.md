# Finuxia — Frontend

A CRM and productivity platform for financial advisors, built with **React +
Vite + Tailwind CSS**. Talks to the [Finuxia backend](https://github.com/mahdisanjari/Finuxia_Backend)
(Django REST API) over JSON.

## Features

- **Client pipeline** — stages, notes, per-client files, and a daily task checklist
- **Booking** — shareable booking links, availability, and a public client-facing booking page
- **Automated follow-ups** — AI-drafted, scheduled follow-up emails per client
- **Sales Package Prep** — a guided wizard that collects client/product data, drafts an AI Reason Why Letter, generates compliance forms, and assembles a signature-ready package
- **Strategy Prep** and **Presentations** — AI-assisted advisor tooling and a shared presentation library
- **Integrations** — Google Calendar, Google Drive, and Zoom, each connected per-advisor
- **Plans & billing** — module-gated subscription plans with a Stripe-ready checkout flow
- **Reports** and a live-editable **Guide** (managed from the backend admin)

## Run it

**1. Start the backend first** — see the [backend README](https://github.com/mahdisanjari/Finuxia_Backend) for setup.

**2. Start the frontend:**

```bash
npm install
npm run dev             # http://localhost:5173
```

## Configuration

Copy `.env.example` to `.env` and set the backend URL:

```
VITE_API_URL=http://localhost:4000
```

`VITE_GOOGLE_CLIENT_ID` is optional — it enables the browser-side Google
Calendar integration.

## How data flows

- **Auth** is JWT — the token is stored in `localStorage` and attached to every request.
- **Clients & daily state** load from the API on login, render instantly from a
  per-user cache, and sync back with a debounced `PUT` on every change (optimistic).
- **Guide** content is fetched live from `/api/guides` and edited in the Django admin.
- **Billing** status (which plan/modules an account has) is fetched on login and
  gates the relevant pages client-side, mirroring what the backend itself enforces.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm test` | Run the tests once (Vitest, jsdom) |
| `npm run test:watch` | Run the tests and re-run on change |
| `npm run test:coverage` | Run the tests with coverage; fails below the floor in `vite.config.js` |

## Testing

- **Stack:** Vitest (the Vite test runner), jsdom, React Testing Library, `user-event`, and MSW (Mock Service Worker) to mock the API at the network level, so the real API client, cookies, CSRF header and refresh-and-retry run in tests.
- **Test files** sit next to the code: `src/lib/api.test.js`, `src/context/AuthContext.test.jsx`, ...
- **`src/test/utils.jsx`:** `renderWithProviders(ui, { route })` renders inside the application's provider tree (router, toasts, auth, clients, the same order as `main.jsx`); use it instead of assembling providers in each test. It also re-exports Testing Library.
- **`src/test/handlers.js`:** the default API answers (a signed-in advisor with no clients). Override per test with `server.use(http.get(`${API}/api/...`, () => HttpResponse.json(...)))`. A request with no handler fails the test, so nothing ever reaches a real network.
- **Coverage floor:** set just under what the tests cover today (most of the app is not yet tested). Raise the numbers in `vite.config.js` whenever coverage goes up; never lower them.
- **CI:** the `test` job in `.github/workflows/ci.yml` runs `npm run test:coverage`. Mark it as a required status check in the repository's branch protection settings.
