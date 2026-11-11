"use client";

import {
  Bell,
  Check,
  ChevronDown,
  LoaderCircle,
  MessageCircle,
  Moon,
  Pencil,
  Reply,
  Search,
  Send,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";

type Theme = "light" | "dark" | "system";
type Section = "roadmap" | "documents" | "calendar" | "access" | "teamchat";
type SearchItem = { id: string; title: string; detail: string; section: Section; target?: string };
type Notification = { id: string; title: string; description: string; href: string; created_at: string; read_at: string | null };
type PopupPosition = { left: number; top: number; width: number; maxHeight: number };
type ChatMessage = {
  id: string;
  sender_id: string | null;
  sender_name: string;
  sender_is_admin: boolean;
  content: string;
  reply_to_id: string | null;
  reply_to: { id: string; content: string; sender_name: string; deleted_at: string | null } | null;
  edited: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

async function errorMessage(response: Response) {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error ?? "Die Anfrage ist fehlgeschlagen.";
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json() as Promise<T>;
}

function localTheme(): Theme {
  try {
    const saved = window.localStorage.getItem("northstar-theme");
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

function popupPosition(anchor: DOMRect, maxWidth: number): PopupPosition {
  const width = Math.min(maxWidth, window.innerWidth - 24);
  const left = Math.max(12, Math.min(anchor.right - width, window.innerWidth - width - 12));
  const top = Math.max(12, Math.min(anchor.bottom + 8, window.innerHeight - 180));
  return { left, top, width, maxHeight: Math.max(0, window.innerHeight - top - 12) };
}

export function ThemeSelector({ role }: { role: "member" | "admin" | null }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [error, setError] = useState("");

  const applyTheme = useCallback((next: Theme) => {
    document.documentElement.dataset.theme = next;
    try { window.localStorage.setItem("northstar-theme", next); } catch { /* Storage may be disabled. */ }
    setTheme(next);
  }, []);

  useEffect(() => {
    applyTheme(localTheme());
    if (role === "member") {
      void requestJson<{ theme: Theme }>("/api/preferences/theme")
        .then(({ theme: saved }) => applyTheme(saved))
        .catch((cause) => setError(cause instanceof Error ? cause.message : "Die persönliche Darstellung konnte nicht geladen werden."));
    }
  }, [applyTheme, role]);

  async function changeTheme(next: Theme) {
    applyTheme(next);
    setError("");
    if (role !== "member") return;
    try {
      await requestJson("/api/preferences/theme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Die Darstellung konnte nicht gespeichert werden.");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-1.5 rounded-full border border-line bg-white/70 px-2.5 py-2 text-[11px] font-medium text-ink" title="Darstellung">
        {theme === "light" ? <Sun size={14} /> : theme === "dark" ? <Moon size={14} /> : <ChevronDown size={14} />}
        <span className="sr-only">Darstellung</span>
        <select value={theme} onChange={(event) => void changeTheme(event.target.value as Theme)} aria-label="Darstellung einstellen" className="max-w-[72px] cursor-pointer bg-transparent text-xs outline-none">
          <option value="light">Hell</option><option value="dark">Dunkel</option><option value="system">System</option>
        </select>
      </label>
      {error && <span role="alert" className="max-w-40 text-[10px] leading-4 text-[#aa463c]">{error}</span>}
    </div>
  );
}

export function WorkspaceTools({
  role,
  onNavigate,
  onMobileSearchExpandedChange,
}: {
  role: "member" | "admin";
  onNavigate: (section: Section, target?: string) => void;
  onMobileSearchExpandedChange: (expanded: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<{ category: string; items: SearchItem[] }[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [noticeError, setNoticeError] = useState("");
  const desktopSearchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);
  const desktopSearchRef = useRef<HTMLDivElement>(null);
  const noticeButtonRef = useRef<HTMLButtonElement>(null);
  const [searchPosition, setSearchPosition] = useState<PopupPosition | null>(null);
  const [noticePosition, setNoticePosition] = useState<PopupPosition | null>(null);

  const focusSearchInput = useCallback(() => {
    const input = window.matchMedia("(min-width: 768px)").matches
      ? desktopSearchInputRef.current
      : mobileSearchInputRef.current;
    input?.focus();
  }, []);

  useEffect(() => {
    onMobileSearchExpandedChange(searchOpen);
  }, [onMobileSearchExpandedChange, searchOpen]);

  useEffect(() => {
    if (!searchOpen && !noticeOpen) return;

    const updatePopupPositions = () => {
      if (searchOpen) {
        const anchor = window.matchMedia("(min-width: 768px)").matches
          ? desktopSearchRef.current
          : mobileSearchRef.current;
        if (anchor) setSearchPosition(popupPosition(anchor.getBoundingClientRect(), 540));
      }
      if (noticeOpen && noticeButtonRef.current) {
        setNoticePosition(popupPosition(noticeButtonRef.current.getBoundingClientRect(), 360));
      }
    };

    updatePopupPositions();
    window.addEventListener("resize", updatePopupPositions);
    window.addEventListener("scroll", updatePopupPositions, true);
    return () => {
      window.removeEventListener("resize", updatePopupPositions);
      window.removeEventListener("scroll", updatePopupPositions, true);
    };
  }, [noticeOpen, searchOpen]);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await requestJson<{ notifications: Notification[]; unreadCount: number }>("/api/notifications");
      setNotifications(data.notifications);
      setUnread(data.unreadCount);
      setNoticeError("");
    } catch (cause) {
      setNoticeError(cause instanceof Error ? cause.message : "Benachrichtigungen konnten nicht geladen werden.");
    }
  }, []);

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        window.setTimeout(focusSearchInput, 0);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setNoticeOpen(false);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [focusSearchInput]);

  useEffect(() => {
    if (!searchOpen || query.trim().length < 2) {
      setGroups([]);
      setSearchBusy(false);
      setSearchError("");
      return;
    }
    setSearchError("");
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchBusy(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(await errorMessage(response));
        const data = await response.json() as { groups: { category: string; items: SearchItem[] }[] };
        setGroups(data.groups);
        setSearchError("");
      } catch (cause) {
        if (!controller.signal.aborted) setSearchError(cause instanceof Error ? cause.message : "Die Suche ist fehlgeschlagen.");
      } finally {
        if (!controller.signal.aborted) setSearchBusy(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, searchOpen]);

  useEffect(() => {
    void loadNotifications();
    const events = new EventSource("/api/realtime");
    events.addEventListener("notification", () => void loadNotifications());
    const fallback = window.setInterval(() => void loadNotifications(), 30_000);
    return () => {
      events.close();
      window.clearInterval(fallback);
    };
  }, [loadNotifications]);

  async function markRead(id?: string) {
    if (!unread) return;
    try {
      await requestJson("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : { all: true }),
      });
      await loadNotifications();
    } catch (cause) {
      setNoticeError(cause instanceof Error ? cause.message : "Benachrichtigungen konnten nicht aktualisiert werden.");
    }
  }

  function chooseResult(item: SearchItem) {
    setSearchOpen(false);
    setQuery("");
    onNavigate(item.section, item.target ?? item.id);
  }

  return (
    <div className={`relative flex min-w-0 items-center gap-2 sm:gap-3 ${searchOpen ? "flex-1 md:flex-none" : ""}`}>
      <div ref={desktopSearchRef} className="relative hidden min-w-0 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={15} />
        <input
          ref={desktopSearchInputRef}
          value={query}
          onFocus={() => setSearchOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }}
          placeholder="Suchen …"
          aria-label="Projektinhalte durchsuchen"
          style={{ backgroundColor: "var(--surface)", color: "var(--color-text)" }}
          className="w-[210px] rounded-full border border-line py-2 pl-9 pr-14 text-xs placeholder:text-muted focus:w-[260px] sm:w-[240px]"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-line px-1 text-[9px] text-muted">Ctrl K</kbd>
      </div>
      <div
        ref={mobileSearchRef}
        className={`flex shrink-0 items-center gap-2 overflow-hidden transition-[width] duration-300 ease-out md:hidden ${searchOpen ? "w-[min(58vw,230px)]" : "w-9"}`}
      >
        <button
          type="button"
          onClick={() => {
            if (searchOpen) {
              setSearchOpen(false);
              setQuery("");
            } else {
              setSearchOpen(true);
              setNoticeOpen(false);
              window.setTimeout(focusSearchInput, 0);
            }
          }}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-white/70 text-ink"
          aria-label={searchOpen ? "Suche schließen" : "Suche öffnen"}
          aria-expanded={searchOpen}
        ><Search size={16} /></button>
        <input
          ref={mobileSearchInputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Suchen …"
          aria-label="Projektinhalte durchsuchen"
          tabIndex={searchOpen ? 0 : -1}
          aria-hidden={!searchOpen}
          style={{ backgroundColor: "var(--surface)", color: "var(--color-text)" }}
          className={`h-9 min-w-0 flex-1 rounded-full border border-line px-3 text-xs outline-none transition-opacity duration-200 placeholder:text-muted ${searchOpen ? "opacity-100" : "w-0 border-0 p-0 opacity-0"}`}
        />
      </div>
      <div className="relative">
        <button
          type="button"
          ref={noticeButtonRef}
          onClick={() => { setNoticeOpen((open) => !open); setSearchOpen(false); }}
          className="relative grid h-9 w-9 place-items-center rounded-full border border-line bg-white/70 text-ink"
          aria-label={`Benachrichtigungen${unread ? `, ${unread} ungelesen` : ""}`}
          aria-expanded={noticeOpen}
        >
          <Bell size={16} />
          {unread > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-[#b34335] px-1 text-center text-[9px] font-bold leading-4 text-white">{unread > 99 ? "99+" : unread}</span>}
        </button>
        {noticeOpen && noticePosition && (
          <div
            className="fixed z-40 overflow-hidden rounded-2xl border border-line bg-white shadow-float"
            style={{ left: noticePosition.left, top: noticePosition.top, width: noticePosition.width, maxHeight: noticePosition.maxHeight }}
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div><h2 className="text-sm font-semibold text-ink">Benachrichtigungen</h2><p className="text-[11px] text-muted">{unread} ungelesen</p></div>
              <button type="button" disabled={!unread} onClick={() => void markRead()} className="flex items-center gap-1 text-[11px] font-semibold text-forest disabled:opacity-40"><Check size={13} /> Alle gelesen</button>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: Math.min(420, window.innerHeight * 0.65, Math.max(0, noticePosition.maxHeight - 64)) }}>
              {noticeError && <p role="alert" className="px-4 py-3 text-xs text-[#b34335]">{noticeError}</p>}
              {!notifications.length && !noticeError && <p className="px-4 py-8 text-center text-xs text-muted">Du bist auf dem neuesten Stand.</p>}
              {notifications.map((item) => (
                <button key={item.id} type="button" onClick={() => { void markRead(item.id); setNoticeOpen(false); const destination = sectionFromHref(item.href); onNavigate(destination.section, destination.target); }}
                  className={`block w-full border-b border-line/70 px-4 py-3 text-left transition hover:bg-canvas ${!item.read_at ? "bg-[#faf7f2]" : ""}`}>
                  <span className="flex items-start gap-2"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.read_at ? "bg-transparent" : "bg-forest"}`} />
                    <span><span className="block text-xs font-semibold text-ink">{item.title}</span><span className="mt-1 block line-clamp-2 text-[11px] leading-4 text-muted">{item.description}</span>
                      <time className="mt-1 block text-[10px] text-muted">{timeAgo(item.created_at)}</time></span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <ThemeSelector role={role} />

      {searchOpen && (
        searchPosition && <div
          className="fixed z-40 overflow-hidden rounded-2xl border border-line bg-white shadow-float"
          style={{ left: searchPosition.left, top: searchPosition.top, width: searchPosition.width, maxHeight: searchPosition.maxHeight }}
        >
          {searchBusy && <div className="flex items-center gap-2 px-4 py-4 text-xs text-muted"><LoaderCircle size={14} className="animate-spin" />Suche läuft …</div>}
          {searchError && <p role="alert" className="px-4 py-4 text-xs text-[#b34335]">{searchError}</p>}
          {!searchBusy && !searchError && query.trim().length < 2 && <p className="px-4 py-5 text-xs text-muted">Gib mindestens zwei Zeichen ein, um Roadmap, Kommentare, Dokumente, Kalender und Teamchat zu durchsuchen.</p>}
          {!searchBusy && query.trim().length >= 2 && groups.length === 0 && !searchError && <p className="px-4 py-6 text-center text-xs text-muted">Keine passenden Inhalte gefunden.</p>}
          <div className="overflow-y-auto" style={{ maxHeight: Math.min(480, window.innerHeight * 0.65, Math.max(0, searchPosition.maxHeight - 12)) }}>
            {groups.map((group) => (
              <section key={group.category} className="border-b border-line/70 last:border-0">
                <h3 className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-muted">{group.category}</h3>
                {group.items.map((item) => <button key={`${group.category}-${item.id}`} onClick={() => chooseResult(item)} className="block w-full px-4 py-2.5 text-left hover:bg-canvas">
                  <span className="block text-xs font-semibold text-ink">{highlight(item.title, query)}</span>
                  <span className="mt-0.5 block line-clamp-2 text-[11px] leading-4 text-muted">{highlight(item.detail, query)}</span>
                </button>)}
              </section>
            ))}
          </div>
        </div>
      )}
      {role === "admin" && <span className="sr-only">Administratorkonto</span>}
    </div>
  );
}

function highlight(value: string, term: string) {
  const index = value.toLocaleLowerCase("de").indexOf(term.toLocaleLowerCase("de"));
  if (index < 0 || !term) return value;
  return <>{value.slice(0, index)}<mark className="rounded bg-lime/50 text-ink">{value.slice(index, index + term.length)}</mark>{value.slice(index + term.length)}</>;
}

function sectionFromHref(href: string): { section: Section; target?: string } {
  const search = new URL(href, window.location.origin).searchParams;
  const section = search.get("section");
  return {
    section: section === "documents" || section === "calendar" || section === "teamchat" || section === "access" ? section : "roadmap",
    target: search.get("step") ?? undefined,
  };
}

function timeAgo(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  if (minutes < 1440) return `vor ${Math.floor(minutes / 60)} Std.`;
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value));
}

export function TeamChatWorkspace({
  userId,
  role,
  targetId,
}: {
  userId: string | null;
  role: "member" | "admin";
  targetId?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [content, setContent] = useState("");
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasOlder, setHasOlder] = useState(false);
  const [error, setError] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const atBottomRef = useRef(true);
  const initialLoadRef = useRef(true);
  const initialPagesRef = useRef(0);
  const lastReadRef = useRef<string | null>(null);

  const loadMessages = useCallback(async (before?: string, older = false) => {
    try {
      const params = new URLSearchParams({ limit: "40" });
      if (before) params.set("before", before);
      const data = await requestJson<{ messages: ChatMessage[]; hasOlder: boolean; unreadCount: number; lastReadAt: string | null }>(`/api/teamchat?${params}`);
      setMessages((current) => {
        const merged = new Map(current.map((item) => [item.id, item]));
        for (const item of data.messages) merged.set(item.id, item);
        return Array.from(merged.values()).sort((left, right) =>
          left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id),
        );
      });
      if (!older && initialLoadRef.current) lastReadRef.current = data.lastReadAt;
      if (older) setHasOlder(data.hasOlder);
      else if (data.hasOlder) setHasOlder(true);
      setUnreadCount(data.unreadCount);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Der Teamchat konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  const markChatRead = useCallback(async () => {
    try {
      await requestJson("/api/teamchat/read", { method: "PUT" });
      setUnreadCount(0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Der Lesestand konnte nicht gespeichert werden.");
    }
  }, []);

  useEffect(() => {
    void loadMessages();
    const events = new EventSource("/api/realtime");
    events.addEventListener("chat", () => {
      const container = scrollRef.current;
      const nearBottom = !container || container.scrollHeight - container.scrollTop - container.clientHeight < 120;
      void loadMessages().then(() => { if (nearBottom && container) container.scrollTop = container.scrollHeight; });
    });
    const fallback = window.setInterval(() => void loadMessages(), 25_000);
    return () => { events.close(); window.clearInterval(fallback); };
  }, [loadMessages]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || !messages.length) return;
    if (initialLoadRef.current) {
      const lastRead = lastReadRef.current;
      const lastSeen = lastRead
        ? messages.slice().reverse().find((message) => message.created_at <= lastRead)
        : undefined;
      if (lastRead && !lastSeen && hasOlder && initialPagesRef.current < 5) {
        initialPagesRef.current += 1;
        void loadMessages(messages[0].created_at, true);
        return;
      }
      const target = lastSeen ? document.getElementById(`chat-message-${lastSeen.id}`) : null;
      if (target) node.scrollTop += target.getBoundingClientRect().top - node.getBoundingClientRect().top;
      else if (lastRead && !lastSeen && hasOlder) node.scrollTop = 0;
      else node.scrollTop = node.scrollHeight;
      atBottomRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 100;
      initialLoadRef.current = false;
    } else if (atBottomRef.current) node.scrollTop = node.scrollHeight;
  }, [hasOlder, loadMessages, messages]);

  useEffect(() => {
    if (!targetId || loading) return;
    const target = document.getElementById(`chat-message-${targetId}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    let active = true;
    void requestJson<{ messages: ChatMessage[] }>(`/api/teamchat?id=${encodeURIComponent(targetId)}&limit=1`)
      .then(({ messages: found }) => {
        if (!active || !found.length) return;
        setMessages((current) => current.some((message) => message.id === found[0].id) ? current : [...current, ...found]);
        window.setTimeout(() => document.getElementById(`chat-message-${targetId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Die ausgewählte Nachricht konnte nicht geladen werden."));
    return () => { active = false; };
  }, [loading, targetId]);

  useEffect(() => {
    if (!loading && !initialLoadRef.current && atBottomRef.current) void markChatRead();
  }, [loading, markChatRead, messages.length]);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const text = content.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    try {
      if (editing) {
        await requestJson(`/api/teamchat/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text }),
        });
      } else {
        await requestJson("/api/teamchat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text, reply_to_id: reply?.id ?? null }),
        });
      }
      setContent("");
      setReply(null);
      setEditing(null);
      await loadMessages();
      window.setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 0);
      composerRef.current?.focus();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Die Nachricht konnte nicht gesendet werden.");
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  async function deleteMessage(message: ChatMessage) {
    if (!window.confirm("Diese Nachricht löschen? Antworten bleiben weiterhin erhalten.")) return;
    try {
      await requestJson(`/api/teamchat/${message.id}`, { method: "DELETE" });
      await loadMessages();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Die Nachricht konnte nicht gelöscht werden.");
    }
  }

  async function loadOlder() {
    if (!messages.length || !hasOlder) return;
    const container = scrollRef.current;
    const priorHeight = container?.scrollHeight ?? 0;
    await loadMessages(messages[0].created_at, true);
    window.requestAnimationFrame(() => {
      if (container) container.scrollTop += container.scrollHeight - priorHeight;
    });
  }

  function startEdit(message: ChatMessage) {
    setEditing(message);
    setReply(null);
    setContent(message.content);
    composerRef.current?.focus();
  }

  async function jumpToMessage(id: string) {
    let target = document.getElementById(`chat-message-${id}`);
    if (!target) {
      try {
        const { messages: found } = await requestJson<{ messages: ChatMessage[] }>(`/api/teamchat?id=${encodeURIComponent(id)}&limit=1`);
        if (found[0]) {
          setMessages((current) => Array.from(new Map([...current, found[0]].map((message) => [message.id, message])).values())
            .sort((left, right) => left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id)));
          await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
          target = document.getElementById(`chat-message-${id}`);
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Die ursprüngliche Nachricht konnte nicht geladen werden.");
      }
    }
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <section className="mx-auto mt-8 flex h-[min(74vh,780px)] min-h-[480px] max-w-[920px] flex-col overflow-hidden rounded-[24px] border border-line bg-white shadow-card">
      <header className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-7">
        <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#eff5ef] text-forest"><MessageCircle size={19} /></span>
          <div><h2 className="text-lg font-semibold tracking-tight text-ink">Teamchat</h2><p className="text-xs text-muted">Ein gemeinsamer Nachrichtenbereich für das gesamte Team</p></div></div>
        {unreadCount > 0 && <span className="rounded-full bg-[#faf1df] px-3 py-1 text-[11px] font-semibold text-[#936318]">{unreadCount} ungelesen</span>}
      </header>
      {error && <div role="alert" className="mx-4 mt-3 rounded-xl bg-[#fff0ed] px-3 py-2 text-xs text-[#aa463c]">{error}</div>}
      <div ref={scrollRef} onScroll={(event) => {
        const node = event.currentTarget;
        const wasAtBottom = atBottomRef.current;
        atBottomRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 100;
        if (!wasAtBottom && atBottomRef.current) void markChatRead();
      }} className="flex-1 space-y-4 overflow-y-auto bg-canvas/60 px-4 py-5 sm:px-7">
        {hasOlder && <div className="text-center"><button type="button" onClick={() => void loadOlder()} className="rounded-full border border-line bg-white px-3 py-1.5 text-[11px] font-medium text-muted hover:text-ink">Ältere Nachrichten laden</button></div>}
        {loading && <div className="flex justify-center py-10"><LoaderCircle size={20} className="animate-spin text-muted" /></div>}
        {!loading && messages.length === 0 && <p className="py-16 text-center text-sm text-muted">Noch keine Nachrichten. Starte den Austausch im Team.</p>}
        {messages.map((message) => {
          const own = role === "admin" ? message.sender_is_admin : message.sender_id === userId;
          return (
            <article id={`chat-message-${message.id}`} key={message.id} className={`group flex ${own ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[88%] sm:max-w-[76%] ${own ? "items-end" : "items-start"} flex flex-col`}>
                <div className={`mb-1 flex items-center gap-2 px-1 text-[10px] text-muted ${own ? "flex-row-reverse" : ""}`}>
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[#e9e3da] text-[9px] font-bold text-ink">{message.sender_name.slice(0, 1).toLocaleUpperCase("de")}</span>
                  <span className="font-semibold">{message.sender_name}</span>
                  <time>{new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(message.created_at))}</time>
                  {message.edited && <span>bearbeitet</span>}
                </div>
                <div className={`min-w-[88px] rounded-2xl px-4 py-3 text-sm leading-6 ${own ? "rounded-tr-sm bg-forest text-white" : "rounded-tl-sm border border-line bg-white text-ink"}`}>
                  {message.reply_to && <button type="button" onClick={() => jumpToMessage(message.reply_to!.id)} className={`mb-2 block w-full rounded-lg border-l-2 px-2.5 py-1.5 text-left text-[11px] ${own ? "border-white/60 bg-white/10 text-white/80" : "border-forest/50 bg-canvas text-muted"}`}>
                    <span className="block font-semibold">{message.reply_to.sender_name}</span><span className="block truncate">{message.reply_to.deleted_at ? "Nachricht gelöscht" : message.reply_to.content}</span>
                  </button>}
                  <p className={message.deleted_at ? "italic opacity-70" : "whitespace-pre-wrap break-words"}>{message.deleted_at ? "Diese Nachricht wurde gelöscht." : message.content}</p>
                </div>
                <div className={`mt-1 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 ${own ? "justify-end" : ""}`}>
                  {!message.deleted_at && <button type="button" onClick={() => { setReply(message); setEditing(null); composerRef.current?.focus(); }} aria-label="Auf Nachricht antworten" className="rounded px-2 py-1 text-[10px] text-muted hover:bg-canvas hover:text-ink"><Reply size={12} /></button>}
                  {(own || role === "admin") && !message.deleted_at && <button type="button" onClick={() => startEdit(message)} aria-label="Nachricht bearbeiten" className="rounded px-2 py-1 text-[10px] text-muted hover:bg-canvas hover:text-ink"><Pencil size={12} /></button>}
                  {(own || role === "admin") && !message.deleted_at && <button type="button" onClick={() => void deleteMessage(message)} aria-label="Nachricht löschen" className="rounded px-2 py-1 text-[10px] text-muted hover:bg-[#fff0ed] hover:text-[#aa463c]"><Trash2 size={12} /></button>}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <form onSubmit={sendMessage} className="border-t border-line bg-white p-3 sm:p-5">
        {(reply || editing) && <div className="mb-2 flex items-center justify-between rounded-xl bg-canvas px-3 py-2 text-xs">
          <span className="flex min-w-0 items-center gap-2 text-muted">{editing ? <Pencil size={13} /> : <Reply size={13} />}<span className="truncate">{editing ? "Nachricht bearbeiten" : `Antwort an ${reply?.sender_name}: ${reply?.deleted_at ? "gelöschte Nachricht" : reply?.content}`}</span></span>
          <button type="button" onClick={() => { setReply(null); setEditing(null); setContent(""); }} className="ml-2 text-muted hover:text-ink" aria-label="Antwort oder Bearbeitung abbrechen"><X size={14} /></button>
        </div>}
        <div className="flex items-end gap-2">
          <textarea ref={composerRef} value={content} onChange={(event) => setContent(event.target.value)} onKeyDown={handleKeyDown} maxLength={4000} rows={1}
            placeholder="Nachricht schreiben … (Enter zum Senden, Shift + Enter für Zeilenumbruch)"
            aria-label="Teamchat-Nachricht" className="max-h-32 min-h-11 flex-1 resize-y rounded-xl border border-line bg-canvas px-4 py-3 text-sm leading-5 text-ink placeholder:text-muted" />
          <button type="submit" disabled={busy || !content.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-forest text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45" aria-label={editing ? "Änderung speichern" : "Nachricht senden"}>
            {busy ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <p className="mt-2 text-right text-[10px] text-muted">{content.length}/4000</p>
      </form>
    </section>
  );
}
