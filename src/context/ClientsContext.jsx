import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { calcNextFollowUp, todayISO, addDays, toISODate } from "../lib/followUp";
import { getNextStageId, PIPELINE_STAGES, FIRST_STAGE_ID } from "../lib/pipeline";
import { api } from "../lib/api";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";

const AV_COLORS = ["av-blue", "av-green", "av-amber", "av-red", "av-purple", "av-teal"];
const SYNC_DEBOUNCE_MS = 600;

const ClientsContext = createContext(null);

function normalize(clients) {
  return clients.map((c) => ({
    ...c,
    nextFollowUp: c.followUpDate ? calcNextFollowUp(c.followUpDate) : c.nextFollowUp ?? "TBD",
    telegram: c.telegram ?? "",
    referredBy: c.referredBy ?? "",
    preferredContact: c.preferredContact ?? "phone",
    meeting: c.meeting ?? null,
    files: c.files ?? [],
    notes: c.notes ?? [],
  }));
}

// Per-user offline cache so a reload paints instantly before the API responds.
function cacheKeys(email) {
  const suffix = email || "anon";
  return {
    clients: `advisorpilot.clients.${suffix}`,
    done: `advisorpilot.dailyTasks.${suffix}`,
    groups: `advisorpilot.groups.${suffix}`,
  };
}
function readCache(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return fallback;
}
function writeCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

