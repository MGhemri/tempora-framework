import { invokeNative, isNative, copyNativeReviewDraft, openVisualProject, queryVisualProject, visualModules, type VisualModule, type VisualProjection, type VisualProjectInfo, analyzeVisualProject, exportVisualProject, type VisualExportFormat, queryGraphNeighborhood, type VisualTypedRef, type GraphDirection, compareVisualSnapshot, type VisualSnapshotDiff, cancelVisualJob, type VisualFacet } from "./native";
import "./style.css";
import {renderScientificGraphic} from "./visualization/core/render-svg";

type View = "overview" | "documents" | "research" | "models" | "about";
type Language = "fr" | "en";
type PreviewRow = { id: string; title: string; kind: string };
type EngineDiagnostic = { code?: string; message?: string; path?: string; id?: string };
type EvidenceRow = { id: string; title: string; status: string; evidenceCount: number; sourceRefs: string[]; subjectRef: string | null };
type DeclaredContradiction = { claimId: string; targetId: string; targetPresent: boolean };
type ReviewRow = { id: string; subjectId: string; agentType: string; agent: string; method: string; decision: string; reason: string; reviewedAt: string; contentSha256: string };
type ResearchOverview = { reviewCount: number; humanReviewCount: number; reviews: ReviewRow[]; contradictionCount: number; contradictions: DeclaredContradiction[]; eventCount: number; sourceCount: number; claimCount: number; unsupportedClaimCount: number; events: EvidenceRow[]; sources: EvidenceRow[]; claims: EvidenceRow[] };
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
    snapshotTitle:"Comparer deux corpus canoniques",snapshotHelp:"Le second corpus est sélectionné localement. Les chiffres mesurent des données documentées, pas l’exhaustivité historique.",snapshotCompare:"Comparer avec un autre corpus",snapshotCollection:"Collection",snapshotPrevious:"Avant",snapshotCurrent:"Après",snapshotAdded:"Ajouts",snapshotRemoved:"Suppressions",
    graphNavTitle:"Voisinage des relations déclarées",graphNavHelp:"Parcours d’arêtes explicitement déclarées ; aucune relation historique ajoutée.",graphNavRun:"Explorer le voisinage",
    visualExportFormat:"Format d’export",visualExport:"Exporter cette page",
    visualAnalyze:"Exécuter une analyse déterministe",
    visualCancel:"Arrêter les calculs et fermer le projet",
    visualSelectionHeading:"Sélection scientifique commune :",visualClearSelection:"Effacer la sélection",
    facetTitle:"Filtres scientifiques documentaires",facetStatus:"Statut éditorial",facetTemporalMode:"Interprétation temporelle",facetStart:"À partir du",facetEnd:"Jusqu’au",facetApply:"Appliquer les filtres",facetReset:"Effacer les filtres",
    visualTitle:"Exploration scientifique · six laboratoires",visualIntro:"Projections de données déclarées uniquement, en lecture seule et sans conclusions historiques automatiques.",visualOpen:"Ouvrir un corpus pour les laboratoires",visualPrevious:"Précédent",visualNext:"Suivant",visualDisclaimer:"Les cartes, graphes avancés et inférences IA ne sont pas encore exécutés. Aucune vue ne certifie un fait historique.",
    workspace: "ESPACE DE TRAVAIL", overview: "Vue générale", documents: "Documents", research: "Analyses", models: "Modèles IA",
    about: "À propos", aboutIntro: "Un espace de recherche historique local, traçable et reproductible.",
    aboutProduct: "Application", aboutVersion: "Version Desktop", aboutEngine: "Moteur scientifique",
    aboutAuthor: "Auteur / Projet", aboutWebsite: "Site", aboutLicense: "Licence", aboutRepository: "Code source",
    aboutNotice: "La conformité au schéma ne certifie pas la véracité historique. Les décisions de recherche restent humaines.",
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
    draftTitle: "Préparer un brouillon de revue", draftDescription: "Brouillon non canonique, non signé, non approuvé. Copie manuelle uniquement : aucun corpus n’est modifié.", draftReviewer: "Nom du chercheur", draftSubject: "Identifiant de l’élément examiné", draftMethod: "Méthode de revue", draftReason: "Justification et références des sources", draftCopy: "Copier le brouillon JSON", draftMissing: "Complète tous les champs et valide d’abord un corpus conforme.", draftCopied: "Brouillon JSON copié — non approuvé", draftCopyFailed: "Impossible de copier le brouillon",
    reviewsTitle: "Dossiers de revue", reviewsSummary: "Revues enregistrées", humanReviews: "Revues explicitement humaines", reviewAgent: "Auteur / Type", reviewMethod: "Méthode", reviewDecision: "Décision déclarée", reviewSubject: "Sujet examiné", reviewReason: "Justification", reviewDate: "Date", reviewHash: "Empreinte du contenu", reviewNoClaims: "Aucune revue enregistrée dans ce corpus", reviewsDisclaimer: "Lecture des décisions déclarées uniquement : aucune approbation, création ou modification.",
    contradictionsTitle: "Contradictions déclarées", contradictionsDescription: "Relations explicitement déclarées par le corpus, sans détection automatique ni évaluation historique.", contradictionsPresent: "Cible présente", contradictionsMissing: "Cible absente ou autre espace de noms", contradictionsSource: "Assertion source", contradictionsTarget: "Assertion cible",
    evidenceLinks: "Références déclarées", evidenceSelect: "Sélectionnez une ligne pour examiner ses références.", evidenceSubject: "Sujet", evidenceSources: "Sources citées", evidenceMissing: "Référence absente de l’aperçu", evidenceNone: "Aucune référence déclarée",
    diagnostics: "diagnostics", sourceReviewNotice: "La conformité au schéma ne prouve pas la véracité des événements.",
  },
  en: {
    snapshotTitle:"Compare canonical corpus snapshots",snapshotHelp:"Select a second local corpus. Counts measure documented data, not historical completeness.",snapshotCompare:"Compare with another corpus",snapshotCollection:"Collection",snapshotPrevious:"Before",snapshotCurrent:"After",snapshotAdded:"Added",snapshotRemoved:"Removed",
    graphNavTitle:"Declared-relation neighborhood",graphNavHelp:"Traverses explicitly declared edges; no historical relationship is inferred.",graphNavRun:"Explore neighborhood",
    visualExportFormat:"Export format",visualExport:"Export current page",
    visualAnalyze:"Run deterministic analysis",
    visualCancel:"Stop calculations and close project",
    visualSelectionHeading:"Shared scientific selection:",visualClearSelection:"Clear selection",
    facetTitle:"Scientific documentary filters",facetStatus:"Editorial status",facetTemporalMode:"Temporal interpretation",facetStart:"From",facetEnd:"Until",facetApply:"Apply filters",facetReset:"Clear filters",
    visualTitle:"Scientific exploration · six labs",visualIntro:"Read-only projections of declared records only, without automatic historical conclusions.",visualOpen:"Open corpus for research laboratories",visualPrevious:"Previous",visualNext:"Next",visualDisclaimer:"Advanced maps, graph layouts and AI inference are not enabled. No view certifies historical facts.",
    workspace: "WORKSPACE", overview: "Overview", documents: "Documents", research: "Analysis", models: "AI models",
    about: "About", aboutIntro: "A local, traceable and reproducible historical research workspace.",
    aboutProduct: "Application", aboutVersion: "Desktop version", aboutEngine: "Scientific engine",
    aboutAuthor: "Author / Project", aboutWebsite: "Website", aboutLicense: "License", aboutRepository: "Source code",
    aboutNotice: "Schema conformity does not certify historical truth. Research decisions remain human.",
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
    draftTitle: "Prepare a review draft", draftDescription: "Non-canonical, unsigned, unapproved draft. Manual copy only: no corpus is modified.", draftReviewer: "Researcher name", draftSubject: "Reviewed record ID", draftMethod: "Review method", draftReason: "Rationale and source references", draftCopy: "Copy draft JSON", draftMissing: "Fill in all fields and first validate a conformant corpus.", draftCopied: "Draft JSON copied — not approved", draftCopyFailed: "Unable to copy the draft",
    reviewsTitle: "Review dossiers", reviewsSummary: "Recorded reviews", humanReviews: "Explicit human reviews", reviewAgent: "Reviewer / Type", reviewMethod: "Method", reviewDecision: "Declared decision", reviewSubject: "Subject", reviewReason: "Reason", reviewDate: "Date", reviewHash: "Content digest", reviewNoClaims: "No review records in this corpus", reviewsDisclaimer: "Read-only declared decisions: no approval, creation or modification.",
    contradictionsTitle: "Declared contradictions", contradictionsDescription: "Links explicitly recorded in the corpus, without automated detection or historical assessment.", contradictionsPresent: "Target present", contradictionsMissing: "Target absent or different namespace", contradictionsSource: "Source claim", contradictionsTarget: "Target claim",
    evidenceLinks: "Declared references", evidenceSelect: "Select a row to inspect declared references.", evidenceSubject: "Subject", evidenceSources: "Cited sources", evidenceMissing: "Reference outside preview", evidenceNone: "No declared reference",
    diagnostics: "diagnostics", sourceReviewNotice: "Schema validation does not establish historical truth.",
  },
} as const;

