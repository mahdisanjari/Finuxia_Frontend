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
- **`src/test/utils.jsx`:** `renderWithProviders(ui, { route })` renders inside the application's provider tree (router, toasts, auth, Google Calendar, clients, the same order as `main.jsx`); use it instead of assembling providers in each test. It also re-exports Testing Library.
- **`src/test/handlers.js`:** the default API answers (a signed-in advisor with no clients). Override per test with `server.use(http.get(`${API}/api/...`, () => HttpResponse.json(...)))`. A request with no handler fails the test, so nothing ever reaches a real network.
- **Coverage floor:** set just under what the tests cover today (most of the app is not yet tested). Raise the numbers in `vite.config.js` whenever coverage goes up; never lower them.
- **CI:** the `test` job in `.github/workflows/ci.yml` runs `npm run test:coverage`. Mark it as a required status check in the repository's branch protection settings.

## Bundle size and code splitting

Every page is loaded on demand (`React.lazy`), so a visitor downloads the shell and the page they open, not the whole app. The public pages (login, register, password reset, privacy, terms, support, the booking page, Zoom docs) never import the signed-in application (`src/AuthenticatedApp.jsx`: the layout, the route table and every page), and the Excel libraries load only when an import or export is actually used. Loading spinners reuse `PageSpinner`: full screen while the app or an out-of-layout page loads, inline inside the layout so the navigation stays put.

| First visit (gzip) | Before | After |
| --- | --- | --- |
| Entry JS + CSS (what every visitor downloads) | 166 kB (159.5 JS + 6.6 CSS) | 79 kB |
| Public booking page | 166 kB | 85 kB |
| Login page | 166 kB | 81 kB |
| Largest page chunk, loaded on demand (Sales Package Prep) | in the entry | 14 kB |
| Excel libraries (only on import / export) | on demand | on demand (unchanged, 464 kB) |

`npm run check:bundle` (run after `npm run build`, and in CI) fails if the first load statically imports the signed-in shell, a page of it or an Excel library, if a public page does, or if the first-load gzip size passes the budget in `scripts/check-bundle.mjs`. Raise the budget only on purpose, with the change that adds the weight. Chunks are same-origin files, so the Content Security Policy (`script-src 'self'`) is unaffected.

## Code layout and shared UI

- `src/components/` is grouped by domain: `layout/` (shell, navigation, guards, error boundaries), `clients/`, `booking/`, `billing/` (plan gate, upgrade prompt, AI usage), `integrations/` (Google Calendar / Drive, Zoom), `account/`, `tickets/`, `documents/`, and `ui/`.
- `src/components/ui/` is the shared UI: the primitives `Button`, `Input`, `Select`, `Field`, `Card`, `Badge` and `Table` (built on the brand colour tokens in `tailwind.config.js`), plus `Modal`, `Switch`, `SearchableSelect`, `TimeInput`, `PageSpinner` and `ErrorNotice`. Import them from `components/ui`. New screens should use them rather than writing the utility classes inline; existing screens move over as they are touched (the migration is incremental).
- `src/lib/statusMeta.js` is the one place status colours and labels live (booking requests, documents, tickets); each status is a label plus a tone, and a tone is a badge style.
- `src/hooks/useAsync.js` loads data for a page (`const { data, loading, error, reload, setData } = useAsync(() => api.getX(), [deps])`): the effect, loading flag, error and stale-answer guard in one place.