export function ClientsProvider({ children }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [clients, setClients] = useState([]);
  const [doneTasks, setDoneTasks] = useState({});
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncError, setSyncError] = useState(null);

  const hydratedRef = useRef(false); // becomes true after the initial load settles
  const clientTimer = useRef(null);
  const stateTimer = useRef(null);
  const groupsTimer = useRef(null);
  const keys = cacheKeys(user?.email);

  // ---- load on login / clear on logout -------------------------------
  useEffect(() => {
    hydratedRef.current = false;
    if (clientTimer.current) clearTimeout(clientTimer.current);
    if (stateTimer.current) clearTimeout(stateTimer.current);
    if (groupsTimer.current) clearTimeout(groupsTimer.current);

    if (!user) {
      setClients([]);
      setDoneTasks({});
      setGroups([]);
      setLoading(false);
      return;
    }

    // Instant paint from cache, then reconcile with the server.
    setClients(normalize(readCache(keys.clients, [])));
    setDoneTasks(readCache(keys.done, {}));
    setGroups(readCache(keys.groups, []));
    setLoading(true);
    let cancelled = false;

    (async () => {
      try {
        const [serverClients, serverState] = await Promise.all([api.getClients(), api.getState()]);
        if (cancelled) return;
        const normalized = normalize(serverClients);
        setClients(normalized);
        setDoneTasks(serverState?.doneTasks || {});
        setGroups(serverState?.groups || []);
        writeCache(keys.clients, normalized);
        writeCache(keys.done, serverState?.doneTasks || {});
        writeCache(keys.groups, serverState?.groups || []);
        setSyncError(null);
      } catch (err) {
        if (!cancelled) setSyncError(err);
      } finally {
        if (!cancelled) {
          setLoading(false);
          // Flip AFTER effects from the setState above have run, so the sync
          // effects below don't echo the just-loaded data back to the server.
          setTimeout(() => {
            hydratedRef.current = true;
          }, 0);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  // ---- debounced sync: clients ---------------------------------------
  useEffect(() => {
    if (!user || !hydratedRef.current) return;
    writeCache(keys.clients, clients);
    if (clientTimer.current) clearTimeout(clientTimer.current);
    clientTimer.current = setTimeout(() => {
      api
        .putClients(clients)
        .then(() => setSyncError(null))
        .catch((err) => {
          setSyncError(err);
          addToast(err.message || "Couldn't save changes to the server");
        });
    }, SYNC_DEBOUNCE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients]);

  // ---- debounced sync: daily tasks -----------------------------------
  useEffect(() => {
    if (!user || !hydratedRef.current) return;
    writeCache(keys.done, doneTasks);
    if (stateTimer.current) clearTimeout(stateTimer.current);
    stateTimer.current = setTimeout(() => {
      api.putState(doneTasks).catch((err) => setSyncError(err));
    }, SYNC_DEBOUNCE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneTasks]);

  // ---- debounced sync: client groups ----------------------------------
  useEffect(() => {
    if (!user || !hydratedRef.current) return;
    writeCache(keys.groups, groups);
    if (groupsTimer.current) clearTimeout(groupsTimer.current);
    groupsTimer.current = setTimeout(() => {
      api
        .putGroups(groups)
        .then(() => setSyncError(null))
        .catch((err) => {
          setSyncError(err);
          addToast(err.message || "Couldn't save group changes to the server");
        });
    }, SYNC_DEBOUNCE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  const nextColor = () => AV_COLORS[clients.length % AV_COLORS.length];

  const addClient = (form) => {
    const id = Date.now();
    const nextFollowUp = form.nextFollowUpDate ? calcNextFollowUp(form.nextFollowUpDate) : "TBD";

    const newClient = {
      id,
      first: form.first.trim(),
      last: form.last.trim(),
      phone: form.phone?.trim() ?? "",
      email: form.email?.trim() ?? "",
      telegram: form.telegram?.trim() ?? "",
      referredBy: form.referredBy?.trim() ?? "",
      preferredContact: form.preferredContact || "phone",
      job: form.job?.trim() ?? "",
      dateOfBirth: form.dateOfBirth || "",
      province: form.province || "",
      instagram: form.instagram?.trim() ?? "",
      priority: form.priority || "Medium",
      color: nextColor(),
      joined: todayISO(),
      followUpDate: form.nextFollowUpDate || "",
      nextFollowUp,
      lastContactDate: form.lastContactDate || "",
      lastContact: form.lastContactDate ? `Last contact — ${form.lastContactDate}` : "Not yet contacted",
      interests: [],
      currentStage: form.currentStage || FIRST_STAGE_ID,
      stages: { [form.currentStage || FIRST_STAGE_ID]: { status: "pending", data: {}, files: [] } },
      meeting: null,
      files: [],
      notes: form.notes?.trim() ? [{ id: Date.now(), text: form.notes.trim(), date: todayISO() }] : [],
    };

    setClients((prev) => [newClient, ...prev]);
    return newClient;
  };

  const updateClient = (clientId, patch) => {
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, ...patch } : c)));
  };

  /**
   * Full edit from the client form — recomputes the derived follow-up/contact
   * fields the same way addClient does, so an edited client (whether created
   * manually or imported) stays internally consistent.
   */
  const editClient = (clientId, form) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;
        const followUpDate = form.nextFollowUpDate || "";
        const lastContactDate = form.lastContactDate || "";
        return {
          ...c,
          first: form.first.trim(),
          last: form.last.trim(),
          phone: form.phone?.trim() ?? "",
          email: form.email?.trim() ?? "",
          telegram: form.telegram?.trim() ?? "",
          referredBy: form.referredBy?.trim() ?? "",
          preferredContact: form.preferredContact || "phone",
          job: form.job?.trim() ?? "",
          dateOfBirth: form.dateOfBirth || "",
          province: form.province || "",
          instagram: form.instagram?.trim() ?? "",
          priority: form.priority || "Medium",
          followUpDate,
          nextFollowUp: followUpDate ? calcNextFollowUp(followUpDate) : "TBD",
          lastContactDate,
          lastContact: lastContactDate
            ? c.lastContactDate === lastContactDate
              ? c.lastContact
              : `Last contact — ${lastContactDate}`
            : "Not yet contacted",
        };
      })
    );
  };

  const deleteClient = (clientId) => {
    setClients((prev) => prev.filter((c) => c.id !== clientId));
  };

  const addNote = (clientId, text) => {
    if (!text?.trim()) return;
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId
          ? { ...c, notes: [{ id: Date.now(), text: text.trim(), date: todayISO() }, ...c.notes] }
          : c
      )
    );
  };

  const editNote = (clientId, noteId, text) => {
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId
          ? { ...c, notes: c.notes.map((n) => (n.id === noteId ? { ...n, text } : n)) }
          : c
      )
    );
  };

  const deleteNote = (clientId, noteId) => {
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, notes: c.notes.filter((n) => n.id !== noteId) } : c))
    );
  };

  /**
   * Edits a stage's meeting date/outcome and optionally logs a note.
   * Marking the client's *current* stage as completed/skipped auto-advances
   * currentStage to the next stage in the pipeline.
   */
  const updateStage = (clientId, stageId, { date, status, note }) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;

        const stages = { ...c.stages };
        const existing = stages[stageId] ?? { data: {}, files: [] };
        stages[stageId] = { ...existing, status, date: date || existing.date };

        let currentStage = c.currentStage;
        if (stageId === c.currentStage && (status === "completed" || status === "skipped")) {
          const next = getNextStageId(stageId);
          if (next) {
            currentStage = next;
            const nextExisting = stages[next] ?? { data: {}, files: [] };
            if (nextExisting.status === "upcoming" || !nextExisting.status) {
              stages[next] = { ...nextExisting, status: "pending" };
            }
          }
        }

        const notes = note?.trim()
          ? [{ id: Date.now(), text: note.trim(), date: todayISO(), stage: stageId }, ...c.notes]
          : c.notes;

        const lastContact = date
          ? `${status === "completed" ? "Met" : status === "skipped" ? "Skipped meeting" : "Scheduled"} — ${date}`
          : c.lastContact;

        return { ...c, stages, currentStage, notes, lastContact };
      })
    );
  };

  /**
   * Remembers which Google Calendar event (if any) represents this stage's
   * meeting, so it can be found again later and cancelled — pass `null` to
   * clear it once the event has been deleted.
   */
  const setStageGoogleEventId = (clientId, stageId, googleEventId) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;
        const stages = { ...c.stages };
        const existing = stages[stageId] ?? { data: {}, files: [] };
        stages[stageId] = { ...existing, googleEventId: googleEventId || undefined };
        return { ...c, stages };
      })
    );
  };

  const markContacted = (clientId) => {
    const today = todayISO();
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId
          ? {
              ...c,
              lastContactDate: today,
              lastContact: `Logged contact, today`,
              followUpDate: addDays(today, 7),
              nextFollowUp: calcNextFollowUp(addDays(today, 7)),
            }
          : c
      )
    );
  };

  const snooze = (clientId, days = 3) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;
        const newDate = addDays(c.followUpDate || todayISO(), days);
        return { ...c, followUpDate: newDate, nextFollowUp: calcNextFollowUp(newDate) };
      })
    );
  };

  const rescheduleFollowUp = (clientId, newDate) => {
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId ? { ...c, followUpDate: newDate, nextFollowUp: calcNextFollowUp(newDate) } : c
      )
    );
  };

  const rescheduleMeeting = (clientId, newDate, time) => {
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId ? { ...c, meeting: { ...(c.meeting || {}), date: newDate, time: time || c.meeting?.time } } : c
      )
    );
  };

  const toggleFileStatus = (clientId, fileId) => {
    setClients((prev) =>
      prev.map((c) =>
        c.id === clientId
          ? {
              ...c,
              files: c.files.map((f) =>
                f.id === fileId ? { ...f, status: f.status === "pending" ? "done" : "pending" } : f
              ),
            }
          : c
      )
    );
  };

  // Done-state is per (client, taskType, day) so My Day can track completion
  // for any selected date, not just today. `dateKey` defaults to today.
  const isTaskDoneToday = (clientId, taskType, dateKey = todayISO()) =>
    Boolean(doneTasks[`${clientId}:${taskType}:${dateKey}`]);

  const toggleDailyTask = (clientId, taskType, dateKey = todayISO()) => {
    const key = `${clientId}:${taskType}:${dateKey}`;
    setDoneTasks((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  };

  const importClients = (rows) => {
    const results = { successCount: 0, failedRows: [] };
    const created = [];

    rows.forEach((row, idx) => {
      const name = (row.name || row.Name || "").trim();
      if (!name) {
        results.failedRows.push({ row: idx + 1, error: "Missing Name" });
        return;
      }
      // Skip the template's sample row (labelled "SAMPLE … delete this row")
      // so it never becomes a real client. Not counted as a failure.
      if (/sample/i.test(name) && /delete/i.test(name)) return;

      const parts = name.split(/\s+/);
      const first = parts[0];
      const last = parts.slice(1).join(" ");

      // Dates: parse Excel Date objects / serials / strings into local ISO.
      const followUpDate = toISODate(row.nextFollowUp ?? row["Next Follow-up"]);
      const lastContactDate = toISODate(row.lastContact ?? row["Last Contact"]);

      const rawStage = (row.stage || row.Stage || "").trim().toLowerCase();
      const matchedStage =
        PIPELINE_STAGES.find((s) => s.label.toLowerCase() === rawStage || s.id === rawStage)?.id || FIRST_STAGE_ID;

      created.push({
        id: Date.now() + idx,
        first,
        last,
        phone: row.phone || row.Phone || "",
        email: row.email || row.Email || "",
        telegram: row.telegram || row.Telegram || "",
        referredBy: row.referredBy || row["Referred By"] || "",
        preferredContact: "phone",
        priority: "Medium",
        color: AV_COLORS[(clients.length + idx) % AV_COLORS.length],
        joined: todayISO(),
        followUpDate,
        nextFollowUp: followUpDate ? calcNextFollowUp(followUpDate) : "TBD",
        lastContactDate,
        lastContact: lastContactDate ? `Last contact — ${lastContactDate}` : "Not yet contacted",
        interests: [],
        currentStage: matchedStage,
        stages: { [matchedStage]: { status: "pending", data: {}, files: [] } },
        meeting: null,
        files: [],
        notes: [],
      });
      results.successCount += 1;
    });

    if (created.length) setClients((prev) => [...created, ...prev]);
    return results;
  };

  const getClient = (id) => clients.find((c) => String(c.id) === String(id));

  // ---- client groups (free-form: families, companies, referral circles, whatever) ----
  const GROUP_COLORS = ["av-blue", "av-green", "av-amber", "av-red", "av-purple", "av-teal"];

  const addGroup = (name, color) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const group = {
      id: `g-${Date.now()}`,
      name: trimmed,
      color: color || GROUP_COLORS[groups.length % GROUP_COLORS.length],
      memberIds: [],
    };
    setGroups((prev) => [...prev, group]);
    return group;
  };

  const updateGroup = (groupId, patch) => {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, ...patch } : g)));
  };

  const deleteGroup = (groupId) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  };

  const setGroupMembers = (groupId, memberIds) => {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, memberIds } : g)));
  };

  const toggleClientInGroup = (groupId, clientId) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const has = g.memberIds.some((id) => String(id) === String(clientId));
        return {
          ...g,
          memberIds: has
            ? g.memberIds.filter((id) => String(id) !== String(clientId))
            : [...g.memberIds, clientId],
        };
      })
    );
  };

  const getGroupsForClient = (clientId) =>
    groups.filter((g) => g.memberIds.some((id) => String(id) === String(clientId)));

  const value = useMemo(
    () => ({
      clients,
      loading,
      syncError,
      addClient,
      updateClient,
      editClient,
      deleteClient,
      addNote,
      editNote,
      deleteNote,
      updateStage,
      setStageGoogleEventId,
      markContacted,
      snooze,
      rescheduleFollowUp,
      rescheduleMeeting,
      toggleFileStatus,
      isTaskDoneToday,
      toggleDailyTask,
      importClients,
      getClient,
      groups,
      addGroup,
      updateGroup,
      deleteGroup,
      setGroupMembers,
      toggleClientInGroup,
      getGroupsForClient,
    }),
    [clients, doneTasks, groups, loading, syncError]
  );

  return <ClientsContext.Provider value={value}>{children}</ClientsContext.Provider>;
}

export function useClients() {
  const ctx = useContext(ClientsContext);
  if (!ctx) throw new Error("useClients must be used within ClientsProvider");
  return ctx;
}
