import { invoke, isTauri } from "@tauri-apps/api/core";
import "./style.css";

type View = "overview" | "documents" | "research" | "models";
type Language = "fr" | "en";
type PreviewRow = { id: string; title: string; kind: string };
type EngineDiagnostic = { code?: string; message?: string; path?: string; id?: string };
type EvidenceRow = { id: string; title: string; status: string; evidenceCount: number; sourceRefs: string[]; subjectRef: string | null };
type DeclaredContradiction = { claimId: string; targetId: string; targetPresent: boolean };
type ResearchOverview = { contradictionCount: number; contradictions: DeclaredContradiction[]; eventCount: number; sourceCount: number; claimCount: number; unsupportedClaimCount: number; events: EvidenceRow[]; sources: EvidenceRow[]; claims: EvidenceRow[] };
type CanonicalResult = {
  overview: ResearchOverview;
  fileName: string; engineVersion: string; valid: boolean;
  errors: EngineDiagnostic[]; warnings: EngineDiagnostic[]; sha256: string; note: string;
};
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
    validateCanonical: "Valider un corpus TEMPORA", engineResult: "RÉSULTAT DU MOTEUR TEMPORA",
    validCanonical: "Conforme au schéma", invalidCanonical: "Non conforme au schéma",
    enginePending: "Validation par le moteur en cours…", engineUnavailable: "Moteur indisponible",
    workbenchTitle: "Atelier scientifique · dossier en lecture seule", workbenchIntro: "Aperçu structurel des preuves déclarées, sans certification historique.", workbenchEmpty: "Validez d’abord un corpus dans Documents pour charger cet atelier.", workbenchEvidence: "Pièces de preuve déclarées", workbenchNoEvidence: "Assertions sans preuve déclarée", workbenchEvents: "Événements", workbenchSources: "Sources", workbenchClaims: "Assertions", workbenchStatus: "Statut éditorial", workbenchLimited: "Aperçu limité à 20 lignes par collection. Les totaux reflètent le fichier sélectionné.",
    contradictionsTitle: "Contradictions déclarées", contradictionsDescription: "Relations explicitement déclarées par le corpus, sans détection automatique ni évaluation historique.", contradictionsPresent: "Cible présente", contradictionsMissing: "Cible absente ou autre espace de noms", contradictionsSource: "Assertion source", contradictionsTarget: "Assertion cible",
    evidenceLinks: "Références déclarées", evidenceSelect: "Sélectionnez une ligne pour examiner ses références.", evidenceSubject: "Sujet", evidenceSources: "Sources citées", evidenceMissing: "Référence absente de l’aperçu", evidenceNone: "Aucune référence déclarée",
    diagnostics: "diagnostics", sourceReviewNotice: "La conformité au schéma ne prouve pas la véracité des événements.",
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
    validateCanonical: "Validate a TEMPORA corpus", engineResult: "TEMPORA ENGINE RESULT",
    validCanonical: "Schema valid", invalidCanonical: "Schema invalid",
    enginePending: "Engine validation running…", engineUnavailable: "Engine unavailable",
    workbenchTitle: "Scientific workbench · read-only dossier", workbenchIntro: "Structural overview of declared evidence, not historical certification.", workbenchEmpty: "First validate a corpus under Documents to load the workbench.", workbenchEvidence: "Declared evidence items", workbenchNoEvidence: "Claims without declared evidence", workbenchEvents: "Events", workbenchSources: "Sources", workbenchClaims: "Claims", workbenchStatus: "Editorial status", workbenchLimited: "Preview capped at 20 rows per collection. Counts reflect the selected file.",
    contradictionsTitle: "Declared contradictions", contradictionsDescription: "Links explicitly recorded in the corpus, without automated detection or historical assessment.", contradictionsPresent: "Target present", contradictionsMissing: "Target absent or different namespace", contradictionsSource: "Source claim", contradictionsTarget: "Target claim",
    evidenceLinks: "Declared references", evidenceSelect: "Select a row to inspect declared references.", evidenceSubject: "Subject", evidenceSources: "Cited sources", evidenceMissing: "Reference outside preview", evidenceNone: "No declared reference",
    diagnostics: "diagnostics", sourceReviewNotice: "Schema validation does not establish historical truth.",
  },
} as const;

