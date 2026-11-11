"use client";

import {
  Archive,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  Megaphone,
  Pencil,
  Plus,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Role = "member" | "admin";
type ChangeCategory = "feature" | "improvement" | "fix" | "other";
type ReleaseChange = {
  id?: string;
  release_id?: string;
  category: ChangeCategory;
  description: string;
  sort_order?: number;
};
type Release = {
  id: string;
  name: string;
  version_number: string | null;
  release_date: string;
  description: string;
  status: "draft" | "published" | "archived";
  published_at: string | null;
  created_at: string;
  changes: ReleaseChange[];
  is_read: boolean;
};
type ReleaseForm = {
  name: string;
  version_number: string;
  release_date: string;
  description: string;
  changes: ReleaseChange[];
};

const categoryLabels: Record<ChangeCategory, string> = {
  feature: "Neue Funktion",
  improvement: "Verbesserung",
  fix: "Fehlerbehebung",
  other: "Sonstiges",
};
function localDateValue() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
const emptyForm = (): ReleaseForm => ({
  name: "",
  version_number: "",
  release_date: localDateValue(),
  description: "",
  changes: [{ category: "feature", description: "" }],
});

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? "Die Anfrage ist fehlgeschlagen.");
  }
  return response.json() as Promise<T>;
}

function formattedDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function categoryIcon(category: ChangeCategory) {
  if (category === "feature") return Sparkles;
  if (category === "improvement") return ArrowUpRight;
  if (category === "fix") return Wrench;
  return ClipboardList;
}