let language: Language = "fr";
let selectedPreview: DocumentPreview | null = null;
let selectedValidation: CanonicalResult | null = null;
let validationBusy = false;
let visualInfo:VisualProjectInfo|null=null;
let visualModule:VisualModule="chronos";
let visualOffset=0;
let visualProjection:VisualProjection|null=null;
let visualAnalysis:VisualProjection|null=null;
let graphNavigation:VisualProjection|null=null;
let visualSnapshot:VisualSnapshotDiff|null=null;
let visualBusy=false;
let visualSequence=0;
let selectedVisualRef:VisualTypedRef|null=null;
const visualRefKinds=new Set(["event","source","claim","entity","spatial","relation","review","assessment","release"]);
function validVisualRef(value:unknown):value is VisualTypedRef{
  if(!value||typeof value!=="object"||Array.isArray(value))return false;
  const input=value as Record<string,unknown>;
  return Object.keys(input).length===3&&visualRefKinds.has(String(input.kind))&&
    [input.namespace,input.id].every(x=>typeof x==="string"&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(x));
}
function visualRefKey(value:VisualTypedRef):string{return JSON.stringify([value.kind,value.namespace,value.id]);}
function selectVisualRef(value:unknown):void{
  if(!validVisualRef(value)||!visualInfo)return;
  selectedVisualRef={kind:value.kind,namespace:value.namespace,id:value.id};
  renderVisual();
}
let visualCancelVersion=0;
let visualCancelling=false;
type FacetMode="possible-overlap"|"certain-only"|"declared-start";
type FacetStatus="proposed"|"under_review"|"published"|"withdrawn"|"unspecified";
let activeFacetForm:{status:FacetStatus|null;mode:FacetMode;earliest:string;latest:string}|null=null;
function effectiveFacets(module:VisualModule):VisualFacet|null{
  if(!activeFacetForm)return null;
  const f:VisualFacet={};
  if(activeFacetForm.status)f.statuses=[activeFacetForm.status];
  if(activeFacetForm.earliest&&activeFacetForm.latest&&(module==="chronos"||module==="graph"))
    f.time={mode:activeFacetForm.mode,earliest:activeFacetForm.earliest,latest:activeFacetForm.latest};
  return Object.keys(f).length?f:null;
}
function clearFacetInputs():void{
  (byId("visual-facet-status") as HTMLSelectElement).value="";
  (byId("visual-facet-mode") as HTMLSelectElement).value="possible-overlap";
  (byId("visual-facet-from") as HTMLInputElement).value="";
  (byId("visual-facet-to") as HTMLInputElement).value="";
}




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
  renderVisual();
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
  fill("workbench-review-count", text[language].reviewsSummary + ": " + overview.reviewCount
    + " · " + text[language].humanReviews + ": " + overview.humanReviewCount);
  const reviews = byId("workbench-reviews");
  reviews.replaceChildren();
  for (const review of overview.reviews) {
    const tr = document.createElement("tr");
    for (const value of [
      review.id, review.subjectId, review.agentType + " / " + review.agent,
      review.method, review.decision, review.reason, review.reviewedAt, review.contentSha256
    ]) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.append(td);
    }
    reviews.append(tr);
  }
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

