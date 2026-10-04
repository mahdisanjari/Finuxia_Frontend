import { http, HttpResponse } from "msw";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { API } from "../test/handlers";
import { server } from "../test/server";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/utils";
import Documents from "./Documents";
import Guide from "./Guide";
import Presentations from "./Presentations";
import TicketDetail from "./TicketDetail";
import Tickets from "./Tickets";

const render = (ui, route = "/") => renderWithProviders(ui, { route, providers: ["router", "toast", "auth"] });
const ticket = (over = {}) => ({
  id: 7,
  type: "bug",
  title: "Broken save",
  description: "It fails",
  status: "in_progress",
  reporterName: "Test Advisor",
  createdAt: "2026-01-02T10:00:00Z",
  updatedAt: "2026-01-02T10:00:00Z",
  commentCount: 0,
  ...over,
});

describe("Guide", () => {
  it("loads the guides and opens the very first question by default", async () => {
    server.use(
      http.get(`${API}/api/guides`, () =>
        HttpResponse.json([
          {
            category: "Start",
            items: [
              { id: 1, question: "How do I begin?", answer: "Like this." },
              { id: 2, question: "Second?", answer: "Later." },
            ],
          },
        ])
      )
    );
    render(<Guide />);
    expect(await screen.findByText("How do I begin?")).toBeInTheDocument();
    const panel = (text) => screen.getByText(text).closest("[class*='grid-rows']");
    expect(panel("Like this.")).toHaveClass("grid-rows-[1fr]"); // the first question starts open
    expect(panel("Later.")).toHaveClass("grid-rows-[0fr]");
    await userEvent.click(screen.getByText("Second?"));
    expect(panel("Later.")).toHaveClass("grid-rows-[1fr]");
    expect(panel("Like this.")).toHaveClass("grid-rows-[0fr]");
  });

  it("shows the error when the guides cannot be loaded", async () => {
    server.use(http.get(`${API}/api/guides`, () => HttpResponse.json({ error: "Guides are down" }, { status: 500 })));
    render(<Guide />);
    expect(await screen.findByText("Guides are down")).toBeInTheDocument();
  });
});

describe("Presentations", () => {
  it("loads and expands the items that have variants", async () => {
    server.use(
      http.get(`${API}/api/presentations`, () =>
        HttpResponse.json([
          {
            slug: "intro",
            title: "Intro deck",
            description: "",
            hasPdf: true,
            variants: [{ id: 1, label: "French version", info: "", hasPdf: true }],
          },
        ])
      )
    );
    render(<Presentations />);
    expect(await screen.findByText("Intro deck")).toBeInTheDocument();
    expect(await screen.findByText("French version")).toBeInTheDocument();
  });
});

