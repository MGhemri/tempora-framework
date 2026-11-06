import { invoke, isTauri } from "@tauri-apps/api/core";
import "./style.css";

type View = "overview" | "documents" | "research" | "models";
type Language = "fr" | "en";
type PreviewRow = { id: string; title: string; kind: string };
type DocumentPreview = {
  fileName: string;
  format: string;
  bytes: number;
  records: number;
  sources: number;
  assertions: number;
  rows: PreviewRow[];
  note: string;
};

const text = {
  fr: {
    workspace: "ESPACE DE TRAVAIL", overview: "Vue générale", documents: "Documents", research: "Analyses", models: "Modèles IA",
    offline: "Mode local · Aucun envoi réseau", phase: "Phase 0 — Exploration", local: "Espace local",
    lab: "LABORATOIRE NUMÉRIQUE / TEMPORA", hello: "Bienvenue dans votre espace de recherche.",
    intro: "Organisez vos corpus historiques. Explorez la structure de leurs documents sans modifier les originaux.",
    native: "APPLICATION DESKTOP NATIVE", hero: "L'histoire mérite des outils à la hauteur de ses sources.",
    heroDetail: "Un espace scientifique, local et traçable. La validation canonique et l'IA seront raccordées au moteur TEMPORA par étapes vérifiées.",
    open: "Ouvrir un document ↗", activity: "Espace de travail", localOnly: "Stockage exclusivement local",
    records: "Notices identifiées", sources: "Sources repérées", assertions: "Assertions repérées",
    previewOnly: "Aperçu structurel uniquement", notValidated: "Non validées scientifiquement", next: "Prochaines étapes",
    cardOne: "Examiner un document", cardOneText: "Ouvrez un JSON ou GeoJSON local et contrôlez sa structure générale, sans écriture.",
    cardTwo: "Connecter le moteur", cardTwoText: "Validation canonique, ingestion, gouvernance et publication via le SDK TEMPORA.",
    cardThree: "Préparer l'inférence IA", cardThreeText: "Contrats de modèles, journal de provenance et analyse assistée sans décision automatique.",
    explore: "Explorer →", planned: "Prévu",
    docDetail: "Prévisualisation locale en lecture seule. Formats JSON et GeoJSON, maximum 8 Mio.",
    selectTitle: "Explorer une source locale", selectDetail: "Le sélecteur natif ne lit que le fichier choisi. Aucun réseau, aucune modification, aucune indexation permanente.",
    caveat: "L'aperçu ne valide pas le modèle canonique TEMPORA et ne certifie pas les faits historiques.",
    opened: "DOCUMENT SÉLECTIONNÉ", title: "Titre", kind: "Type",
    researchIntro: "Le moteur d'analyse v3 sera intégré ici. Aucun calcul scientifique simulé n'est présenté comme réel.",
    researchSoon: "Connexion au moteur TEMPORA", researchLong: "Prochaine tranche : validation de profil, ingestion avec quarantaine, comparaison d'assertions, suggestions de rapprochement et dossier de revue documentée.",
    modelsIntro: "Espace réservé aux futurs fournisseurs d'inférence, avec séparation stricte entre hypothèses machine et décisions humaines.",
    modelsSoon: "TensorFlow n'est pas encore activé", modelsLong: "Les contrats d'inférence, la version des modèles, les jeux d'évaluation et les journaux de preuve seront développés avant tout téléchargement ou exécution de modèle.",
    nativeOnly: "Le sélecteur natif fonctionne depuis l'application Tauri, pas dans le navigateur.",
    openedFile: "Fichier ouvert en lecture seule", cancelled: "Sélection annulée", failed: "Impossible d'ouvrir le document",
  },
  en: {
    workspace: "WORKSPACE", overview: "Overview", documents: "Documents", research: "Analysis", models: "AI models",
    offline: "Local mode · No network upload", phase: "Phase 0 — Exploration", local: "Local workspace",
    lab: "DIGITAL RESEARCH LAB / TEMPORA", hello: "Welcome to your research workspace.",
    intro: "Organize historical corpora. Explore document structures without modifying their originals.",
    native: "NATIVE DESKTOP APPLICATION", hero: "History deserves tools worthy of its sources.",
    heroDetail: "A scientific, local and traceable workspace. Canonical validation and AI will join TEMPORA in verified stages.",
    open: "Open document ↗", activity: "Workspace", localOnly: "Local storage only",
    records: "Identified records", sources: "Identified sources", assertions: "Identified claims",
    previewOnly: "Structural preview only", notValidated: "Not scientifically validated", next: "Next milestones",
    cardOne: "Inspect a document", cardOneText: "Open a local JSON or GeoJSON and inspect its structure without writing.",
    cardTwo: "Connect the engine", cardTwoText: "Canonical validation, ingestion, review and publication through the TEMPORA SDK.",
    cardThree: "Prepare AI inference", cardThreeText: "Model contracts, provenance journals and human-reviewed machine suggestions.",
    explore: "Explore →", planned: "Planned",
    docDetail: "Read-only local preview. JSON and GeoJSON up to 8 MiB.",
    selectTitle: "Explore a local source", selectDetail: "The native picker reads only the selected file. No network, no modifications, no permanent indexing.",
    caveat: "Preview does not run TEMPORA canonical validation or verify historical facts.",
    opened: "SELECTED DOCUMENT", title: "Title", kind: "Kind",
    researchIntro: "The v3 analysis engine will be integrated here. Simulated scientific results are never presented as real.",
    researchSoon: "TEMPORA engine integration", researchLong: "Next stage: profile validation, quarantined imports, assertion comparison, candidate deduplication and documented review.",
    modelsIntro: "Reserved for future inference providers, keeping model suggestions separate from human decisions.",
    modelsSoon: "TensorFlow is not enabled yet", modelsLong: "Inference contracts, model versions, evaluation datasets and evidence journals will precede downloads or model execution.",
    nativeOnly: "Native file selection works in the Tauri application, not in a regular browser.",
    openedFile: "File opened read-only", cancelled: "Selection cancelled", failed: "Unable to open document",
  },
} as const;

