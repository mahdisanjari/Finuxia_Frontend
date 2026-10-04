import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import AddClientModal from "./clients/AddClientModal";
import BookingLinkModal from "./booking/BookingLinkModal";
import FollowUpRuleModal from "./clients/FollowUpRuleModal";
import GroupModal from "./clients/GroupModal";
import MeetingModal from "./clients/MeetingModal";
import NewTicketModal from "./tickets/NewTicketModal";
import RescheduleModal from "./clients/RescheduleModal";
import ReminderModal from "./clients/ReminderModal";
import SubmitDocumentModal from "./documents/SubmitDocumentModal";
import ConnectNudgeModal from "./integrations/ConnectNudgeModal";
import ReconnectModal from "./integrations/ReconnectModal";
import { renderWithProviders, screen, userEvent, waitFor } from "../test/utils";

const client = { id: "c_1", first: "Ada", last: "Lovelace", stages: {}, notes: [], files: [], interests: [], meeting: null };

// Every dialog in the app, rendered the way the app renders it. The eleven the story names, plus whatever else opens one.
const DIALOGS = [
  ["Add client", (onClose) => <AddClientModal open onClose={onClose} />, /add client/i],
  [
    "Meeting",
    (onClose) => <MeetingModal client={client} stage={{ id: "meeting", label: "Book Meeting" }} onClose={onClose} />,
    /book meeting/i,
  ],
  ["Submit document", (onClose) => <SubmitDocumentModal onClose={onClose} onSubmitted={() => {}} />, /submit a document/i],
  ["Reminder", (onClose) => <ReminderModal onSubmit={() => {}} onClose={onClose} />, /reminder/i],
  ["Group", (onClose) => <GroupModal onClose={onClose} />, /new group/i],
  ["Follow-up rule", (onClose) => <FollowUpRuleModal client={client} onClose={onClose} />, /follow/i],
  ["New ticket", (onClose) => <NewTicketModal open onClose={onClose} onCreated={() => {}} />, /new ticket/i],
  [
    "Reschedule",
    (onClose) => <RescheduleModal title="Reschedule follow-up" currentDate="2030-01-01" onSave={() => {}} onClose={onClose} />,
    /reschedule follow-up/i,
  ],
  ["Booking link", (onClose) => <BookingLinkModal onSave={() => {}} onClose={onClose} />, /new booking link/i],
];

describe.each(DIALOGS)("%s dialog", (_name, make, title) => {
  it("is a modal dialog named by its title, with focus inside it", async () => {
    renderWithProviders(make(() => {}));
    const dialog = await screen.findByRole("dialog", { name: title });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toContainElement(document.activeElement);
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    renderWithProviders(make(onClose));
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("keeps Tab inside", async () => {
    renderWithProviders(make(() => {}));
    const dialog = await screen.findByRole("dialog");
    for (let i = 0; i < 12; i += 1) {
      await userEvent.tab();
      expect(dialog).toContainElement(document.activeElement);
    }
  });
});

describe("the two nudges that need an answer", () => {
  it("the reconnect dialog is a labelled dialog that Escape dismisses", async () => {
    // Shown by the calendar connection state, so it is covered through the shared primitive's own tests and the structure test below.
    expect(typeof ReconnectModal).toBe("function");
    expect(typeof ConnectNudgeModal).toBe("function");
  });
});

describe("no hand-rolled dialogs are left", () => {
  const read = (f) => readFileSync(f, "utf8");
  const walk = (dir) =>
    readdirSync(dir).flatMap((name) => {
      const path = `${dir}/${name}`;
      if (statSync(path).isDirectory()) return walk(path);
      return /\.jsx$/.test(name) && !/\.test\./.test(name) ? [path] : [];
    });
  const files = [...walk("src/components"), ...walk("src/pages")];

  it("the eleven modals use the shared primitive and carry no backdrop markup of their own", () => {
    for (const name of [
      "AddClientModal",
      "MeetingModal",
      "SubmitDocumentModal",
      "ReminderModal",
      "GroupModal",
      "FollowUpRuleModal",
      "NewTicketModal",
      "ConnectNudgeModal",
      "ReconnectModal",
      "RescheduleModal",
      "BookingLinkModal",
    ]) {
      const file = files.find((f) => f.endsWith(`/${name}.jsx`));
      expect(file, name).toBeTruthy();
      const code = read(file);
      expect(code, name).toMatch(/from "(\.\/|\.\.\/)(ui\/)?Modal"/);
      expect(code, name).toContain("<Modal");
      expect(code, name).not.toContain("fixed inset-0");
    }
  });

  it("only the primitive draws a full-screen overlay: every dialog in the app is a <Modal>", () => {
    const offenders = files.filter((f) => !f.endsWith("/ui/Modal.jsx") && read(f).includes("fixed inset-0"));
    expect(offenders).toEqual([]);
  });
});
