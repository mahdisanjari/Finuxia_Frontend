import { useMemo, useState } from "react";
import { CalendarDays, Flame, PhoneCall, CalendarClock, FileText } from "lucide-react";
import { useClients } from "../context/ClientsContext";
import { useGoogleCalendar } from "../context/GoogleCalendarContext";
import { todayLong, todayISO, formatDate } from "../lib/followUp";
import { formatTime } from "../lib/notifications";
import { useToast } from "../context/ToastContext";
import ClientCard from "../components/ClientCard";
import RescheduleModal from "../components/RescheduleModal";
import GoogleMeetingsSection from "../components/GoogleMeetingsSection";

export default function MyDay() {
  const { clients, isTaskDoneToday, toggleDailyTask, snooze, rescheduleFollowUp, rescheduleMeeting, toggleFileStatus } =
    useClients();
  const { todaysEvents } = useGoogleCalendar();
  const { addToast } = useToast();
  const [rescheduleTarget, setRescheduleTarget] = useState(null);

  const today = todayISO();

  const highPriority = useMemo(
    () =>
      clients.filter(
        (c) => c.priority === "High" && (c.nextFollowUp === "Overdue" || c.nextFollowUp === "Today")
      ),
    [clients]
  );

  const meetingsToday = useMemo(() => clients.filter((c) => c.meeting?.date === today), [clients, today]);
  const meetingClientIds = new Set(meetingsToday.map((c) => c.id));

  const calls = useMemo(
    () => clients.filter((c) => c.nextFollowUp === "Today" && !meetingClientIds.has(c.id)),
    [clients, today]
  );

  const pendingFiles = useMemo(() => {
    const items = [];
    clients.forEach((c) => {
      (c.files || [])
        .filter((f) => f.status === "pending")
        .forEach((f) => items.push({ client: c, file: f }));
    });
    return items;
  }, [clients]);

  const totalItems =
    highPriority.length + calls.length + meetingsToday.length + pendingFiles.length + todaysEvents.length;
  const doneCount =
    highPriority.filter((c) => isTaskDoneToday(c.id, "high")).length +
    calls.filter((c) => isTaskDoneToday(c.id, "call")).length +
    meetingsToday.filter((c) => isTaskDoneToday(c.id, "meeting")).length +
    pendingFiles.filter(({ file }) => file.status === "done").length +
    todaysEvents.filter((e) => isTaskDoneToday(e.id, "gcal")).length;
  const remainingCount = totalItems - doneCount;
  const overdueCount = clients.filter((c) => c.nextFollowUp === "Overdue" && !isTaskDoneToday(c.id, "high")).length;
  const progressPct = totalItems === 0 ? 0 : Math.round((doneCount / totalItems) * 100);

  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-2xl bg-navy px-6 py-7 text-white shadow-lg sm:px-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Your day, at a glance.</h1>
          <p className="flex items-center gap-1.5 text-sm text-slate-300">
            <CalendarDays size={15} />
            {todayLong()}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Remaining" value={remainingCount} accent="text-gold" />
          <Stat label="Done" value={doneCount} accent="text-av-green" />
          <Stat label="Overdue" value={overdueCount} accent="text-av-red" />
        </div>

        <div className="mt-6">
          <div className="mb-1.5 flex items-center justify-between text-xs text-slate-300">
            <span>Today's progress</span>
            <span className="font-semibold text-white">{progressPct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gold transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </section>

      {totalItems === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-400">
          Nothing urgent today. Enjoy the breathing room.
        </div>
      )}

      <Section icon={Flame} title="High Priority" count={highPriority.length}>
        {highPriority.map((client) => (
          <ClientCard
            key={client.id}
            client={client}
            done={isTaskDoneToday(client.id, "high")}
            onToggleDone={() => toggleDailyTask(client.id, "high")}
            onSnooze={(id) => {
              snooze(id, 3);
              addToast(`Follow-up snoozed 3 days for ${client.first} ${client.last}`);
            }}
            onReschedule={(c) => setRescheduleTarget({ type: "followup", client: c })}
          />
        ))}
      </Section>

      <Section icon={PhoneCall} title="Calls" count={calls.length}>
        {calls.map((client) => (
          <ClientCard
            key={client.id}
            client={client}
            done={isTaskDoneToday(client.id, "call")}
            onToggleDone={() => toggleDailyTask(client.id, "call")}
            onSnooze={(id) => {
              snooze(id, 3);
              addToast(`Follow-up snoozed 3 days for ${client.first} ${client.last}`);
            }}
            onReschedule={(c) => setRescheduleTarget({ type: "followup", client: c })}
          />
        ))}
      </Section>

      <Section icon={CalendarClock} title="Meetings" count={meetingsToday.length}>
        {meetingsToday.map((client) => (
          <ClientCard
            key={client.id}
            client={client}
            subtitle={`${client.meeting.label ?? "Meeting"} at ${formatTime(client.meeting.time || "09:00")}`}
            done={isTaskDoneToday(client.id, "meeting")}
            onToggleDone={() => toggleDailyTask(client.id, "meeting")}
            onReschedule={(c) => setRescheduleTarget({ type: "meeting", client: c })}
          />
        ))}
      </Section>

      <GoogleMeetingsSection />

      <Section icon={FileText} title="Pending Files" count={pendingFiles.length}>
        {pendingFiles.map(({ client, file }) => (
          <div
            key={file.id}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <button
              onClick={() => toggleFileStatus(client.id, file.id)}
              aria-label={file.status === "done" ? "Mark file pending" : "Mark file done"}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                file.status === "done" ? "border-gold bg-gold" : "border-slate-300 hover:border-gold"
              }`}
            >
              {file.status === "done" && <span className="h-2 w-2 rounded-full bg-white" />}
            </button>
            <div className="min-w-0 flex-1">
              <p
                className={`truncate text-sm font-semibold ${
                  file.status === "done" ? "text-slate-400 line-through" : "text-navy"
                }`}
              >
                {file.name}
              </p>
              <p className="truncate text-xs text-slate-400">
                {client.first} {client.last}
              </p>
            </div>
          </div>
        ))}
      </Section>

      {rescheduleTarget && (
        <RescheduleModal
          title={rescheduleTarget.type === "meeting" ? "Reschedule Meeting" : "Reschedule Follow-up"}
          currentDate={
            rescheduleTarget.type === "meeting"
              ? rescheduleTarget.client.meeting?.date
              : rescheduleTarget.client.followUpDate
          }
          onClose={() => setRescheduleTarget(null)}
          onSave={(newDate) => {
            const c = rescheduleTarget.client;
            if (rescheduleTarget.type === "meeting") {
              rescheduleMeeting(c.id, newDate, c.meeting?.time);
            } else {
              rescheduleFollowUp(c.id, newDate);
            }
            addToast(`Rescheduled to ${formatDate(newDate)} for ${c.first} ${c.last}`);
          }}
        />
      )}
    </div>
  );
}

function Section({ icon: Icon, title, count, children }) {
  if (count === 0) return null;
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy/5 text-navy">
          <Icon size={16} />
        </div>
        <h2 className="text-sm font-semibold text-navy">{title}</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{count}</span>
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-xl bg-white/5 px-4 py-3 text-center">
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-300">{label}</p>
    </div>
  );
}