export function VersionCenter({ role, active }: { role: Role; active: boolean }) {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);

  const loadReleases = useCallback(async () => {
    try {
      const data = await requestJson<{ releases: Release[] }>("/api/versions");
      setReleases(data.releases);
      setError("");
      setShowAnnouncement(data.releases.some((release) => release.published_at && !release.is_read));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Versionshinweise konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReleases();
    const events = new EventSource("/api/realtime");
    events.addEventListener("version", () => void loadReleases());
    const refresh = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadReleases();
    }, 60_000);
    const onFocus = () => void loadReleases();
    window.addEventListener("focus", onFocus);
    return () => {
      events.close();
      window.clearInterval(refresh);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadReleases]);

  async function dismissAnnouncement() {
    const unread = releases.filter((release) => release.published_at && !release.is_read);
    if (!unread.length) {
      setShowAnnouncement(false);
      return;
    }
    setMarkingRead(true);
    try {
      await requestJson("/api/versions/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ release_ids: unread.map((release) => release.id) }),
      });
      setShowAnnouncement(false);
      await loadReleases();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Der Lesestatus konnte nicht gespeichert werden.");
    } finally {
      setMarkingRead(false);
    }
  }

  return (
    <>
      {active && (role === "admin"
        ? <VersionManagement releases={releases} loading={loading} error={error} onError={setError} onRefresh={loadReleases} />
        : <VersionHistory releases={releases} loading={loading} error={error} />)}
      {showAnnouncement && (
        <div className="modal-backdrop fixed inset-0 z-[70] flex items-center justify-center bg-[#14221f]/55 p-3 backdrop-blur-[3px] sm:p-5" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="release-announcement-title"
            className="modal-panel flex max-h-[88vh] w-full max-w-[620px] flex-col overflow-hidden rounded-[24px] border border-line bg-white shadow-float">
            <header className="flex items-start justify-between border-b border-line px-5 py-4 sm:px-7">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#eff5ef] text-forest"><Megaphone size={18} /></span>
                <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-forest">Neu im Projektraum</p><h2 id="release-announcement-title" className="mt-1 text-lg font-semibold text-ink">Was ist neu?</h2></div>
              </div>
              <button type="button" onClick={() => void dismissAnnouncement()} disabled={markingRead} aria-label="Update-Mitteilung schließen"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-canvas text-muted hover:text-ink disabled:opacity-50"><X size={17} /></button>
            </header>
            {error && <p role="alert" className="mx-5 mt-3 rounded-xl bg-[#fff0ed] px-3 py-2 text-xs text-[#aa463c] sm:mx-7">{error}</p>}
            <div className="overflow-y-auto px-5 py-4 sm:px-7">
              {releases.filter((release) => release.published_at && !release.is_read).map((release) => (
                <ReleaseDetails key={release.id} release={release} />
              ))}
            </div>
            <footer className="flex justify-end border-t border-line px-5 py-4 sm:px-7">
              <button type="button" onClick={() => void dismissAnnouncement()} disabled={markingRead}
                className="flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
                {markingRead ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />} Alles klar
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

function VersionManagement({
  releases,
  loading,
  error,
  onError,
  onRefresh,
}: {
  releases: Release[];
  loading: boolean;
  error: string;
  onError: (message: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const [form, setForm] = useState<ReleaseForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function editRelease(release: Release) {
    setEditingId(release.id);
    setForm({
      name: release.name,
      version_number: release.version_number ?? "",
      release_date: release.release_date.slice(0, 10),
      description: release.description,
      changes: release.changes.map(({ category, description }) => ({ category, description })),
    });
    setMessage("");
    onError("");
    document.getElementById("version-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm());
    setMessage("");
    onError("");
  }

  async function saveRelease(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    onError("");
    try {
      const payload = {
        name: form.name,
        version_number: form.version_number || null,
        release_date: form.release_date,
        description: form.description,
        changes: form.changes,
      };
      if (editingId) {
        await requestJson(`/api/versions/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save", ...payload }),
        });
      } else {
        await requestJson("/api/versions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      await onRefresh();
      if (editingId) setMessage("Die Version wurde gespeichert.");
      else {
        resetForm();
        setMessage("Der Entwurf wurde angelegt. Veröffentliche ihn, wenn er sichtbar werden soll.");
      }
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Die Version konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(release: Release, action: "publish" | "archive") {
    if (action === "archive" && !window.confirm(`„${release.name}“ wirklich archivieren?`)) return;
    setBusy(true);
    setMessage("");
    onError("");
    try {
      await requestJson(`/api/versions/${release.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      setMessage(action === "publish" ? "Die Version ist jetzt veröffentlicht." : "Die Version wurde archiviert.");
      await onRefresh();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Der Versionsstatus konnte nicht geändert werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-6 pt-8 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
      <div>
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eff5ef] text-forest"><Megaphone size={20} /></span>
          <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted">Admin-Bereich</p><h2 className="text-2xl font-semibold tracking-tight text-ink">Versionsverwaltung</h2></div>
        </div>
        <form id="version-editor" onSubmit={saveRelease} className="scroll-mt-6 space-y-4 rounded-[22px] border border-line bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-ink">{editingId ? "Version bearbeiten" : "Neue Version"}</h3>
            {editingId && <button type="button" onClick={resetForm} className="text-xs font-medium text-muted hover:text-ink">Abbrechen</button>}
          </div>
          <label className="block text-xs font-semibold text-ink">Versionsname
            <input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="z. B. Winter Update 2026" className="mt-1.5 w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-ink">Versionsnummer (optional)
              <input maxLength={32} value={form.version_number} onChange={(event) => setForm({ ...form, version_number: event.target.value })} placeholder="z. B. 2.4" className="mt-1.5 w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm" />
            </label>
            <label className="block text-xs font-semibold text-ink">Veröffentlichungsdatum
              <input type="date" required value={form.release_date} onChange={(event) => setForm({ ...form, release_date: event.target.value })} className="mt-1.5 w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm" />
            </label>
          </div>
          <label className="block text-xs font-semibold text-ink">Kurze Beschreibung
            <textarea required maxLength={1000} rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Worum geht es in diesem Update?" className="mt-1.5 w-full resize-y rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm leading-5" />
          </label>
          <div>
            <div className="mb-2 flex items-center justify-between gap-3"><h4 className="text-xs font-semibold text-ink">Änderungen und Neuerungen</h4>
              <button type="button" onClick={() => setForm({ ...form, changes: [...form.changes, { category: "feature", description: "" }] })} disabled={form.changes.length >= 100}
                className="flex items-center gap-1 text-[11px] font-semibold text-forest disabled:opacity-40"><Plus size={13} /> Änderung</button>
            </div>
            <div className="space-y-2.5">
              {form.changes.map((change, index) => (
                <div key={index} className="flex flex-col gap-2 rounded-xl border border-line bg-canvas/60 p-3 sm:flex-row">
                  <select value={change.category} onChange={(event) => updateChange(index, { category: event.target.value as ChangeCategory })} aria-label={`Kategorie für Änderung ${index + 1}`} className="rounded-lg border border-line bg-white px-2.5 py-2 text-xs sm:w-40">
                    {Object.entries(categoryLabels).map(([category, label]) => <option key={category} value={category}>{label}</option>)}
                  </select>
                  <input required maxLength={500} value={change.description} onChange={(event) => updateChange(index, { description: event.target.value })} aria-label={`Beschreibung für Änderung ${index + 1}`} placeholder="Was hat sich geändert?" className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-xs" />
                  <button type="button" onClick={() => setForm({ ...form, changes: form.changes.filter((_, itemIndex) => itemIndex !== index) })} aria-label={`Änderung ${index + 1} entfernen`} className="self-end rounded-lg p-2 text-muted hover:bg-[#fff0ed] hover:text-[#aa463c] sm:self-auto"><X size={14} /></button>
                </div>
              ))}
              {!form.changes.length && <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-muted">Füge mindestens eine Änderung hinzu.</p>}
            </div>
          </div>
          {message && <p role="status" className="rounded-xl bg-[#f0f7f1] px-3 py-2 text-xs text-[#2c6948]">{message}</p>}
          {error && <p role="alert" className="rounded-xl bg-[#fff0ed] px-3 py-2 text-xs text-[#aa463c]">{error}</p>}
          <button type="submit" disabled={busy || !form.changes.length} className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
            {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}{editingId ? "Änderungen speichern" : "Entwurf speichern"}
          </button>
          {!editingId && <p className="text-center text-[11px] leading-4 text-muted">Neue Versionen bleiben privat, bis du sie ausdrücklich veröffentlichst.</p>}
        </form>
      </div>
      <div>
        <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted">Alle Versionen</p><h3 className="mt-1 text-xl font-semibold text-ink">Entwürfe & Historie</h3></div><span className="text-xs text-muted">{releases.length} gesamt</span></div>
        {loading && <div className="flex justify-center rounded-2xl border border-line bg-white py-10"><LoaderCircle size={20} className="animate-spin text-muted" /></div>}
        {!loading && !releases.length && <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-muted">Es gibt noch keine Versionshinweise.</p>}
        <div className="space-y-3">
          {releases.map((release) => (
            <article key={release.id} className="rounded-2xl border border-line bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${release.status === "published" ? "bg-[#eaf4ec] text-[#286344]" : release.status === "draft" ? "bg-[#faf1df] text-[#936318]" : "bg-canvas text-muted"}`}>{statusLabel(release.status)}</span>
                  <h4 className="mt-2 font-semibold text-ink">{release.name}{release.version_number ? <span className="ml-2 text-xs font-medium text-muted">v{release.version_number}</span> : null}</h4>
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted"><CalendarDays size={12} />{formattedDate(release.release_date)} · {release.changes.length} Änderungen</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => editRelease(release)} title="Version bearbeiten" className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted hover:bg-canvas hover:text-ink"><Pencil size={14} /></button>
                  {release.status === "draft" && <button type="button" disabled={busy} onClick={() => void updateStatus(release, "publish")} title="Veröffentlichen" className="grid h-8 w-8 place-items-center rounded-lg bg-forest text-white hover:opacity-90 disabled:opacity-50"><Megaphone size={14} /></button>}
                  {release.status === "published" && <button type="button" disabled={busy} onClick={() => void updateStatus(release, "archive")} title="Archivieren" className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted hover:bg-canvas hover:text-ink disabled:opacity-50"><Archive size={14} /></button>}
                  {release.is_read && <span title="Im gemeinsamen Admin-Konto bereits gelesen" className="grid h-8 w-8 place-items-center text-forest"><CheckCircle2 size={15} /></span>}
                </div>
              </div>
              <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted">{release.description}</p>
            </article>
          ))}
        </div>
        <div className="mt-7 border-t border-line pt-5">
          <h3 className="mb-3 text-sm font-semibold text-ink">Öffentliche Versionshistorie</h3>
          {releases.filter((release) => release.published_at).map((release) => <ReleaseCard key={`history-${release.id}`} release={release} />)}
          {!releases.some((release) => release.published_at) && <p className="text-xs text-muted">Veröffentlichte Versionen erscheinen hier.</p>}
        </div>
      </div>
    </section>

  );

  function updateChange(index: number, patch: Partial<ReleaseChange>) {
    setForm((current) => ({
      ...current,
      changes: current.changes.map((change, itemIndex) => itemIndex === index ? { ...change, ...patch } : change),
    }));
  }
}

function VersionHistory({ releases, loading, error }: { releases: Release[]; loading: boolean; error: string }) {
  const publicReleases = releases.filter((release) => release.published_at);
  return (
    <section className="mx-auto max-w-[850px] pt-8">
      <div className="mb-6 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eff5ef] text-forest"><ClipboardList size={20} /></span>
        <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted">Änderungen im Überblick</p><h2 className="text-2xl font-semibold tracking-tight text-ink">Versionshistorie</h2></div></div>
      {error && <p role="alert" className="mb-4 rounded-xl bg-[#fff0ed] px-4 py-3 text-sm text-[#aa463c]">{error}</p>}
      {loading && <div className="flex justify-center rounded-2xl border border-line bg-white py-12"><LoaderCircle size={20} className="animate-spin text-muted" /></div>}
      {!loading && !publicReleases.length && <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">Bisher wurden keine Versionshinweise veröffentlicht.</p>}
      <div className="space-y-4">{publicReleases.map((release) => <ReleaseCard key={release.id} release={release} />)}</div>
    </section>
  );
}

function ReleaseCard({ release }: { release: Release }) {
  return (
    <article className="mb-4 rounded-[22px] border border-line bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold tracking-tight text-ink">{release.name}</h3>
          {release.version_number && <span className="rounded-full bg-canvas px-2.5 py-1 text-[10px] font-semibold text-muted">v{release.version_number}</span>}
          {release.status === "archived" && <span className="rounded-full bg-canvas px-2.5 py-1 text-[10px] font-semibold text-muted">Archiviert</span>}</div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted"><CalendarDays size={13} />{formattedDate(release.release_date)}</p></div>
        {release.is_read && <span title="Bereits gelesen" className="flex items-center gap-1 rounded-full bg-[#eaf4ec] px-2.5 py-1 text-[10px] font-semibold text-[#286344]"><CheckCircle2 size={12} />Gelesen</span>}
      </div>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted">{release.description}</p>
      {!!release.changes.length && <ul className="mt-4 space-y-2">
        {release.changes.map((change, index) => {
          const Icon = categoryIcon(change.category);
          return <li key={change.id ?? index} className="flex items-start gap-3 rounded-xl border border-line/70 bg-canvas/60 p-3">
            <span className={`release-category release-category-${change.category}`}><Icon size={13} />{categoryLabels[change.category]}</span>
            <span className="min-w-0 flex-1 text-xs leading-5 text-ink">{change.description}</span>
          </li>;
        })}
      </ul>}
    </article>
  );
}

function ReleaseDetails({ release }: { release: Release }) {
  return (
    <article className="border-b border-line py-2 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-xl font-semibold tracking-tight text-ink">{release.name}</h3>
        {release.version_number && <span className="rounded-full bg-canvas px-2.5 py-1 text-[10px] font-semibold text-muted">v{release.version_number}</span>}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><CalendarDays size={13} />{formattedDate(release.release_date)}</p>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{release.description}</p>
      <ul className="mt-4 space-y-2">
        {release.changes.map((change, index) => {
          const Icon = categoryIcon(change.category);
          return <li key={change.id ?? index} className="flex items-start gap-3 rounded-xl border border-line/70 bg-canvas/60 p-3">
            <span className={`release-category release-category-${change.category}`}><Icon size={13} />{categoryLabels[change.category]}</span>
            <span className="min-w-0 flex-1 text-xs leading-5 text-ink">{change.description}</span>
          </li>;
        })}
      </ul>
    </article>
  );
}

function statusLabel(status: Release["status"]) {
  if (status === "published") return "Veröffentlicht";
  if (status === "archived") return "Archiviert";
  return "Entwurf";
}
