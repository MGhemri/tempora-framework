'use strict';
// Minimal IPC API: two named methods; never expose ipcRenderer or filesystem.
const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('temporaElectron', Object.freeze({
  desktopVersion: '0.1.2-beta.3',
  selectDocument: () => ipcRenderer.invoke('tempora:select_document'),
  assistantOpen: () => ipcRenderer.invoke('tempora:assistant:open'),
  assistantInspect: handleId => ipcRenderer.invoke('tempora:assistant:inspect',handleId),
  assistantSelectSheet: (handleId,sheetName) => ipcRenderer.invoke('tempora:assistant:sheet',handleId,sheetName),
  assistantClose: handleId => ipcRenderer.invoke('tempora:assistant:close',handleId),
  assistantSuggest: (handleId,profileId,choice)=>ipcRenderer.invoke('tempora:assistant:suggest',handleId,profileId,choice),
  assistantConfirm: (handleId,token,bindings)=>ipcRenderer.invoke('tempora:assistant:confirm',handleId,token,bindings),
  validateCorpus: () => ipcRenderer.invoke('tempora:validate_corpus_native'),
  copyReviewDraft: (draft) => ipcRenderer.invoke('tempora:copy_review_draft', draft),
  openOfficialLink: (url) => ipcRenderer.invoke('tempora:open-official-link', url),
  openVisualProject: () => ipcRenderer.invoke('tempora:visualization:open'),
  queryVisualProject: (module, offset, limit, facet) => ipcRenderer.invoke('tempora:visualization:query', module, offset, limit, facet),
  closeVisualProject: () => ipcRenderer.invoke('tempora:visualization:close'),
  analyzeVisualProject: (module,limit,threshold) => ipcRenderer.invoke('tempora:visualization:analyze',module,limit,threshold),
  exportVisualProject: (module,format,offset,limit,facet) => ipcRenderer.invoke('tempora:visualization:export',module,format,offset,limit,facet),
  queryGraphNeighborhood: (root,depth,direction,limit) => ipcRenderer.invoke('tempora:visualization:neighborhood',root,depth,direction,limit),
  compareVisualSnapshot: () => ipcRenderer.invoke('tempora:visualization:compare-snapshot'),
  cancelVisualJob: () => ipcRenderer.invoke('tempora:visualization:cancel')
}));