let language: Language = "fr";
let selectedPreview: DocumentPreview | null = null;
let selectedValidation: CanonicalResult | null = null;
let validationBusy = false;

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
  renderValidation();
  renderWorkbench();
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
function renderValidation(): void {
  const result = selectedValidation;
  byId("validation-panel").classList.toggle("hidden", !result);
  if (!result) return;
  fill("validation-title", result.fileName);
  fill("validation-badge", result.valid ? text[language].validCanonical : text[language].invalidCanonical);
  fill("validation-summary", "TEMPORA Engine " + result.engineVersion + " · " + (result.errors.length + result.warnings.length) + " " + text[language].diagnostics);
  fill("validation-digest", "SHA-256 (canonical): " + result.sha256);
  const errors = byId("validation-errors");
  errors.replaceChildren();
  for (const diagnostic of [...result.errors, ...result.warnings].slice(0, 50)) {
    const item = document.createElement("p");
    const path = typeof diagnostic.path === "string" ? diagnostic.path : "";
    const code = typeof diagnostic.code === "string" ? diagnostic.code : "DIAGNOSTIC";
    const message = typeof diagnostic.message === "string" ? diagnostic.message : "";
    item.textContent = code + (path ? " · " + path : "") + (message ? " — " + message : "");
    errors.append(item);
  }
}

function showEvidenceLinks(kind: string, row: EvidenceRow): void {
  const panel = byId("workbench-evidence-detail");
  panel.replaceChildren();
  const heading = document.createElement("h3");
  heading.textContent = kind + " · " + row.id;
  panel.append(heading);
  const overview = selectedValidation?.overview;
  const line = (label: string, ids: string[], rows: EvidenceRow[]) => {
    const paragraph = document.createElement("p");
    const known = new Map(rows.map(item => [item.id, item]));
    paragraph.textContent = label + ": " + (ids.length
      ? ids.map(id => known.has(id) ? id + " — " + known.get(id)!.title : id + " (" + text[language].evidenceMissing + ")").join("; ")
      : text[language].evidenceNone);
    panel.append(paragraph);
  };
  line(text[language].evidenceSubject, row.subjectRef ? [row.subjectRef] : [], overview?.events ?? []);
  line(text[language].evidenceSources, row.sourceRefs, overview?.sources ?? []);
}
function renderWorkbench(): void {
  const result = selectedValidation;
  const panel = byId("workbench-panel");
  panel.classList.toggle("hidden", !result);
  byId("workbench-empty").classList.toggle("hidden", Boolean(result));
  if (!result) byId("workbench-evidence-detail").replaceChildren();
  if (!result) return;
  const overview = result.overview;
  fill("workbench-file", result.fileName + " · TEMPORA " + result.engineVersion);
  fill("workbench-counts", [
    text[language].workbenchEvents + ": " + overview.eventCount,
    text[language].workbenchSources + ": " + overview.sourceCount,
    text[language].workbenchClaims + ": " + overview.claimCount,
    text[language].workbenchNoEvidence + ": " + overview.unsupportedClaimCount,
  ].join(" · "));
  fill("workbench-validation", result.valid ? text[language].validCanonical : text[language].invalidCanonical);
  fill("workbench-contradiction-count", text[language].contradictionsTitle + ": " + overview.contradictionCount);
  const conflicts = byId("workbench-contradictions");
  conflicts.replaceChildren();
  for (const conflict of overview.contradictions) {
    const tr = document.createElement("tr");
    for (const value of [conflict.claimId, conflict.targetId, conflict.targetPresent
      ? text[language].contradictionsPresent : text[language].contradictionsMissing]) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.append(td);
    }
    conflicts.append(tr);
  }
  const kinds: Array<[string, EvidenceRow[]]> = [
    ["workbench-events", overview.events],
    ["workbench-sources", overview.sources],
    ["workbench-claims", overview.claims],
  ];
  for (const [targetId, rows] of kinds) {
    const target = byId(targetId);
    target.replaceChildren();
    for (const row of rows) {
      const tr = document.createElement("tr");
      tr.tabIndex = 0;
      tr.setAttribute("role", "button");
      tr.setAttribute("aria-label", row.id);
      const activate = () => showEvidenceLinks(targetId, row);
      tr.addEventListener("click", activate);
      tr.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); }
      });
      for (const value of [row.id, row.title, row.status, String(row.evidenceCount)]) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.append(td);
      }
      target.append(tr);
    }
  }
}

async function validateCorpus(): Promise<void> {
  if (!isTauri()) { notify(text[language].nativeOnly); return; }
  if (validationBusy) return;
  validationBusy = true;
  const button = byId("validate-corpus") as HTMLButtonElement;
  button.disabled = true;
  notify(text[language].enginePending);
  selectedValidation = null;
  renderValidation();
  renderWorkbench();
  try {
    // Rust opens its own file picker; the WebView never supplies a path or raw bytes.
    const result = await invoke<CanonicalResult | null>("validate_corpus_native");
    if (!result) { notify(text[language].cancelled); return; }
    selectedValidation = result;
    renderValidation();
    renderWorkbench();
    showView("documents");
    notify((result.valid ? text[language].validCanonical : text[language].invalidCanonical) + " · " + result.fileName);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    notify(text[language].engineUnavailable + " : " + message);
  } finally {
    validationBusy = false;
    button.disabled = false;
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
byId("validate-corpus").addEventListener("click", () => void validateCorpus());
localize();
showView("overview");
