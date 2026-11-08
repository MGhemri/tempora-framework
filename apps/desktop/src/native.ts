import {invoke as tauriInvoke, isTauri} from "@tauri-apps/api/core";

declare global {
  interface Window {
    temporaElectron?: {
      desktopVersion: string;
      selectDocument: () => Promise<unknown>;
      validateCorpus: () => Promise<unknown>;
      copyReviewDraft: (draft: string) => Promise<boolean>;
      openOfficialLink: (url: string) => Promise<boolean>;
      openVisualProject: () => Promise<unknown>;
      queryVisualProject: (module: string, offset: number, limit: number) => Promise<unknown>;
      closeVisualProject: () => Promise<boolean>;
      analyzeVisualProject: (module: string,limit: number,threshold: number) => Promise<unknown>;
      exportVisualProject: (module:string,format:string,offset:number,limit:number)=>Promise<unknown>;
      queryGraphNeighborhood:(root:VisualTypedRef,depth:number,direction:string,limit:number)=>Promise<unknown>;
      compareVisualSnapshot:()=>Promise<unknown>;
    };
  }
}

export function isNative(): boolean {
  return Boolean(window.temporaElectron) || isTauri();
}

// Two fixed commands only. The renderer can never select an executable,
// filesystem path, shell command, or arbitrary IPC channel.
export async function invokeNative<T>(command: "select_document" | "validate_corpus_native"): Promise<T> {
  if (window.temporaElectron) {
    const response = command === "select_document"
      ? await window.temporaElectron.selectDocument()
      : await window.temporaElectron.validateCorpus();
    return response as T;
  }
  return tauriInvoke<T>(command);
}

/** Electron's sandbox clipboard uses an audited, bounded, noncanonical IPC bridge. */
export async function copyNativeReviewDraft(draft: string): Promise<void> {
  if (window.temporaElectron) {
    await window.temporaElectron.copyReviewDraft(draft);
    return;
  }
  await navigator.clipboard.writeText(draft);
}

/** Currently supported only on the qualified Electron Windows host.
 * Tauri remains on the existing read-only workbench until its native
 * project/session authority receives independent security qualification.
 */
export const visualModules = ["geo","graph","chronos","evidence","pattern","observatory"] as const;
export type VisualModule = typeof visualModules[number];
export type VisualProjectInfo = {fileName:string;canonical_sha256:string;profile_id:string;engine_version:string;expires_in_ms:number};
export type VisualProjection = {
  projection_schema_version:string;scientific_sha256:string;
  scope:{total_matched:number;returned:number;truncated:boolean};
  result:Array<Record<string,unknown>>;
  corpus:{canonical_sha256:string;profile_id:string};
};
export async function openVisualProject():Promise<VisualProjectInfo|null>{
  if(!window.temporaElectron)throw Error("VISUAL_ELECTRON_ONLY");
  return await window.temporaElectron.openVisualProject() as VisualProjectInfo|null;
}
export async function queryVisualProject(module:VisualModule,offset=0,limit=50):Promise<VisualProjection>{
  if(!window.temporaElectron)throw Error("VISUAL_ELECTRON_ONLY");
  return await window.temporaElectron.queryVisualProject(module,offset,limit) as VisualProjection;
}
export async function closeVisualProject():Promise<void>{
  if(window.temporaElectron)await window.temporaElectron.closeVisualProject();
}

export async function analyzeVisualProject(module:VisualModule,limit=50,threshold=0.6):Promise<VisualProjection>{
  if(!window.temporaElectron)throw Error("VISUAL_ELECTRON_ONLY");
  return await window.temporaElectron.analyzeVisualProject(module,limit,threshold) as VisualProjection;
}

export type VisualExportFormat="json"|"geojson"|"csv"|"graphml";
export type VisualExportReceipt={fileName:string;sha256:string;bytes:number;partial:boolean};
export async function exportVisualProject(module:VisualModule,format:VisualExportFormat,offset=0,limit=50)
  :Promise<VisualExportReceipt|null>{
  if(!window.temporaElectron)throw Error("VISUAL_ELECTRON_ONLY");
  return await window.temporaElectron.exportVisualProject(module,format,offset,limit) as VisualExportReceipt|null;
}

export type VisualTypedRef={kind:string;namespace:string;id:string};
export type GraphDirection="in"|"out"|"both";
export async function queryGraphNeighborhood(root:VisualTypedRef,depth=1,direction:GraphDirection="both",limit=50)
  :Promise<VisualProjection>{
  if(!window.temporaElectron)throw Error("VISUAL_ELECTRON_ONLY");
  return await window.temporaElectron.queryGraphNeighborhood(root,depth,direction,limit) as VisualProjection;
}

export type VisualSnapshotDiff={
  fileName:string;
  previous:{canonical_sha256:string;profile_id:string};
  current:{canonical_sha256:string;profile_id:string};
  measurement:string;scientific_sha256:string;
  rows:Array<{collection:string;previous:number;current:number;delta:number;added_ids:number;removed_ids:number;historical_completeness:string}>;
};
export async function compareVisualSnapshot():Promise<VisualSnapshotDiff|null>{
  if(!window.temporaElectron)throw Error("VISUAL_ELECTRON_ONLY");
  return await window.temporaElectron.compareVisualSnapshot() as VisualSnapshotDiff|null;
}