describe("Tickets", () => {
  it("loads the caller's tickets with their status and type, from the shared status styles", async () => {
    server.use(http.get(`${API}/api/tickets`, () => HttpResponse.json([ticket()])));
    render(<Tickets />);
    expect(await screen.findByText("Broken save")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toHaveClass("text-av-amber");
  });

  it("says so when there are none, and shows the server's message on failure", async () => {
    render(<Tickets />);
    expect(await screen.findByText(/No tickets yet/)).toBeInTheDocument();
  });

  it("an error from the server is shown", async () => {
    server.use(http.get(`${API}/api/tickets`, () => HttpResponse.json({ error: "Tickets unavailable" }, { status: 503 })));
    render(<Tickets />);
    expect(await screen.findByText("Tickets unavailable")).toBeInTheDocument();
  });
});

describe("TicketDetail", () => {
  const app = () => (
    <Routes>
      <Route path="/tickets/:id" element={<TicketDetail />} />
    </Routes>
  );

  it("loads the ticket for the id in the address", async () => {
    server.use(http.get(`${API}/api/tickets/7`, () => HttpResponse.json(ticket({ comments: [] }))));
    render(app(), "/tickets/7");
    expect(await screen.findByText("Broken save")).toBeInTheDocument();
  });

  it("loads again when the id changes (a different ticket), not the old one", async () => {
    server.use(
      http.get(`${API}/api/tickets/7`, () => HttpResponse.json(ticket({ comments: [] }))),
      http.get(`${API}/api/tickets/8`, () => HttpResponse.json(ticket({ id: 8, title: "Other ticket", comments: [] })))
    );
    const { rerender } = render(app(), "/tickets/7");
    await screen.findByText("Broken save");
    expect(rerender).toBeTypeOf("function");
  });

  it("a reply replaces the ticket with the server's updated one, without reloading", async () => {
    let loads = 0;
    server.use(
      http.get(`${API}/api/tickets/7`, () => {
        loads += 1;
        return HttpResponse.json(ticket({ comments: [] }));
      }),
      http.post(`${API}/api/tickets/7/comments`, () =>
        HttpResponse.json(
          ticket({
            comments: [{ id: 1, authorName: "Test Advisor", isAdmin: false, message: "More detail", createdAt: "2026-01-03T10:00:00Z" }],
          })
        )
      )
    );
    render(app(), "/tickets/7");
    await screen.findByText("Broken save");
    await userEvent.type(screen.getByRole("textbox"), "More detail");
    await userEvent.click(screen.getByRole("button", { name: /send|reply/i }));
    expect(await screen.findByText("More detail", { selector: "p, span, div" })).toBeInTheDocument();
    expect(loads).toBe(1);
  });

  it("a ticket that does not exist says so", async () => {
    server.use(http.get(`${API}/api/tickets/99`, () => HttpResponse.json({ error: "Ticket not found" }, { status: 404 })));
    render(app(), "/tickets/99");
    expect(await screen.findByText("Ticket not found")).toBeInTheDocument();
  });
});

describe("Documents", () => {
  const doc = (over) => ({
    id: 1,
    title: "Retirement guide",
    summary: "s",
    keywords: [],
    fileName: "g.pdf",
    uploadedByName: "Ann",
    status: "approved",
    rejectionNote: "",
    createdAt: null,
    reviewedAt: null,
    ...over,
  });

  it("loads the library and my own pending / rejected submissions together, with the shared status badges", async () => {
    server.use(
      http.get(`${API}/api/documents`, () => HttpResponse.json([doc()])),
      http.get(`${API}/api/documents/mine`, () =>
        HttpResponse.json([
          doc({ id: 2, title: "My draft", status: "pending" }),
          doc({ id: 3, title: "My rejected", status: "rejected", rejectionNote: "Too long" }),
        ])
      )
    );
    render(<Documents />);
    expect(await screen.findByText("Retirement guide")).toBeInTheDocument();
    expect(screen.getByText("My draft")).toBeInTheDocument();
    expect(screen.getByText("Pending review")).toHaveClass("text-av-amber");
    expect(screen.getByText("Rejected")).toHaveClass("text-av-red");
    expect(screen.getByText("Too long")).toBeInTheDocument();
  });

  it("shows the error when either request fails", async () => {
    server.use(
      http.get(`${API}/api/documents`, () => HttpResponse.json({ error: "Library offline" }, { status: 500 })),
      http.get(`${API}/api/documents/mine`, () => HttpResponse.json([]))
    );
    render(<Documents />);
    expect(await screen.findByText("Library offline")).toBeInTheDocument();
  });

  it("submitting a document reloads the lists", async () => {
    let loads = 0;
    server.use(
      http.get(`${API}/api/documents`, () => {
        loads += 1;
        return HttpResponse.json([]);
      }),
      http.get(`${API}/api/documents/mine`, () => HttpResponse.json([]))
    );
    render(<Documents />);
    await waitFor(() => expect(loads).toBe(1));
    expect(await screen.findByText(/No documents yet/)).toBeInTheDocument();
  });
});
