"use client";

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  Compass,
  ExternalLink,
  Flag,
  Layers3,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Rocket,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  previews,
  siteConfig,
  statusLabels,
  type RoadmapStepConfig,
  type TrafficStatus,
} from "@/lib/config";

type Comment = {
  id: string;
  step_id: string;
  name: string;
  message: string;
  created_at: string;
};
type Step = RoadmapStepConfig & { status: TrafficStatus; comments: Comment[] };
type Tab = "roadmap" | "preview";

const iconMap = {
  compass: Compass,
  layers: Layers3,
  sparkles: Sparkles,
  rocket: Rocket,
  flag: Flag,
};

function monthLabel(month: number, year: number) {
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1),
  );
}

function monthStart(step: Step) {
  return new Date(step.year, step.month - 1, 1).getTime();
}

async function responseError(response: Response) {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? "Ein Fehler ist aufgetreten. Bitte versuche es erneut.";
}

function safeExternalHref(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function RoadmapApp() {
  const [role, setRole] = useState<"visitor" | "admin" | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [selected, setSelected] = useState<Step | null>(null);
  const [tab, setTab] = useState<Tab>("roadmap");
  const [error, setError] = useState("");

  const loadRoadmap = useCallback(async () => {
    try {
      const response = await fetch("/api/roadmap", { cache: "no-store" });
      if (!response.ok) throw new Error(await responseError(response));
      const data = (await response.json()) as { steps: Step[] };
      setSteps(data.steps);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Die Roadmap konnte nicht geladen werden.");
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => response.json())
      .then(async (session: { authenticated: boolean; role: "visitor" | "admin" | null }) => {
        if (session.authenticated && session.role) {
          setRole(session.role);
          await loadRoadmap();
        }
      })
      .catch(() => setError("Die Sitzung konnte nicht geprüft werden. Bitte lade die Seite erneut."));
  }, [loadRoadmap]);

  useEffect(() => {
    if (!selected) return;
    const updated = steps.find((step) => step.id === selected.id);
    if (updated) setSelected(updated);
  }, [steps, selected]);

  const counts = useMemo(
    () => ({
      green: steps.filter((step) => step.status === "green").length,
      yellow: steps.filter((step) => step.status === "yellow").length,
      red: steps.filter((step) => step.status === "red").length,
    }),
    [steps],
  );
  const progress = useMemo(() => {
    if (!steps.length) return 0;
    const current = Date.now();
    const first = monthStart(steps[0]);
    const last = monthStart(steps[steps.length - 1]);
    if (current <= first) return 0;
    if (current >= last) return 100;
    return Math.round(((current - first) / (last - first)) * 100);
  }, [steps]);

  async function handleLogin(password: string, loginRole: "visitor" | "admin") {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, role: loginRole }),
    });
    if (!response.ok) throw new Error(await responseError(response));
    const data = (await response.json()) as { role: "visitor" | "admin" };
    setRole(data.role);
    setError("");
    await loadRoadmap();
  }

  async function logout() {
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error(await responseError(response));
      const data = (await response.json()) as { authenticated: boolean };
      setRole(data.authenticated ? "visitor" : null);
      if (!data.authenticated) {
        setSelected(null);
        setSteps([]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Die Sitzung konnte nicht beendet werden.");
    }
  }

  async function updateStatus(stepId: string, status: TrafficStatus) {
    setError("");
    const response = await fetch(`/api/roadmap/${stepId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) throw new Error(await responseError(response));
    setSteps((current) =>
      current.map((step) => (step.id === stepId ? { ...step, status } : step)),
    );
  }

  async function addComment(stepId: string, comment: Comment) {
    setSteps((current) =>
      current.map((step) =>
        step.id === stepId
          ? { ...step, comments: [comment, ...step.comments] }
          : step,
      ),
    );
  }

  async function deleteComment(stepId: string, commentId: string) {
    const response = await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
    if (!response.ok) throw new Error(await responseError(response));
    setSteps((current) =>
      current.map((step) =>
        step.id === stepId
          ? { ...step, comments: step.comments.filter((comment) => comment.id !== commentId) }
          : step,
      ),
    );
  }

  const cssVars = {
    "--color-primary": siteConfig.colors.primary,
    "--color-secondary": siteConfig.colors.secondary,
    "--color-background": siteConfig.colors.background,
    "--color-text": siteConfig.colors.text,
    "--color-muted": siteConfig.colors.muted,
    "--color-accent": siteConfig.colors.accent,
    "--color-line": siteConfig.colors.line,
    "--status-green": siteConfig.colors.traffic.green,
    "--status-yellow": siteConfig.colors.traffic.yellow,
    "--status-red": siteConfig.colors.traffic.red,
  } as React.CSSProperties;

  if (!role) {
    return (
      <UnlockScreen
        onLogin={handleLogin}
        error={error}
        setError={setError}
        style={cssVars}
      />
    );
  }

  return (
    <main className="min-h-screen pb-16" style={cssVars}>
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        <header className="flex items-center justify-between border-b border-line/80 py-5">
          <a href="#" className="flex items-center gap-3" aria-label={`${siteConfig.name} Startseite`}>
            <Image className="h-10 w-10" src={siteConfig.logo} alt="" width={40} height={40} unoptimized />
            <span className="text-sm font-bold tracking-[0.16em] text-ink">
              {siteConfig.name.toUpperCase()}
              <span className="ml-2 hidden text-[11px] font-medium tracking-normal text-muted sm:inline">
                PROJEKTRAUM
              </span>
            </span>
          </a>
          <div className="flex items-center gap-3">
            {role === "admin" ? (
              <span className="hidden items-center gap-1.5 rounded-full bg-[#e8f4eb] px-3 py-1.5 text-xs font-semibold text-forest sm:inline-flex">
                <ShieldCheck size={14} /> Admin-Modus
              </span>
            ) : null}
            <button
              onClick={logout}
              className="flex items-center gap-2 rounded-full border border-line bg-white/70 px-3.5 py-2 text-xs font-semibold text-ink transition hover:bg-white"
              aria-label={role === "admin" ? "Admin-Modus verlassen" : "Projekt sperren"}
            >
              <LogOut size={14} />
              <span>{role === "admin" ? "Admin beenden" : "Sperren"}</span>
            </button>
          </div>
        </header>

        <section className="relative mt-9 min-h-[330px] overflow-hidden rounded-[30px] bg-forest px-7 py-9 text-white shadow-card sm:min-h-[370px] sm:px-11 sm:py-12">
          <Image
            src={siteConfig.heroImage}
            alt=""
            fill
            priority
            sizes="(max-width: 640px) 100vw, 1240px"
            className="pointer-events-none object-cover object-center"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#281307]/95 via-[#42230e]/75 to-[#542b0d]/25" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/10" />
          <div className="relative z-10 flex min-h-[250px] max-w-[760px] flex-col justify-center sm:min-h-[280px]">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-white/90 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-lime" />
              Bigband · Konzertprojekt 2027
            </div>
            <h1 className="max-w-[600px] text-4xl font-semibold leading-[1.07] tracking-[-0.045em] sm:text-[54px]">
              {siteConfig.name}
              <span className="text-lime">.</span>
            </h1>
            <p className="mt-4 max-w-[510px] text-sm leading-6 text-white/70 sm:text-base">
              {siteConfig.tagline}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-2 text-xs font-medium text-white/80">
              <span className="flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-2 backdrop-blur-sm">
                <CalendarDays size={14} /> {steps.length} Produktionsphasen
              </span>
              <span className="rounded-full bg-black/20 px-3 py-2 backdrop-blur-sm">{siteConfig.timelineLabel}</span>
              {role === "admin" && (
                <span className="rounded-full bg-lime px-3 py-2 font-semibold text-ink">
                  Änderungen werden direkt gespeichert
                </span>
              )}
            </div>
          </div>
        </section>

        {error && <Notice message={error} onClose={() => setError("")} />}

        <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Produktionsphasen" value={String(steps.length).padStart(2, "0")} icon={<Flag size={17} />} detail="von der Strategie bis zum Konzert-Rückblick" />
          <SummaryCard label="Im Plan" value={String(counts.green).padStart(2, "0")} tone="green" detail="läuft in die richtige Richtung" />
          <SummaryCard label="Im Blick" value={String(counts.yellow).padStart(2, "0")} tone="yellow" detail="verdient unsere Aufmerksamkeit" />
          <SummaryCard label="Kritisch" value={String(counts.red).padStart(2, "0")} tone="red" detail="braucht eine genaue Prüfung" />
        </section>

        <section className="mt-8 rounded-[26px] border border-line bg-white/80 p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Produktionsfortschritt</p>
              <p className="mt-2 text-lg font-semibold tracking-tight text-ink">
                Von der Leitidee bis zur fertigen Dokumentation
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-semibold tracking-tight text-forest">{progress}%</span>
              <span className="ml-1.5 text-xs text-muted">des Zeitplans</span>
            </div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#edf0eb]">
            <div
              className="h-full rounded-full bg-forest transition-[width] duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-muted">
            <span>{steps[0] ? monthLabel(steps[0].month, steps[0].year) : "Start"}</span>
            <span>{steps.at(-1) ? monthLabel(steps.at(-1)!.month, steps.at(-1)!.year) : "Start"}</span>
          </div>
        </section>

        <nav className="mt-10 flex gap-2 border-b border-line" aria-label="Projektbereiche">
          <TabButton active={tab === "roadmap"} onClick={() => setTab("roadmap")}>Roadmap</TabButton>
          <TabButton active={tab === "preview"} onClick={() => setTab("preview")}>Preview</TabButton>
          <span className="ml-auto hidden self-center text-xs text-muted sm:block">
            {tab === "roadmap" ? "Gemeinsam im Blick, was als Nächstes kommt" : "Ideen, Referenzen & Inspiration"}
          </span>
        </nav>

        {tab === "roadmap" ? (
          <section className="grid gap-8 pt-8 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div>
              <div className="mb-7 flex items-end justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-forest">Produktionsplan</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-ink">Fünf Phasen. Ein stimmiger Auftritt.</h2>
                </div>
                <span className="hidden text-xs text-muted sm:block">Phase auswählen und Details ansehen</span>
              </div>
              <div className="relative space-y-4 pl-9 sm:pl-12">
                <div className="roadmap-line absolute bottom-7 left-[11px] top-8 w-px sm:left-[15px]" />
                {steps.map((step, index) => {
                  const Icon = iconMap[step.icon];
                  const isPast = monthStart(step) < new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
                  return (
                    <div className="relative" key={step.id}>
                      <span className={`absolute -left-[36px] top-7 grid h-[24px] w-[24px] place-items-center rounded-full border-[5px] border-canvas bg-white shadow-sm sm:-left-[44px] sm:h-[30px] sm:w-[30px]`}>
                        <span className={`h-2.5 w-2.5 rounded-full status-${step.status}`} />
                      </span>
                      <button
                        onClick={() => setSelected(step)}
                        className="group w-full rounded-[22px] border border-line bg-white p-5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[#cbd9ce] hover:shadow-card sm:p-6"
                      >
                        <div className="flex items-start gap-4">
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eff5ef] text-forest transition group-hover:bg-lime">
                            <Icon size={20} strokeWidth={1.8} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                                Phase {String(index + 1).padStart(2, "0")}
                              </span>
                              {isPast && <span className="rounded-full bg-[#eef4ed] px-2 py-0.5 text-[10px] font-semibold text-forest">Vergangen</span>}
                              <span className="ml-auto flex items-center gap-2 text-xs font-semibold text-ink">
                                <span className={`h-2 w-2 rounded-full status-${step.status}`} />
                                <span className="hidden sm:inline">{statusLabels[step.status]}</span>
                              </span>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-3">
                              <h3 className="text-base font-semibold tracking-tight text-ink sm:text-lg">{step.title}</h3>
                              <ChevronRight className="shrink-0 text-muted transition group-hover:translate-x-1 group-hover:text-forest" size={18} />
                            </div>
                            <p className="mt-2 line-clamp-2 max-w-[650px] text-sm leading-6 text-muted">{step.description}</p>
                            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
                              <span className="flex items-center gap-1.5"><CalendarDays size={14} />{monthLabel(step.month, step.year)}</span>
                              <span className="flex items-center gap-1.5"><MessageCircle size={14} />{step.comments.length} {step.comments.length === 1 ? "Kommentar" : "Kommentare"}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <aside className="space-y-4">
              <div className="rounded-[22px] bg-[#f2e7da] p-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-forest">Gemeinsam auf der Bühne</p>
                <p className="mt-2 text-xl font-semibold tracking-tight text-ink">Viele Stimmen. Ein Bigband-Sound.</p>
                <p className="mt-2 text-sm leading-6 text-muted">Vom ersten Arrangement bis zum Konzertabend bringt jeder Beitrag die Musik ein Stück weiter.</p>
                <div className="mt-5 flex items-center gap-2 text-xs font-medium text-forest">
                  <ArrowDownRight size={15} /> Zusammen den nächsten Takt setzen
                </div>
              </div>
              <div className="rounded-[22px] border border-line bg-white p-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Statusübersicht</p>
                <div className="mt-5 space-y-4">
                  <StatusBar label="Im Plan" value={counts.green} total={steps.length} tone="green" />
                  <StatusBar label="Im Blick" value={counts.yellow} total={steps.length} tone="yellow" />
                  <StatusBar label="Kritisch" value={counts.red} total={steps.length} tone="red" />
                </div>
                <div className="mt-5 flex items-center gap-2 border-t border-line pt-4 text-xs leading-5 text-muted">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#f5ede3] text-forest"><Check size={13} /></span>
                  Jede Phase bringt uns näher ans Publikum.
                </div>
              </div>
            </aside>
          </section>
        ) : (
          <section className="pt-8">
            <div className="mb-7 max-w-[620px]">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-forest">Inspirationssammlung</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-ink">Konzertmomente &amp; Repertoire.</h2>
              <p className="mt-2 text-sm leading-6 text-muted">Ein Einblick in unseren Bigband-Sound und eine Musikressource zur Repertoire-Recherche.</p>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {previews.map((preview) => (
                <article key={preview.id} className="overflow-hidden rounded-[22px] border border-line bg-white shadow-sm">
                  {preview.kind === "image" ? (
                  <div className="relative aspect-video bg-[#eaf0e8]">
                    <Image
                      className="object-cover"
                      src={preview.imageUrl}
                      alt={preview.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      unoptimized
                    />
                  </div>
                  ) : preview.kind === "youtube" && /^[A-Za-z0-9_-]{11}$/.test(preview.videoId) ? (
                    <div className="aspect-video bg-[#eaf0e8]">
                      <iframe
                        className="h-full w-full"
                        src={`https://www.youtube-nocookie.com/embed/${preview.videoId}`}
                        title={preview.title}
                        loading="lazy"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                  ) : preview.kind === "vimeo" && /^\d+$/.test(preview.videoId) ? (
                    <div className="aspect-video bg-[#eaf0e8]">
                      <iframe
                        className="h-full w-full"
                        src={`https://player.vimeo.com/video/${preview.videoId}`}
                        title={preview.title}
                        loading="lazy"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : preview.kind === "link" && safeExternalHref(preview.href) ? (
                    <a
                      className="group flex aspect-video items-center justify-center bg-[#eaf0e8] text-forest"
                      href={safeExternalHref(preview.href)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${preview.title} in einem neuen Tab öffnen`}
                    >
                      <span className="grid h-14 w-14 place-items-center rounded-full bg-white shadow-sm transition group-hover:scale-105"><ExternalLink size={20} /></span>
                    </a>
                  ) : (
                    <div className="grid aspect-video place-items-center bg-[#f3f5f1] text-xs text-muted">Vorschau nicht verfügbar</div>
                  )}
                  <div className="p-5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-forest">{preview.label}</span>
                    <h3 className="mt-2 text-lg font-semibold tracking-tight text-ink">{preview.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">{preview.description}</p>
                    {preview.kind === "link" && safeExternalHref(preview.href) && (
                      <a href={safeExternalHref(preview.href)!} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-forest hover:underline">
                        Referenz ansehen <ArrowUpRight size={14} />
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-[11px] text-muted">
          <span>{siteConfig.name} · Ein gemeinsamer Projektraum</span>
          <span className="flex items-center gap-1.5"><LockKeyhole size={12} /> Geschützt und vertraulich</span>
        </footer>
      </div>

      {selected && (
        <StepDialog
          step={selected}
          isAdmin={role === "admin"}
          onClose={() => setSelected(null)}
          onStatusChange={updateStatus}
          onAddComment={addComment}
          onDeleteComment={deleteComment}
        />
      )}
    </main>
  );
}

function UnlockScreen({
  onLogin,
  error,
  setError,
  style,
}: {
  onLogin: (password: string, role: "visitor" | "admin") => Promise<void>;
  error: string;
  setError: (message: string) => void;
  style: React.CSSProperties;
}) {
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"visitor" | "admin">("visitor");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onLogin(password, mode);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to unlock the project.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-5 py-10" style={style}>
      <div className="grid w-full max-w-[1000px] overflow-hidden rounded-[30px] border border-line bg-white shadow-float md:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden min-h-[620px] overflow-hidden bg-[#193f35] p-11 text-white md:flex md:flex-col md:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_78%,rgba(216,243,106,0.19),transparent_45%)]" />
          <Image className="absolute -bottom-5 -right-7 w-[95%] opacity-90" src={siteConfig.heroImage} alt="" width={440} height={350} unoptimized />
          <a href="#" className="relative z-10 flex items-center gap-3">
            <Image className="h-10 w-10" src={siteConfig.logo} alt="" width={40} height={40} unoptimized />
            <span className="text-xs font-bold tracking-[0.16em]">{siteConfig.name.toUpperCase()}</span>
          </a>
          <div className="relative z-10 max-w-[390px]">
            <span className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#e2f1e7]">Marketing · Content · Konzertdokumentation</span>
            <h1 className="text-[40px] font-semibold leading-[1.08] tracking-[-0.045em]">Vom ersten Konzept bis zum Konzertmoment.</h1>
            <p className="mt-4 text-sm leading-6 text-white/70">{siteConfig.tagline}</p>
          </div>
          <div className="relative z-10 text-[11px] text-white/45">Ein durchdachter Blick auf das, was kommt.</div>
        </section>
        <section className="flex min-h-[600px] flex-col justify-center p-7 sm:p-10 md:p-12">
          <div className="mb-9 flex items-center gap-3 md:hidden">
            <Image className="h-10 w-10" src={siteConfig.logo} alt="" width={40} height={40} unoptimized />
            <span className="text-xs font-bold tracking-[0.16em] text-ink">{siteConfig.name.toUpperCase()}</span>
          </div>
          <div className="mb-7">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eaf0e8] text-forest"><LockKeyhole size={20} /></span>
            <h2 className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-ink">Ein geschützter Ort zum Planen.</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Gib dein Passwort ein, um die Roadmap anzusehen und deine Gedanken zu teilen.</p>
          </div>
          <div className="mb-5 grid grid-cols-2 rounded-full bg-[#f1f3f0] p-1" role="tablist" aria-label="Zugangsart">
            <button onClick={() => { setMode("visitor"); setError(""); }} className={`rounded-full py-2.5 text-xs font-semibold transition ${mode === "visitor" ? "bg-white text-ink shadow-sm" : "text-muted"}`} role="tab" aria-selected={mode === "visitor"}>Besucherzugang</button>
            <button onClick={() => { setMode("admin"); setError(""); }} className={`rounded-full py-2.5 text-xs font-semibold transition ${mode === "admin" ? "bg-white text-ink shadow-sm" : "text-muted"}`} role="tab" aria-selected={mode === "admin"}>Adminzugang</button>
          </div>
          <form onSubmit={submit}>
            <label htmlFor="password" className="mb-2 block text-xs font-semibold text-ink">
              {mode === "admin" ? "Administratorpasswort" : "Projektpasswort"}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={256}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Passwort eingeben"
              className="w-full rounded-xl border border-line bg-white px-4 py-3.5 text-sm text-ink placeholder:text-[#a0a9a2]"
            />
            {error && <p role="alert" className="mt-3 rounded-xl bg-[#fff0ed] px-3.5 py-3 text-xs leading-5 text-[#aa463c]">{error}</p>}
            <button disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#174c3e] disabled:cursor-wait disabled:opacity-70">
              {busy ? "Zugang wird geprüft…" : mode === "admin" ? "Als Administrator anmelden" : "Projekt freischalten"}
              {!busy && <ArrowRight size={16} />}
            </button>
          </form>
          <p className="mt-6 flex items-start gap-2 text-[11px] leading-5 text-muted">
            <ShieldCheck size={14} className="mt-0.5 shrink-0" />
            Dein Zugang bleibt sieben Tage lang sicher gespeichert.
          </p>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon?: React.ReactNode;
  tone?: TrafficStatus;
}) {
  return (
    <div className="rounded-[20px] border border-line bg-white/85 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted">{label}</span>
        {tone ? <span className={`status-dot h-2.5 w-2.5 rounded-full status-${tone}`} /> : <span className="text-forest">{icon}</span>}
      </div>
      <p className="mt-3 text-[30px] font-semibold leading-none tracking-[-0.04em] text-ink">{value}</p>
      <p className="mt-2 text-[11px] text-muted">{detail}</p>
    </div>
  );
}

function StatusBar({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: TrafficStatus;
}) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-xs">
        <span className="font-medium text-ink">{label}</span><span className="text-muted">{value}/{total}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[#edf0eb]">
        <div className={`h-1.5 rounded-full status-${tone} transition-[width] duration-500`} style={{ width: `${total ? (value / total) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

function TabButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-2 pb-3.5 text-sm font-semibold transition ${active ? "text-forest" : "text-muted hover:text-ink"}`}
      aria-current={active ? "page" : undefined}
    >
      {children}
      {active && <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] rounded-full bg-forest" />}
    </button>
  );
}

function Notice({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div role="alert" className="mt-5 flex items-start justify-between gap-3 rounded-xl border border-[#f1d4ce] bg-[#fff6f3] px-4 py-3 text-sm text-[#9b493e]">
      <span>{message}</span>
      <button onClick={onClose} aria-label="Meldung schließen"><X size={16} /></button>
    </div>
  );
}

function StepDialog({
  step,
  isAdmin,
  onClose,
  onStatusChange,
  onAddComment,
  onDeleteComment,
}: {
  step: Step;
  isAdmin: boolean;
  onClose: () => void;
  onStatusChange: (id: string, status: TrafficStatus) => Promise<void>;
  onAddComment: (id: string, comment: Comment) => Promise<void>;
  onDeleteComment: (stepId: string, commentId: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [localError, setLocalError] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFeedback("");
    setLocalError("");
    try {
      const response = await fetch(`/api/roadmap/${step.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, message }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const data = (await response.json()) as { comment: Comment };
      await onAddComment(step.id, data.comment);
      setMessage("");
      setFeedback("Dein Kommentar wurde hinzugefügt.");
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : "Dein Kommentar konnte nicht gesendet werden.");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status: TrafficStatus) {
    setSavingStatus(true);
    setLocalError("");
    try {
      await onStatusChange(step.id, status);
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : "Der Status konnte nicht gespeichert werden.");
    } finally {
      setSavingStatus(false);
    }
  }

  async function removeComment(commentId: string) {
    if (!window.confirm("Diesen Kommentar wirklich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.")) return;
    setLocalError("");
    try {
      await onDeleteComment(step.id, commentId);
      setFeedback("Kommentar gelöscht.");
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : "Der Kommentar konnte nicht gelöscht werden.");
    }
  }

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-[#14221f]/45 p-0 backdrop-blur-[3px] sm:items-center sm:p-5"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="step-title"
        tabIndex={-1}
        className="modal-panel max-h-[94vh] w-full max-w-[720px] overflow-y-auto rounded-t-[26px] bg-[#fbfcfa] shadow-float sm:rounded-[26px]"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-[#fbfcfa]/95 px-6 py-4 backdrop-blur sm:px-8">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-forest">Produktionsphase</span>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-[#f0f3ef] text-muted transition hover:bg-[#e6ebe5] hover:text-ink" aria-label="Details schließen"><X size={17} /></button>
        </header>
        <div className="px-6 pb-8 pt-6 sm:px-8">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="rounded-full bg-[#eaf0e8] px-3 py-1.5 font-semibold text-forest">Phase {String(step.order).padStart(2, "0")}</span>
            <span className="flex items-center gap-1.5"><CalendarDays size={14} />{monthLabel(step.month, step.year)}</span>
          </div>
          <h2 id="step-title" className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.04em] text-ink">{step.title}</h2>
          <p className="mt-3 max-w-[600px] text-sm leading-6 text-muted">{step.description}</p>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Aktueller Status</p>
              <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-ink">
                <span className={`status-dot h-2.5 w-2.5 rounded-full status-${step.status}`} />
                {statusLabels[step.status]}
              </p>
            </div>
            {isAdmin ? (
              <label className="flex items-center gap-2 text-xs font-semibold text-muted">
                Ändern
                <select
                  disabled={savingStatus}
                  value={step.status}
                  onChange={(event) => changeStatus(event.target.value as TrafficStatus)}
                  className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-ink disabled:opacity-60"
                  aria-label="Roadmap-Status ändern"
                >
                  <option value="green">Grün — im Plan</option>
                  <option value="yellow">Gelb — im Blick</option>
                  <option value="red">Rot — kritisch</option>
                </select>
              </label>
            ) : (
              <span className="rounded-full bg-[#f4f6f2] px-3 py-2 text-[11px] font-medium text-muted">Status für alle sichtbar</span>
            )}
          </div>

          <div className="mt-8">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-forest">Austausch</p>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-ink">Teile deine Perspektive</h3>
              </div>
              <span className="text-xs text-muted">{step.comments.length} {step.comments.length === 1 ? "Kommentar" : "Kommentare"}</span>
            </div>
            <form onSubmit={submit} className="mt-4 rounded-2xl border border-line bg-white p-4 sm:p-5">
              <label className="mb-2 block text-xs font-semibold text-ink" htmlFor="comment-name">Dein Name</label>
              <input
                id="comment-name"
                required
                maxLength={60}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Wie dürfen wir dich nennen?"
                className="w-full rounded-lg border border-line px-3.5 py-3 text-sm text-ink placeholder:text-[#a0a9a2]"
              />
              <label className="mb-2 mt-4 block text-xs font-semibold text-ink" htmlFor="comment-message">Dein Kommentar</label>
              <textarea
                id="comment-message"
                required
                maxLength={1000}
                rows={3}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Teile einen Gedanken, eine Frage oder Feedback …"
                className="w-full resize-y rounded-lg border border-line px-3.5 py-3 text-sm leading-6 text-ink placeholder:text-[#a0a9a2]"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-[10px] text-muted">{message.length}/1000</span>
                <button disabled={busy} className="flex items-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#174c3e] disabled:opacity-60">
                  {busy ? "Wird gesendet …" : "Kommentar senden"} <Send size={13} />
                </button>
              </div>
            </form>
            {(feedback || localError) && (
              <p role={localError ? "alert" : "status"} className={`mt-3 rounded-xl px-3.5 py-3 text-xs ${localError ? "bg-[#fff0ed] text-[#aa463c]" : "bg-[#edf6ee] text-forest"}`}>
                {localError || feedback}
              </p>
            )}
            <div className="mt-5 space-y-3">
              {step.comments.length ? step.comments.map((comment) => (
                <article key={comment.id} className="rounded-2xl border border-line bg-white p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#eaf0e8] text-xs font-bold text-forest">
                        {comment.name.trim().slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-ink">{comment.name}</p>
                        <time className="mt-0.5 block text-[10px] text-muted" dateTime={comment.created_at}>
                          {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(comment.created_at))}
                        </time>
                      </div>
                    </div>
                    {isAdmin && (
                      <button onClick={() => removeComment(comment.id)} className="rounded-lg px-2 py-1 text-[10px] font-semibold text-[#a75c53] hover:bg-[#fff0ed]" aria-label={`Kommentar von ${comment.name} löschen`}>Löschen</button>
                    )}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#52615a]">{comment.message}</p>
                </article>
              )) : (
                <div className="rounded-2xl border border-dashed border-[#d9e1d9] bg-[#f6f8f4] px-5 py-7 text-center">
                  <span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-white text-forest"><MessageCircle size={16} /></span>
                  <p className="mt-3 text-sm font-semibold text-ink">Starte den Austausch</p>
                  <p className="mt-1 text-xs text-muted">Teile einen Gedanken zu dieser Phase. Deine Perspektive ist willkommen.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
