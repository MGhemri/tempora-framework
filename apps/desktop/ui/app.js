"use strict";

const MAX_PREVIEW_BYTES = 8 * 1024 * 1024;
const sections = new Set(["home", "files", "roadmap"]);
let currentLanguage = "fr";

function showView(name) {
  if (!sections.has(name)) return;
  document.querySelectorAll(".view").forEach(node => node.classList.toggle("active", node.id === "view-" + name));
  document.querySelectorAll(".navitem").forEach(node => node.classList.toggle("active", node.dataset.view === name));
  document.getElementById("section-label").textContent = "TEMPORA / " + ({home: "Studio", files: "Inspector", roadmap: "Intelligence"})[name];
}

function setLanguage(language) {
  currentLanguage = language === "en" ? "en" : "fr";
  document.documentElement.lang = currentLanguage;
  document.querySelectorAll("[data-fr][data-en]").forEach(node => {
    node.textContent = node.dataset[currentLanguage];
  });
  document.getElementById("language-toggle").textContent = currentLanguage === "fr" ? "EN" : "FR";
}

function describeFile(name, text, extension) {
  if (extension === "json" || extension === "geojson") {
    const parsed = JSON.parse(text);
    const structure = Array.isArray(parsed) ? "array" : parsed && typeof parsed === "object" ? "object" : typeof parsed;
    const keys = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? Object.keys(parsed) : [];
    const collections = keys.filter(key => Array.isArray(parsed[key])).map(key => key + ": " + parsed[key].length);
    return {details: [name, "JSON · " + structure, "Keys: " + (keys.join(", ") || "—"), ...collections].join("\n"), preview: JSON.stringify(parsed, null, 2).slice(0, 12000)};
  }
  if (extension === "csv") {
    const lines = text.split(/\r\n|\n|\r/);
    const header = lines[0] || "";
    return {details: [name, "CSV · raw textual preview only", "Approx. lines: " + lines.length, "Header: " + header.slice(0, 250)].join("\n"), preview: text.slice(0, 12000)};
  }
  throw Error("Unsupported file type");
}

async function inspectFile(file) {
  const output = document.getElementById("file-result"), preview = document.getElementById("file-preview");
  preview.hidden = true;
  preview.textContent = "";
  if (!file) return;
  try {
    const extension = file.name.split(".").pop().toLowerCase();
    if (!["json", "geojson", "csv"].includes(extension)) throw Error("Only JSON, GeoJSON and CSV are accepted");
    if (!file.size || file.size > MAX_PREVIEW_BYTES) throw Error("The file must be between 1 byte and 8 MiB");
    const text = await file.text();
    const info = describeFile(file.name, text, extension);
    output.textContent = info.details;
    preview.textContent = info.preview;
    preview.hidden = false;
  } catch (error) {
    output.textContent = (currentLanguage === "fr" ? "Erreur de prévisualisation : " : "Preview error: ") + error.message;
  }
}

document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => showView(button.dataset.view)));
document.querySelectorAll("[data-nav]").forEach(button => button.addEventListener("click", () => showView(button.dataset.nav)));
document.getElementById("language-toggle").addEventListener("click", () => setLanguage(currentLanguage === "fr" ? "en" : "fr"));
document.getElementById("file-input").addEventListener("change", event => inspectFile(event.target.files?.[0]));

if (window.__TAURI__?.core?.invoke) {
  window.__TAURI__.core.invoke("runtime_info").then(info => {
    document.getElementById("runtime-status").textContent = info.app + " " + info.version + " · " + info.platform;
  }).catch(() => { document.getElementById("runtime-status").textContent = "Native IPC unavailable"; });
}
