import { CalendarClock, Link2, RefreshCcw, AlertTriangle, Clock, User, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useGoogleCalendar } from "../context/GoogleCalendarContext";
import { useClients } from "../context/ClientsContext";
import { useToast } from "../context/ToastContext";
import { isAllDay, eventStart } from "../services/googleCalendarApi";
import { matchClientForEvent, guessClientNameFromEvent } from "../services/meetingClients";

/**
 * Today's Google Calendar meetings on My Day. Renders from the offline cache,
 * so meetings show even on a stale/expired session — with a slim reconnect bar
 * rather than hiding everything. Each meeting is matched to a client (link) or
 * offers a one-click "Add as client" when no match exists.
 */
export default function GoogleMeetingsSection() {
  const { isConfigured, status, connect, todaysEvents, cachedAt, eventsLoading, eventsError, refreshEvents } =
    useGoogleCalendar();
  const { clients, addClient, isTaskDoneToday, toggleDailyTask } = useClients();
  const { addToast } = useToast();
  const navigate = useNavigate();

  if (!isConfigured) return null;

  const connected = status === "connected";
  const hasMeetings = todaysEvents.length > 0;

  // Nothing cached and not connected → the plain connect prompt.
  if (!connected && !hasMeetings) {
    return (
      <div>
        <SectionHeader count={null} />
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-4">
          <div className="flex items-start gap-2">
            {status === "expired" && <AlertTriangle size={15} className="mt-0.5 shrink-0 text-av-red" />}
            <p className="text-sm text-slate-500">
              {status === "expired"
                ? "Your Google session expired — reconnect to see today's meetings."
                : "Connect Google Calendar to see today's meetings here."}
            </p>
          </div>
          <ConnectButton status={status} onConnect={connect} onToast={addToast} />
        </div>
      </div>
    );
  }

  const handleAddClient = (event) => {
    const guess = guessClientNameFromEvent(event);
    if (!guess?.first) {
      addToast("Couldn't read a client name from this event.");
      return;
    }
    const created = addClient({ first: guess.first, last: guess.last, priority: "Medium" });
    addToast(`${created.first} ${created.last} added to pipeline`);
    navigate(`/clients/${created.id}`);
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy/5 text-navy">
          <CalendarClock size={16} />
        </div>
        <h2 className="text-sm font-semibold text-navy">Google Calendar</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
          {todaysEvents.length}
        </span>
        {connected && (
          <button
            onClick={() => refreshEvents().catch(() => {})}
            disabled={eventsLoading}
            className="ml-auto flex items-center gap-1 text-xs font-medium text-slate-400 transition hover:text-navy"
          >
            <RefreshCcw size={11} className={eventsLoading ? "animate-spin" : ""} />
            Refresh
          </button>
        )}
      </div>

      {!connected && (
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-av-amber/10 px-3 py-2 text-xs text-av-amber">
          <span className="flex items-center gap-1.5">
            <AlertTriangle size={13} />
            Showing your last sync{cachedAt ? ` from ${formatCachedAt(cachedAt)}` : ""}. Reconnect to refresh.
          </span>
          <ConnectButton status={status} onConnect={connect} onToast={addToast} compact />
        </div>
      )}

      {eventsError && connected && <p className="mb-2 text-xs text-av-red">{eventsError.message}</p>}

      {hasMeetings ? (
        <div className="flex flex-col gap-2.5">
          {todaysEvents.map((event) => {
            const client = matchClientForEvent(event, clients);
            const done = isTaskDoneToday(event.id, "gcal");
            return (
              <div
                key={event.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <button
                  onClick={() => toggleDailyTask(event.id, "gcal")}
                  aria-label={done ? "Mark as not done" : "Mark as done"}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                    done ? "border-gold bg-gold" : "border-slate-300 hover:border-gold"
                  }`}
                >
                  {done && <span className="h-2 w-2 rounded-full bg-white" />}
                </button>
                <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-gold/10 text-[10px] font-bold leading-tight text-gold-dark">
                  {isAllDay(event) ? (
                    "ALL DAY"
                  ) : (
                    <>
                      <span>{formatHour(event)}</span>
                      <span className="font-semibold">{formatMeridiem(event)}</span>
                    </>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold ${done ? "text-slate-400 line-through" : "text-navy"}`}>
                    {event.summary || "(No title)"}
                  </p>
                  <p className="flex items-center gap-1 truncate text-xs text-slate-400">
                    <Clock size={11} />
                    {formatRange(event)}
                  </p>
                </div>
                {client ? (
                  <button
                    onClick={() => navigate(`/clients/${client.id}`)}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-navy transition hover:bg-slate-50"
                  >
                    <User size={13} />
                    {client.first}
                  </button>
                ) : (
                  <button
                    onClick={() => handleAddClient(event)}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-2.5 py-1.5 text-xs font-semibold text-gold-dark transition hover:bg-gold/20"
                  >
                    <UserPlus size={13} />
                    Add as client
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : eventsLoading ? (
        <p className="text-sm text-slate-400">Loading your calendar...</p>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">
          No Google Calendar events today.
        </div>
      )}
    </div>
  );
}

function SectionHeader() {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy/5 text-navy">
        <CalendarClock size={16} />
      </div>
      <h2 className="text-sm font-semibold text-navy">Google Calendar</h2>
    </div>
  );
}

function ConnectButton({ status, onConnect, onToast, compact }) {
  const handle = async () => {
    try {
      await onConnect();
      onToast("Google Calendar connected");
    } catch (err) {
      onToast(err.message || "Could not connect to Google Calendar");
    }
  };
  const label = status === "connecting" ? "Connecting..." : status === "expired" ? "Reconnect" : "Connect";
  return (
    <button
      onClick={handle}
      disabled={status === "connecting"}
      className={`flex shrink-0 items-center gap-1.5 rounded-lg font-semibold transition disabled:opacity-60 ${
        compact
          ? "bg-av-amber/20 px-2.5 py-1 text-xs text-av-amber hover:bg-av-amber/30"
          : "bg-navy px-3 py-1.5 text-xs text-white hover:bg-navy-light"
      }`}
    >
      {!compact && <Link2 size={13} />}
      {label}
    </button>
  );
}

function formatCachedAt(ts) {
  return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatHour(event) {
  const d = eventStart(event);
  if (!d) return "";
  const h = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  const m = d.getMinutes();
  return m === 0 ? String(h) : `${h}:${String(m).padStart(2, "0")}`;
}

function formatMeridiem(event) {
  const d = eventStart(event);
  if (!d) return "";
  return d.getHours() >= 12 ? "PM" : "AM";
}

function formatRange(event) {
  if (isAllDay(event)) return "All day";
  const start = eventStart(event);
  const endRaw = event.end?.dateTime;
  if (!start) return "";
  const opts = { hour: "numeric", minute: "2-digit" };
  const startText = start.toLocaleTimeString("en-US", opts);
  if (!endRaw) return startText;
  return `${startText} – ${new Date(endRaw).toLocaleTimeString("en-US", opts)}`;
}
