"use client";

import { ArrowDownToLine, CalendarDays, Check, Clock3, FilePlus2, Link as LinkIcon, Pencil, Plus, Save, Trash2, Users, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Role = "member" | "admin";
type CalendarEvent = {
  id: string;
  title: string;
  kind: "technique" | "event" | "meeting" | "other";
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  details: string | null;
  created_by_name: string;
};
type FileRequest = {
  id: string;
  kind: "pdf" | "link";
  title: string;
  filename: string | null;
  url: string | null;
  status: "pending" | "approved" | "rejected";
  submitted_by_name: string;
  created_at: string;
};
type Activity = {
  id: string;
  action: string;
  entity_title: string;
  actor_name: string;
  created_at: string;
};
type Member = {
  id: string;
  name: string;
  username: string;
  active: boolean;
  created_at: string;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? "Die Anfrage ist fehlgeschlagen.");
  }
  return response.json() as Promise<T>;
}

function localDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function localDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const kindNames: Record<CalendarEvent["kind"], string> = {
  technique: "Technik",
  event: "Event",
  meeting: "Treffen",
  other: "Sonstiges",
};
const activityNames: Record<string, string> = {
  calendar_created: "Termin eingetragen",
  calendar_updated: "Termin bearbeitet",
  file_approved: "Datei freigegeben",
  file_submitted: "Datei zur Prüfung eingereicht",
  file_rejected: "Datei abgelehnt",
  access_added: "Zugang erstellt",
  access_revoked: "Zugang entzogen",
  comment_added: "Kommentar hinzugefügt",
  comment_deleted: "Kommentar gelöscht",
  document_added: "Dokument hinzugefügt",
  document_updated: "Dokument aktualisiert",
  document_deleted: "Dokument gelöscht",
  status_updated: "Roadmap-Status geändert",
};