let language: Language = "fr";
let selectedPreview: DocumentPreview | null = null;

function byId(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw new Error("Missing UI element: " + id);
  return found;
}
function fill(id: string, value: string): void {
  byId(id).textContent = value;
}
function formatNumber(value: number): string {
  return new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-US").format(value);
}
function localize(): void {
  document.documentElement.lang = language;
  for (const el of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
    const key = el.dataset.i18n as keyof typeof text.fr;
    el.textContent = text[language][key] ?? key;
  }
  fill("language", language === "fr" ? "EN" : "FR");
  document.querySelectorAll<HTMLButtonElement>(".nav-item").forEach(btn => {
    if (btn.classList.contains("active")) fill("breadcrumb-label", text[language][btn.dataset.view as View]);
  });
  renderPreview();
}
function showView(view: View): void {
  document.querySelectorAll<HTMLElement>(".view").forEach(el => el.classList.toggle("hidden", el.id !== "view-" + view));
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(el => {
    const active = el.dataset.view === view;
    el.classList.toggle("active", active);
    if (el.classList.contains("nav-item")) {
      if (active) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    }
  });
  fill("breadcrumb-label", text[language][view]);
}
function notify(message: string): void {
  const element = byId("notification");
  element.textContent = message;
  element.classList.remove("hidden");
}
function renderPreview(): void {
  const value = selectedPreview;
  fill("metric-records", value ? formatNumber(value.records) : "—");
  fill("metric-sources", value ? formatNumber(value.sources) : "—");
  fill("metric-claims", value ? formatNumber(value.assertions) : "—");
  byId("result-panel").classList.toggle("hidden", !value);
  if (!value) return;
  fill("document-name", value.fileName);
  fill("document-format", value.format);
  fill("document-records", formatNumber(value.records));
  fill("document-sources", formatNumber(value.sources));
  fill("document-claims", formatNumber(value.assertions));
  fill("document-note", text[language].caveat + " · " + formatNumber(value.bytes) + " bytes");
  const target = byId("document-rows");
  target.replaceChildren();
  for (const row of value.rows) {
    const tr = document.createElement("tr");
    for (const cellValue of [row.id, row.title, row.kind]) {
      const td = document.createElement("td");
      td.textContent = cellValue;
      tr.append(td);
    }
    target.append(tr);
  }
}
async function openDocument(): Promise<void> {
  if (!isTauri()) { notify(text[language].nativeOnly); return; }
  try {
    const result = await invoke<DocumentPreview | null>("select_document");
    if (!result) { notify(text[language].cancelled); return; }
    selectedPreview = result;
    renderPreview();
    showView("documents");
    notify(text[language].openedFile + " · " + result.fileName);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    notify(text[language].failed + " : " + message);
  }
}
document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(button => {
  button.addEventListener("click", () => showView(button.dataset.view as View));
});
byId("language").addEventListener("click", () => { language = language === "fr" ? "en" : "fr"; localize(); });
byId("hero-open").addEventListener("click", () => void openDocument());
byId("document-open").addEventListener("click", () => void openDocument());
localize();
showView("overview");
