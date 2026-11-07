/**
 * TVRW J1A — derived-only, frontend-facing serialization contracts.
 * The UI MUST NOT implement science or validate the canonical corpus.
 * Keep in sync with schemas/tempora/visualization and Node contracts.cjs.
 */
export type TypedRefKind =
  | "event" | "source" | "claim" | "entity" | "spatial"
  | "relation" | "review" | "assessment" | "release";

export type TypedRef = Readonly<{
  kind: TypedRefKind;
  namespace: string;
  id: string;
}>;

export type ViewId =
  | "geo" | "graph" | "chronos"
  | "evidence" | "pattern" | "observatory";

export type TimeFilterMode =
  | "certain-only" | "possible-overlap" | "declared-start";

export type SelectionState = Readonly<{
  selection_schema_version: "1.0.0";
  corpusKey: string;
  viewId: ViewId;
  selectedRefs: readonly TypedRef[];
  timeFilter: Readonly<{
    mode: TimeFilterMode;
    earliest: string | null;
    latest: string | null;
  }>;
  spatialFilter: null;
  predicateFilter: null;
  statusFilter: null;
  language: string;
  evidenceFilter: null;
  algorithmContext: null;
  partialResult: boolean;
}>;

export type ProjectionDiagnostic = Readonly<{
  code: string;
  severity: "info" | "warning" | "error";
  count?: number;
}>;

export type ProjectionEnvelope<T> = Readonly<{
  projection_schema_version: "1.0.0";
  algorithm: Readonly<{
    id: string;
    version: string;
    parameters_sha256: string;
  }>;
  corpus: Readonly<{
    canonical_sha256: string;
    schema_version: "3.0.0";
    profile_id: string;
  }>;
  source: Readonly<{
    engine_version: "3.0.0";
    generated_at: string;
    mode: "validated" | "unvalidated-preview";
  }>;
  scope: Readonly<{
    filters: Record<string, unknown>;
    total_matched: number;
    returned: number;
    truncated: boolean;
  }>;
  diagnostics: readonly ProjectionDiagnostic[];
  result: readonly T[];
  scientific_sha256: string;
}>;