export function CalendarWorkspace({
  role,
  onChange,
  onError,
  onMessage,
}: {
  role: Role;
  onChange: () => void;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
}) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await requestJson<{ events: CalendarEvent[] }>("/api/v2/calendar");
      setEvents(data.events);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Der Kalender konnte nicht geladen werden.");
    }
  }, [onError]);

  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    onError("");
    try {
      await requestJson("/api/v2/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          kind: form.get("kind"),
          starts_at: new Date(String(form.get("starts_at"))).toISOString(),
          ends_at: form.get("ends_at") ? new Date(String(form.get("ends_at"))).toISOString() : null,
          location: form.get("location") || null,
          details: form.get("details") || null,
        }),
      });
      formElement.reset();
      onMessage("Der Termin wurde eingetragen.");
      await load();
      onChange();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Der Termin konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  async function updateEvent(event: FormEvent<HTMLFormElement>, eventId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    onError("");
    try {
      await requestJson(`/api/v2/calendar/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          kind: form.get("kind"),
          starts_at: new Date(String(form.get("starts_at"))).toISOString(),
          ends_at: form.get("ends_at") ? new Date(String(form.get("ends_at"))).toISOString() : null,
          location: form.get("location") || null,
          details: form.get("details") || null,
        }),
      });
      setEditingId(null);
      onMessage("Der Termin wurde aktualisiert.");
      await load();
      onChange();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Der Termin konnte nicht bearbeitet werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-5 pt-7 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
      <div className="rounded-[22px] border border-line bg-white p-5 sm:p-7">
        <div className="flex items-center justify-between">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted">Gemeinsame Planung</p><h2 className="mt-1 text-2xl font-semibold text-ink">Kalender</h2></div>
          <CalendarDays className="text-forest" />
        </div>
        <div className="mt-6 space-y-3">
          {events.length ? events.map((item) => (
            <article key={item.id} className="rounded-2xl border border-line bg-[#fcfbf9] p-4">
              {editingId === item.id ? (
                <form onSubmit={(event) => updateEvent(event, item.id)} className="space-y-3">
                  <label className="block text-sm font-medium">Titel<input name="title" required maxLength={120} defaultValue={item.title} className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2.5" /></label>
                  <label className="block text-sm font-medium">Kategorie<select name="kind" defaultValue={item.kind} className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2.5"><option value="technique">Technik-Verfügbarkeit</option><option value="event">Event</option><option value="meeting">Treffen</option><option value="other">Sonstiges</option></select></label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-medium">Beginn<input name="starts_at" type="datetime-local" required defaultValue={localDateTimeInput(item.starts_at)} className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2.5" /></label>
                    <label className="block text-sm font-medium">Ende (optional)<input name="ends_at" type="datetime-local" defaultValue={localDateTimeInput(item.ends_at)} className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2.5" /></label>
                  </div>
                  <label className="block text-sm font-medium">Ort oder Technik<input name="location" maxLength={160} defaultValue={item.location ?? ""} className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2.5" /></label>
                  <label className="block text-sm font-medium">Details<textarea name="details" maxLength={1000} rows={3} defaultValue={item.details ?? ""} className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2.5" /></label>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setEditingId(null)} disabled={busy} className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted disabled:opacity-50">Abbrechen</button>
                    <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-forest px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={15} /> Speichern</button>
                  </div>
                </form>
              ) : (
                <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-ink">{item.title}</h3>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#efe2d3] px-3 py-1 text-xs font-semibold text-forest">{kindNames[item.kind]}</span>
                  {role === "admin" && <button type="button" onClick={() => setEditingId(item.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-[#f7f5f1]"><Pencil size={13} /> Bearbeiten</button>}
                </div>
              </div>
              <p className="mt-2 text-sm text-muted">{localDate(item.starts_at)}{item.ends_at ? ` – ${localDate(item.ends_at)}` : ""}</p>
              {item.location && <p className="mt-1 text-sm text-muted">{item.location}</p>}
              {item.details && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink/80">{item.details}</p>}
              <p className="mt-3 text-xs text-muted">Eingetragen von {item.created_by_name}</p>
                </>
              )}
            </article>
          )) : <EmptyState>Es gibt noch keine Termine. Trage den ersten ein.</EmptyState>}
        </div>
      </div>
      <form onSubmit={submit} className="h-fit rounded-[22px] border border-line bg-white p-5 sm:p-7">
        <h2 className="text-xl font-semibold text-ink">Termin eintragen</h2>
        <p className="mt-1 text-sm text-muted">Alle angemeldeten Teammitglieder können Termine ergänzen.</p>
        <label className="mt-5 block text-sm font-medium">Titel<input name="title" required maxLength={120} className="mt-2 w-full rounded-xl border border-line px-3 py-2.5" /></label>
        <label className="mt-4 block text-sm font-medium">Kategorie<select name="kind" className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2.5"><option value="technique">Technik-Verfügbarkeit</option><option value="event">Event</option><option value="meeting">Treffen</option><option value="other">Sonstiges</option></select></label>
        <label className="mt-4 block text-sm font-medium">Beginn<input name="starts_at" type="datetime-local" required className="mt-2 w-full rounded-xl border border-line px-3 py-2.5" /></label>
        <label className="mt-4 block text-sm font-medium">Ende (optional)<input name="ends_at" type="datetime-local" className="mt-2 w-full rounded-xl border border-line px-3 py-2.5" /></label>
        <label className="mt-4 block text-sm font-medium">Ort oder Technik<input name="location" maxLength={160} placeholder="z. B. Proberaum, Mischpult" className="mt-2 w-full rounded-xl border border-line px-3 py-2.5" /></label>
        <label className="mt-4 block text-sm font-medium">Details<textarea name="details" maxLength={1000} rows={3} className="mt-2 w-full rounded-xl border border-line px-3 py-2.5" /></label>
        <button disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3 font-semibold text-white disabled:opacity-50"><Plus size={17} /> Termin speichern</button>
      </form>
    </section>
  );
}

export function FileRequestPanel({
  role,
  onChange,
  onError,
  onMessage,
}: {
  role: Role;
  onChange: () => void;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
}) {
  const [files, setFiles] = useState<FileRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const data = await requestJson<{ files: FileRequest[] }>("/api/v2/files");
      setFiles(data.files);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Dateianfragen konnten nicht geladen werden.");
    }
  }, [onError]);
  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) {
      onError("Bitte wähle eine PDF-Datei aus.");
      return;
    }
    setBusy(true);
    onError("");
    let storagePath = "";
    try {
      const signed = await requestJson<{ storage_path: string; signedUrl: string; filename: string }>("/api/v2/files/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, size: file.size }),
      });
      storagePath = signed.storage_path;
      const uploaded = await fetch(signed.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });
      if (!uploaded.ok) throw new Error("Der Upload in den privaten Speicher ist fehlgeschlagen.");
      await requestJson("/api/v2/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "pdf", title: form.get("title"), filename: signed.filename, storage_path: storagePath }),
      });
      formElement.reset();
      onMessage("Die PDF wurde privat eingereicht und wartet auf die Freigabe.");
      await load();
      onChange();
    } catch (cause) {
      if (storagePath) {
        try {
          await requestJson("/api/v2/files/upload", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ storage_path: storagePath }),
          });
        } catch (cleanupError) {
          console.error("Could not clean up an unregistered team upload.", cleanupError);
        }
      }
      onError(cause instanceof Error ? cause.message : "Die Datei konnte nicht eingereicht werden.");
    } finally {
      setBusy(false);
    }
  }

  async function submitLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    onError("");
    try {
      await requestJson("/api/v2/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "link",
          title: form.get("title"),
          url: form.get("url"),
        }),
      });
      formElement.reset();
      onMessage("Der Link wurde eingereicht und wartet auf die Freigabe.");
      await load();
      onChange();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Der Link konnte nicht eingereicht werden.");
    } finally {
      setBusy(false);
    }
  }

  async function reviewFile(id: string, kind: FileRequest["kind"], status: "approved" | "rejected") {
    setBusy(true);
    onError("");
    try {
      await requestJson(`/api/v2/files/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const itemName = kind === "link" ? "Der Link" : "Die Datei";
      onMessage(`${itemName} wurde ${status === "approved" ? "freigegeben" : "abgelehnt"}.`);
      await load();
      onChange();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Die Entscheidung konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  const statusText = (status: FileRequest["status"]) => status === "approved" ? "Freigegeben" : status === "rejected" ? "Abgelehnt" : "Wartet auf Prüfung";
  const statusStyle = (status: FileRequest["status"]) => status === "approved" ? "bg-[#e8f4eb] text-[#2c6948]" : status === "rejected" ? "bg-[#fff0ed] text-[#9b493e]" : "bg-[#fff4dc] text-[#8b681e]";

  return (
    <section className="mt-8 border-t border-line pt-7">
      <div className="flex items-center gap-3"><FilePlus2 className="text-forest" /><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted">Prüfung und Freigabe</p><h2 className="text-xl font-semibold text-ink">Datei- und Linkanfragen</h2></div></div>
      <p className="mt-2 text-sm leading-6 text-muted">Eingereichte PDFs und Links warten auf die Freigabe durch einen Administrator. PDFs dürfen bis zu 25 MB groß sein; Links müssen HTTPS verwenden.</p>
      {role === "member" && <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-line bg-[#fcfbf9] p-4 md:grid-cols-[1fr_1.2fr_auto] md:items-end">
          <label className="text-xs font-semibold text-ink">PDF-Titel<input name="title" required maxLength={120} className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm" /></label>
          <label className="text-xs font-semibold text-ink">PDF-Datei<input name="file" type="file" accept="application/pdf,.pdf" required className="mt-2 block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-[#efe2d3] file:px-3 file:py-2 file:font-semibold file:text-forest" /></label>
          <button disabled={busy} className="rounded-xl bg-forest px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">PDF einreichen</button>
        </form>
        <form onSubmit={submitLink} className="grid gap-3 rounded-2xl border border-line bg-[#fcfbf9] p-4 md:grid-cols-[1fr_1.2fr_auto] md:items-end">
          <label className="text-xs font-semibold text-ink">Link-Titel<input name="title" required maxLength={120} className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm" /></label>
          <label className="text-xs font-semibold text-ink">HTTPS-Adresse<input name="url" type="url" required pattern="https://.*" maxLength={2048} placeholder="https://…" className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm" /></label>
          <button disabled={busy} className="rounded-xl bg-forest px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Link anfragen</button>
        </form>
      </div>}
      <div className="mt-4 space-y-3">
        {files.length ? files.map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4">
          <div className="min-w-0">
            <h3 className="font-semibold text-ink">{item.title}</h3>
            {item.kind === "pdf"
              ? <p className="mt-1 truncate text-sm text-muted">{item.filename} · {item.submitted_by_name}</p>
              : <p className="mt-1 truncate text-sm text-muted">{item.url} · {item.submitted_by_name}</p>}
            <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(item.status)}`}>{statusText(item.status)}</span>
          </div>
          {item.kind === "pdf" && (item.status === "approved" || role === "admin") && <a href={`/api/v2/files/${item.id}/download`} className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-forest"><ArrowDownToLine size={15} /> PDF öffnen</a>}
          {item.kind === "link" && (item.status === "approved" || role === "admin") && item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-forest"><LinkIcon size={15} /> Link öffnen</a>}
          {role === "admin" && item.status === "pending" && <div className="flex gap-2"><button disabled={busy} onClick={() => reviewFile(item.id, item.kind, "approved")} className="rounded-lg bg-[#e8f4eb] p-2 text-[#2c6948]" aria-label={item.kind === "link" ? "Link freigeben" : "Datei freigeben"}><Check size={18} /></button><button disabled={busy} onClick={() => reviewFile(item.id, item.kind, "rejected")} className="rounded-lg bg-[#fff0ed] p-2 text-[#9b493e]" aria-label={item.kind === "link" ? "Link ablehnen" : "Datei ablehnen"}><X size={18} /></button></div>}
        </article>) : <EmptyState>Keine Datei- oder Linkanfragen vorhanden.</EmptyState>}
      </div>
    </section>
  );
}

export function AccessManagement({
  onChange,
  onError,
  onMessage,
}: {
  onChange: () => void;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
}) {
  const [users, setUsers] = useState<Member[]>([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const data = await requestJson<{ users: Member[] }>("/api/v2/users");
      setUsers(data.users);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Zugänge konnten nicht geladen werden.");
    }
  }, [onError]);
  useEffect(() => { void load(); }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    onError("");
    try {
      await requestJson("/api/v2/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.get("name"), username: form.get("username"), password: form.get("password") }),
      });
      formElement.reset();
      onMessage("Der Zugang wurde erstellt. Teile das Startpasswort bitte sicher mit.");
      await load();
      onChange();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Der Zugang konnte nicht erstellt werden.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(member: Member) {
    if (!window.confirm(`Zugang von ${member.name} sofort entziehen? Bisherige Einträge bleiben bestehen.`)) return;
    setBusy(true);
    onError("");
    try {
      await requestJson(`/api/v2/users/${member.id}`, { method: "DELETE" });
      onMessage(`Der Zugang von ${member.name} wurde entzogen.`);
      await load();
      onChange();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Der Zugang konnte nicht entzogen werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-5 pt-7 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
      <form onSubmit={create} className="h-fit rounded-[22px] border border-line bg-white p-5 sm:p-7">
        <h2 className="text-xl font-semibold text-ink">Neuen Zugang erstellen</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Das Startpasswort wird gehasht gespeichert. Teile es über einen sicheren Kanal.</p>
        <label className="mt-5 block text-sm font-medium">Name<input name="name" required maxLength={80} className="mt-2 w-full rounded-xl border border-line px-3 py-2.5" /></label>
        <label className="mt-4 block text-sm font-medium">Benutzername<input name="username" required minLength={3} maxLength={32} pattern="[A-Za-z0-9._-]+" className="mt-2 w-full rounded-xl border border-line px-3 py-2.5" /></label>
        <label className="mt-4 block text-sm font-medium">Startpasswort<input name="password" type="password" required minLength={12} maxLength={256} autoComplete="new-password" className="mt-2 w-full rounded-xl border border-line px-3 py-2.5" /><span className="mt-1 block text-xs text-muted">Mindestens 12 Zeichen</span></label>
        <button disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3 font-semibold text-white disabled:opacity-50"><Plus size={17} /> Zugang hinzufügen</button>
      </form>
      <div className="rounded-[22px] border border-line bg-white p-5 sm:p-7">
        <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted">Zugriffsverwaltung</p><h2 className="mt-1 text-2xl font-semibold text-ink">Mitwirkende</h2></div><Users className="text-forest" /></div>
        <div className="mt-5 space-y-3">
          {users.length ? users.map((member) => <article key={member.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-[#fcfbf9] p-4">
            <div><p className="font-semibold text-ink">{member.name}</p><p className="mt-1 text-sm text-muted">@{member.username} · seit {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(member.created_at))}</p><span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${member.active ? "bg-[#e8f4eb] text-[#2c6948]" : "bg-[#f1f3f0] text-muted"}`}>{member.active ? "Aktiv" : "Zugang entzogen"}</span></div>
            {member.active && <button disabled={busy} onClick={() => revoke(member)} className="inline-flex items-center gap-2 rounded-lg border border-[#f1d8d4] px-3 py-2 text-sm font-semibold text-[#9b493e] disabled:opacity-50"><Trash2 size={15} /> Entziehen</button>}
          </article>) : <EmptyState>Es wurden noch keine Zugänge angelegt.</EmptyState>}
        </div>
      </div>
    </section>
  );
}

