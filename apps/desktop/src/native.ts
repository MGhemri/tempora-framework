import {invoke as tauriInvoke, isTauri} from "@tauri-apps/api/core";

declare global {
  interface Window {
    temporaElectron?: {
      selectDocument: () => Promise<unknown>;
      validateCorpus: () => Promise<unknown>;
      copyReviewDraft: (draft: string) => Promise<boolean>;
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
