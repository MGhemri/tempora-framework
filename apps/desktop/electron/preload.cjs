'use strict';
// Minimal IPC API: two named methods; never expose ipcRenderer or filesystem.
const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('temporaElectron', Object.freeze({
  desktopVersion: '0.1.1-beta.2',
  selectDocument: () => ipcRenderer.invoke('tempora:select_document'),
  validateCorpus: () => ipcRenderer.invoke('tempora:validate_corpus_native'),
  copyReviewDraft: (draft) => ipcRenderer.invoke('tempora:copy_review_draft', draft),
  openOfficialLink: (url) => ipcRenderer.invoke('tempora:open-official-link', url)
}));
