export const siteConfig = {
  name: "BigBand 2027 Content",
  tagline:
    "Marketing, Content-Produktion und Konzertdokumentation – vom Konzept bis zum Konzert im März 2027.",
  subtitle:
    "Ein gemeinsamer Produktionsplan für die Vermarktung und Dokumentation unserer Bigbandkonzerte.",
  logo: "/images/mark.svg",
  heroImage: "/images/custom-project-hero.jpg",
  timelineLabel: "November 2026 – März 2027",
  colors: {
    primary: "#803900",
    secondary: "#efbd58",
    background: "#faf7f2",
    text: "#30251f",
    muted: "#83786e",
    accent: "#efe2d3",
    line: "#ebe3da",
    traffic: {
      green: "#2e9b69",
      yellow: "#e6a832",
      red: "#e76d5e",
    },
  },
};

export type RoadmapStepConfig = {
  id: string;
  title: string;
  description: string;
  month: number;
  year: number;
  order: number;
  icon: "compass" | "layers" | "sparkles" | "rocket" | "flag";
};

export const roadmapSteps: RoadmapStepConfig[] = [
  {
    id: "discovery",
    title: "Strategie & Leitidee",
    description:
      "Wir schärfen Zielgruppen, Konzertprofil und zentrale Botschaften. Daraus entwickeln wir die inhaltliche Leitidee für Marketing und Dokumentation.",
    month: 11,
    year: 2026,
    order: 1,
    icon: "compass",
  },
  {
    id: "foundations",
    title: "Redaktions- & Produktionsplanung",
    description:
      "Wir planen Kanäle, Formate, Veröffentlichungen und Zuständigkeiten. Gleichzeitig legen wir fest, welche Geschichten, Interviews und Konzertmomente dokumentiert werden.",
    month: 12,
    year: 2026,
    order: 2,
    icon: "layers",
  },
  {
    id: "prototype",
    title: "Content-Produktion & Probenstories",
    description:
      "Wir produzieren Texte, Bildmaterial und erste Videoformate. Proben, Ensemble und Vorbereitung liefern authentische Einblicke für die laufende Kommunikation.",
    month: 1,
    year: 2027,
    order: 3,
    icon: "sparkles",
  },
  {
    id: "build",
    title: "Kampagne & Konzertvorbereitung",
    description:
      "Die Konzertkampagne geht über die vereinbarten Kanäle in die Veröffentlichung. Wir stimmen Presse- und Publikumsinformationen ab und finalisieren Ablauf, Technik und Dokumentationsplan.",
    month: 2,
    year: 2027,
    order: 4,
    icon: "rocket",
  },
  {
    id: "launch",
    title: "Konzert, Live-Kommunikation & Dokumentation",
    description:
      "Im März 2027 begleiten wir die Konzerte mit aktueller Kommunikation und halten prägende Momente in Bild und Video fest. Im Anschluss bereiten wir Rückblick und Dokumentation für Publikum und Ensemble auf.",
    month: 3,
    year: 2027,
    order: 5,
    icon: "flag",
  },
];

export type TrafficStatus = "green" | "yellow" | "red";

export const statusLabels: Record<TrafficStatus, string> = {
  green: "Im Plan",
  yellow: "Im Blick behalten",
  red: "Kritisch",
};