// An intentionally NON-CANONICAL review draft. This function does not issue a
// scientific approval, save data, or modify the original corpus.
function buildReviewDraft(): Record<string, unknown> | null {
  const result = selectedValidation;
  if (!result?.valid) return null;
  const field = (id: string) => (byId(id) as HTMLInputElement | HTMLTextAreaElement).value.trim();
  const reviewer = field("draft-reviewer");
  const subjectId = field("draft-subject");
  const method = field("draft-method");
  const reason = field("draft-reason");
  if (!reviewer || !subjectId || !method || !reason) return null;
  const identifiers = [
    ...result.overview.events, ...result.overview.sources,
    ...result.overview.claims,
  ].map(item => item.id);
  if (!identifiers.includes(subjectId)) return null;
  return {
    document_type: "tempora.review_draft",
    draft_schema_version: "1.0.0",
    status: "draft",
    approved: false,
    signed: false,
    target: { id: subjectId, corpus_sha256: result.sha256 },
    reviewer,
    method,
    rationale: reason,
    engine_version: result.engineVersion,
    notice: "This is a researcher-authored draft, NOT a canonical TEMPORA review, approval or publication.",
  };
}

async function copyReviewDraft(): Promise<void> {
  const draft = buildReviewDraft();
  if (!draft) { notify(text[language].draftMissing); return; }
  try {
    await copyNativeReviewDraft(JSON.stringify(draft, null, 2));
    notify(text[language].draftCopied);
  } catch {
    notify(text[language].draftCopyFailed);
  }
}