export function ActivityFeed({
  role,
  refreshKey,
  onError,
}: {
  role: Role;
  refreshKey: number;
  onError: (message: string) => void;
}) {
  const [activity, setActivity] = useState<Activity[]>([]);
  useEffect(() => {
    let active = true;
    requestJson<{ activity: Activity[] }>("/api/v2/activity")
      .then(({ activity: items }) => { if (active) setActivity(items); })
      .catch((cause: unknown) => onError(cause instanceof Error ? cause.message : "Letzte Änderungen konnten nicht geladen werden."));
    return () => { active = false; };
  }, [refreshKey, role, onError]);

  return (
    <section className="mt-8 rounded-[22px] border border-line bg-white p-5 sm:p-7">
      <div className="flex items-center gap-3"><Clock3 className="text-forest" /><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted">Transparent fürs Team</p><h2 className="text-xl font-semibold text-ink">Letzte Änderungen</h2></div></div>
      <div className="mt-5 divide-y divide-line">
        {activity.length ? activity.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"><p className="text-sm text-ink"><span className="font-semibold">{activityNames[item.action] ?? "Aktualisierung"}</span>: {item.entity_title}<span className="text-muted"> · {item.actor_name}</span></p><time className="text-xs text-muted">{localDate(item.created_at)}</time></div>) : <p className="text-sm text-muted">Noch keine Änderungen.</p>}
      </div>
    </section>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{children}</p>;
}