async function validateCorpus(): Promise<void> {
  if (!isNative()) { notify(text[language].nativeOnly); return; }
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
    const result = await invokeNative<CanonicalResult | null>("validate_corpus_native");
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
  if (!isNative()) { notify(text[language].nativeOnly); return; }
  try {
    const result = await invokeNative<DocumentPreview | null>("select_document");
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

function renderVisual():void {
  const info=visualInfo;
  const filtered=activeFacetForm!==null;
  const datesIgnored=filtered&&Boolean(activeFacetForm?.earliest)&&
    visualModule!=="chronos"&&visualModule!=="graph";
  byId("visual-facet-note").textContent=filtered
    ? datesIgnored
      ? (language==="fr"
        ?"Filtre temporel conservé mais non appliqué ici (uniquement Chronos et GraphLab). Analyses, exports et comparaison désactivés pendant le filtrage."
        :"Time filter retained but not applied here (Chronos and GraphLab only). Analyses, exports and comparison disabled while filtering.")
      : (language==="fr"
        ?"Vue filtrée, paramètres présents dans le SHA scientifique. Analyses et exports désactivés jusqu'à leur prise en charge explicite."
        :"Filtered view: parameters included in scientific SHA. Analysis and export disabled until explicitly supported.")
    : (language==="fr"?"Aucun filtre actif.":"No active filters.");
  for(const id of ["visual-facet-apply","visual-facet-reset"]){
    (byId(id) as HTMLButtonElement).disabled=visualBusy||!info;
  }
  byId("visual-typed-selection-value").textContent=selectedVisualRef?visualRefKey(selectedVisualRef):"—";
  (byId("visual-clear-selection") as HTMLButtonElement).disabled=!selectedVisualRef;
  byId("visual-session").textContent=info
    ? info.fileName+" · "+info.profile_id+" · SHA-256 "+info.canonical_sha256
    : (language==="fr"?"Aucun projet de recherche ouvert.":"No research project open.");
  document.querySelectorAll<HTMLButtonElement>("[data-visual-module]").forEach(b=>{
    const active=b.dataset.visualModule===visualModule;
    b.classList.toggle("active",active);
    b.setAttribute("aria-pressed",String(active));
    b.disabled=visualBusy||!info;
  });
  renderScientificGraphic(byId("visual-graphic"),visualModule,visualProjection?.result??[]);
  const snapshotPanel=byId("visual-snapshot-panel");
  snapshotPanel.classList.toggle("hidden",visualModule!=="observatory");
  const snapshotRows=byId("visual-snapshot-rows");snapshotRows.replaceChildren();
  if(visualSnapshot&&visualModule==="observatory"){
    for(const item of visualSnapshot.rows){
      const tr=document.createElement("tr");
      for(const value of [item.collection,item.previous,item.current,item.delta,item.added_ids,item.removed_ids]){
        const td=document.createElement("td");td.textContent=String(value);tr.append(td);
      }
      snapshotRows.append(tr);
    }
  }
  byId("visual-snapshot-status").textContent=visualSnapshot&&visualModule==="observatory"
    ? visualSnapshot.fileName+" · "+visualSnapshot.previous.canonical_sha256+" / "+
      visualSnapshot.current.canonical_sha256+" · SCI SHA-256 "+visualSnapshot.scientific_sha256+
      " · historical completeness: unknown":"";
  (byId("visual-snapshot-compare") as HTMLButtonElement).disabled=visualBusy||!visualInfo||filtered;
  const graphPanel=byId("visual-graph-navigation");
  graphPanel.classList.toggle("hidden",visualModule!=="graph");
  const graphRows=byId("graph-nav-rows");graphRows.replaceChildren();
  if(graphNavigation&&visualModule==="graph"){
    for(const item of graphNavigation.result){
      const tr=document.createElement("tr");
      const edge=document.createElement("td");
      const path=document.createElement("td");
      edge.textContent=JSON.stringify(item.relation);
      path.textContent=JSON.stringify({source:item.source,target:item.target,
        depth:item.depth,direction:item.traversal_direction});
      tr.append(edge,path);graphRows.append(tr);
    }
  }
  byId("graph-nav-summary").textContent=graphNavigation&&visualModule==="graph"
    ?"BFS · "+graphNavigation.scope.returned+"/"+graphNavigation.scope.total_matched+
      (graphNavigation.scope.truncated?" · PARTIAL":"")+
      " · SHA-256 "+graphNavigation.scientific_sha256:"";
  (byId("graph-navigate") as HTMLButtonElement).disabled=visualBusy||!visualInfo||filtered;
  const analysisRows=byId("visual-analysis-rows");analysisRows.replaceChildren();
  if(visualAnalysis){
    for(const item of visualAnalysis.result){
      const row=document.createElement("tr");
      const cell=document.createElement("td");
      const code=document.createElement("code");
      code.textContent=JSON.stringify(item);cell.append(code);row.append(cell);
      analysisRows.append(row);
    }
  }
  byId("visual-analysis-note").textContent=visualAnalysis
    ? (language==="fr"?"Analyse dérivée, non canonique":"Derived, noncanonical analysis")+
      " · "+visualAnalysis.scope.returned+"/"+visualAnalysis.scope.total_matched+
      (visualAnalysis.scope.truncated?" · PARTIAL":"")+
      " · "+visualAnalysis.scientific_sha256
    : "";
  (byId("visual-analyze") as HTMLButtonElement).disabled=visualBusy||!visualInfo||filtered;
  (byId("visual-export") as HTMLButtonElement).disabled=visualBusy||!visualProjection||filtered;
  const exportSelect=byId("visual-export-format") as HTMLSelectElement;
  exportSelect.disabled=visualBusy||!visualInfo||filtered;
  for(const option of exportSelect.options){
    option.disabled=(option.value==="geojson"&&visualModule!=="geo")||
      (option.value==="graphml"&&visualModule!=="graph");
  }
  if(exportSelect.selectedOptions[0]?.disabled)exportSelect.value="json";
  const rows=byId("visual-rows");rows.replaceChildren();
  const result=visualProjection;
  if(result){
    for(const item of result.result){
      const tr=document.createElement("tr");
      const identity=item.ref as {kind?:string;namespace?:string;id?:string}|null;
      const ref=document.createElement("td");
      ref.textContent=identity?JSON.stringify([identity.kind,identity.namespace,identity.id]):"—";
      const details=document.createElement("td");
      const json=document.createElement("code");
      json.textContent=JSON.stringify(item);
      details.append(json);tr.append(ref,details);
      const rowRef=item.ref;
      if(validVisualRef(rowRef)){
        tr.tabIndex=0;tr.setAttribute("role","button");
        tr.setAttribute("aria-label",visualRefKey(rowRef));
        tr.setAttribute("aria-pressed",String(selectedVisualRef!==null&&
          visualRefKey(selectedVisualRef)===visualRefKey(rowRef)));
        const choose=()=>selectVisualRef(rowRef);
        tr.addEventListener("click",choose);
        tr.addEventListener("keydown",event=>{
          if(event.key==="Enter"||event.key===" "){event.preventDefault();choose();}
        });
      }
      rows.append(tr);
    }
  }
  byId("visual-diagnostics").textContent=result
    ? visualModule+" · "+result.scope.returned+"/"+result.scope.total_matched+
      (result.scope.truncated?" · PARTIAL / PARTIEL":"")+" · "+result.scientific_sha256
    : (language==="fr"?"Sélectionnez un corpus valide TEMPORA v3.":"Select a valid TEMPORA v3 corpus.");
  byId("visual-page").textContent=result
    ? String(visualOffset+1)+"–"+String(visualOffset+result.scope.returned)+" / "+String(result.scope.total_matched)
    :"—";
  (byId("visual-previous") as HTMLButtonElement).disabled=visualBusy||!info||visualOffset===0;
  (byId("visual-next") as HTMLButtonElement).disabled=visualBusy||!info||!result||
    visualOffset+result.scope.returned>=result.scope.total_matched||result.scope.returned===0;
  (byId("visual-open") as HTMLButtonElement).disabled=visualBusy||!window.temporaElectron;
  (byId("visual-cancel") as HTMLButtonElement).disabled=visualCancelling||(!visualBusy&&!info)||!window.temporaElectron;
}
async function loadVisual():Promise<void> {
  if(!visualInfo||visualBusy)return;
  const seq=++visualSequence,version=visualCancelVersion;visualBusy=true;renderVisual();
  try{
    const result=await queryVisualProject(visualModule,visualOffset,50,effectiveFacets(visualModule));
    if(seq!==visualSequence||version!==visualCancelVersion)return;
    if(result.corpus.canonical_sha256!==visualInfo.canonical_sha256)throw Error("STALE_CORPUS");
    visualProjection=result;
  }catch(error){
    if(version===visualCancelVersion){
      visualProjection=null;
      notify(error instanceof Error?error.message:String(error));
    }
  }finally{if(version===visualCancelVersion){visualBusy=false;renderVisual();}}
}
async function openVisual():Promise<void>{
  if(visualBusy)return;
  const version=visualCancelVersion;
  visualBusy=true;renderVisual();
  try{
    const info=await openVisualProject();
    if(!info||version!==visualCancelVersion)return;
    visualInfo=info;visualOffset=0;visualProjection=null;visualAnalysis=null;graphNavigation=null;visualSnapshot=null;selectedVisualRef=null;activeFacetForm=null;clearFacetInputs();visualModule="chronos";
  }catch(error){if(version===visualCancelVersion)notify(error instanceof Error?error.message:String(error));}
  finally{if(version===visualCancelVersion){visualBusy=false;renderVisual();}}
  if(version===visualCancelVersion&&visualInfo)await loadVisual();
}

document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(button => {
  button.addEventListener("click", () => showView(button.dataset.view as View));
});
byId("language").addEventListener("click", () => { language = language === "fr" ? "en" : "fr"; localize(); });
byId("hero-open").addEventListener("click", () => void openDocument());
byId("document-open").addEventListener("click", () => void openDocument());
byId("validate-corpus").addEventListener("click", () => void validateCorpus());
byId("draft-copy").addEventListener("click", () => void copyReviewDraft());
byId("visual-open").addEventListener("click",()=>void openVisual());
byId("visual-facet-apply").addEventListener("click",()=>{
  if(visualBusy||!visualInfo)return;
  const status=(byId("visual-facet-status") as HTMLSelectElement).value as FacetStatus|"";
  const mode=(byId("visual-facet-mode") as HTMLSelectElement).value as FacetMode;
  const earliest=(byId("visual-facet-from") as HTMLInputElement).value;
  const latest=(byId("visual-facet-to") as HTMLInputElement).value;
  if(Boolean(earliest)!==Boolean(latest)||Boolean(earliest&&latest&&earliest>latest)){
    notify(language==="fr"?"Intervalle de dates incomplet ou inversé.":"Date interval incomplete or inverted.");
    return;
  }
  if(!status&&!earliest){activeFacetForm=null;}
  else activeFacetForm={status:status||null,mode,earliest,latest};
  visualOffset=0;visualProjection=null;visualAnalysis=null;graphNavigation=null;visualSnapshot=null;
  void loadVisual();
});
byId("visual-facet-reset").addEventListener("click",()=>{
  if(visualBusy||!visualInfo)return;
  activeFacetForm=null;clearFacetInputs();visualOffset=0;visualProjection=null;
  visualAnalysis=null;graphNavigation=null;visualSnapshot=null;
  void loadVisual();
});
byId("visual-clear-selection").addEventListener("click",()=>{selectedVisualRef=null;renderVisual();});
byId("visual-cancel").addEventListener("click",async()=>{
  if(visualCancelling)return;
  ++visualCancelVersion;
  ++visualSequence;
  visualInfo=null;visualProjection=null;visualAnalysis=null;
  graphNavigation=null;visualSnapshot=null;selectedVisualRef=null;activeFacetForm=null;clearFacetInputs();visualOffset=0;visualCancelling=true;visualBusy=true;
  renderVisual();
  try{
    await cancelVisualJob();
    notify(language==="fr"?"Calcul interrompu. Session locale fermée.":"Calculation stopped. Local session closed.");
  }catch(error){notify(error instanceof Error?error.message:String(error));}
  finally{visualCancelling=false;visualBusy=false;renderVisual();}
});
document.querySelectorAll<HTMLButtonElement>("[data-visual-module]").forEach(button=>button.addEventListener("click",()=>{
  const module=button.dataset.visualModule as VisualModule;
  if(!visualModules.includes(module)||!visualInfo||visualBusy)return;
  visualModule=module;
  if(module==="graph"&&selectedVisualRef){
    (byId("graph-kind") as HTMLInputElement).value=selectedVisualRef.kind;
    (byId("graph-namespace") as HTMLInputElement).value=selectedVisualRef.namespace;
    (byId("graph-id") as HTMLInputElement).value=selectedVisualRef.id;
  }
  visualOffset=0;visualProjection=null;visualAnalysis=null;graphNavigation=null;visualSnapshot=null;void loadVisual();
}));
byId("visual-snapshot-compare").addEventListener("click",async()=>{
  if(visualBusy||!visualInfo||visualModule!=="observatory")return;
  const baseline=visualInfo.canonical_sha256;
  visualBusy=true;visualSnapshot=null;renderVisual();
  try{
    const result=await compareVisualSnapshot();
    if(result){
      if(result.previous.canonical_sha256!==baseline)throw Error("STALE_CORPUS");
      visualSnapshot=result;
    }
  }catch(error){notify(error instanceof Error?error.message:String(error));}
  finally{visualBusy=false;renderVisual();}
});
byId("graph-navigate").addEventListener("click",async()=>{
  if(visualBusy||!visualInfo||visualModule!=="graph")return;
  const value=(id:string)=>(byId(id) as HTMLInputElement).value.trim();
  const root:VisualTypedRef={kind:value("graph-kind"),namespace:value("graph-namespace"),id:value("graph-id")};
  const depth=Number((byId("graph-depth") as HTMLSelectElement).value);
  const direction=(byId("graph-direction") as HTMLSelectElement).value as GraphDirection;
  visualBusy=true;graphNavigation=null;renderVisual();
  try{
    const found=await queryGraphNeighborhood(root,depth,direction,50);
    if(found.corpus.canonical_sha256!==visualInfo.canonical_sha256)throw Error("STALE_CORPUS");
    graphNavigation=found;
  }catch(error){notify(error instanceof Error?error.message:String(error));}
  finally{visualBusy=false;renderVisual();}
});
byId("visual-export").addEventListener("click",async()=>{
  if(visualBusy||!visualInfo||!visualProjection)return;
  const format=(byId("visual-export-format") as HTMLSelectElement).value as VisualExportFormat;
  visualBusy=true;renderVisual();
  try{
    const receipt=await exportVisualProject(visualModule,format,visualOffset,50);
    if(receipt)notify((language==="fr"?"Export enregistré : ":"Export saved: ")+receipt.fileName+
      " · SHA-256 "+receipt.sha256+(receipt.partial?" · PARTIAL":""));
  }catch(error){notify(error instanceof Error?error.message:String(error));}
  finally{visualBusy=false;renderVisual();}
});
byId("visual-analyze").addEventListener("click",async()=>{
  if(visualBusy||!visualInfo)return;
  visualBusy=true;visualAnalysis=null;renderVisual();
  try{
    const result=await analyzeVisualProject(visualModule,50,0.6);
    if(result.corpus.canonical_sha256!==visualInfo.canonical_sha256)throw Error("STALE_CORPUS");
    visualAnalysis=result;
  }catch(error){notify(error instanceof Error?error.message:String(error));}
  finally{visualBusy=false;renderVisual();}
});
byId("visual-previous").addEventListener("click",()=>{
  if(visualBusy||visualOffset===0)return;
  visualOffset=Math.max(0,visualOffset-50);void loadVisual();
});
byId("visual-next").addEventListener("click",()=>{
  if(visualBusy||!visualProjection||visualOffset+visualProjection.scope.returned>=visualProjection.scope.total_matched)return;
  visualOffset+=50;void loadVisual();
});
for (const link of document.querySelectorAll<HTMLAnchorElement>("#view-about a")) {
  link.addEventListener("click", event => {
    if (!window.temporaElectron) return;
    event.preventDefault();
    void window.temporaElectron.openOfficialLink(link.href).catch(() => notify(text[language].failed));
  });
}
localize();
if (window.temporaElectron) {
  const version = window.temporaElectron.desktopVersion;
  const edition = document.querySelector(".edition");
  const sidebarVersion = document.querySelector(".sidebar-bottom p b");
  if (edition) edition.textContent = `${version} / BETA`;
  if (sidebarVersion) sidebarVersion.textContent = `Desktop ${version}`;
  const aboutVersion = document.getElementById("about-desktop-version");
  if (aboutVersion) aboutVersion.textContent = version;
}
renderVisual();
showView("overview");
