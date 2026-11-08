export type Json = null | boolean | number | string | Json[] | JsonObject;
export interface JsonObject { [key: string]: Json }
export interface Diagnostic { code: string; message: string; path?: string; id?: string | null }
export interface Validation { valid: boolean; errors: Diagnostic[]; warnings?: Diagnostic[]; scope?: string }
export interface Profile extends JsonObject { id: string; namespace: string; version: string }
export interface Corpus extends JsonObject { profile: Profile; schema_version: string }
export interface Reference extends JsonObject { id: string; kind: string; namespace: string }
export interface Bundle extends JsonObject { manifest: JsonObject; files: { [name: string]: string } }
export interface Operator { reviewer: string; at: string; reason: string }
export interface PublicationRequest {
  corpus: Corpus; policy: JsonObject; journal: JsonObject[]; subjects: Reference[]; asOf: string;
  release: {id: string; source_commit: string; rights_notice: string; citation_author: string};
  expectedHead: string; previous?: Bundle | null;
}
export interface CatalogEntry { latest: string; releases: Bundle[] }
export interface Store {
  stage(bundle: Bundle): string;
  export(bundle: Bundle): string;
  readCurrent(profile: string): Bundle | null;
  readPublished(profile: string): CatalogEntry | null;
  promote(request: PublicationRequest, options: {snapshot_sha256: string; operator: Operator}): JsonObject;
  rollback(options: {profile: Profile; policy: JsonObject; expected_sha256: string; target_release_id: string; operator: Operator}): JsonObject;
}
export interface HandlerRequest { url?: string; method?: string; headers?: {[key: string]: string | string[] | undefined} }
export interface HandlerResponse { statusCode: number; setHeader(name: string, value: string): unknown; end(body?: string): unknown }
export interface FrameworkError extends Error { code: string; details?: unknown }
export const profiles: {
  resolve(manifest: JsonObject, options?: JsonObject): Profile;
  load(file: string, options?: JsonObject): Profile;
  Error: new (code: string, message: string) => FrameworkError;
};
export const canonical: {
  validateCorpus(corpus: unknown): Validation;
  validateObject(type: string, value: unknown): Validation;
  stringify(value: Json): string;
  digest(value: Json): string;
  Error: new (code: string, message: string) => FrameworkError;
};
export const ingestion: {
  createCorpus(profile: JsonObject, taxonomies: {[key: string]: string[]}): Corpus;
  preview(options: {bytes: Uint8Array; mapping: JsonObject; corpus: Corpus; sourceName: string; observedAt?: string | null}): JsonObject;
  accept(options: {corpus: Corpus; bundle: JsonObject; review: {batch_id: string; ids: string[]; reviewer: string; reason: string; reviewed_at: string}}): JsonObject;
  Error: new (code: string, message: string) => FrameworkError;
};
export const analysis: {
  analyze(corpus: Corpus, options?: JsonObject): JsonObject;
  compareCoverage(before: JsonObject, after: JsonObject): JsonObject;
};
export const review: {
  policy(profile: Profile, options: {reviewers: string[]; minimum_approvals: number; review_max_age_days: number; contested: 'allow' | 'deny'}): JsonObject;
  digest(record: JsonObject): string;
  append(options: {corpus: Corpus; policy: JsonObject; journal?: JsonObject[]; decision: JsonObject}): JsonObject[];
  verify(options: {corpus: Corpus; policy: JsonObject; journal: JsonObject[]; expectedHead: string}): JsonObject;
  eligibility(options: {corpus: Corpus; policy: JsonObject; journal?: JsonObject[]; subjects: Reference[]; asOf: string; expectedHead?: string}): JsonObject;
};
export const publication: {
  build(request: PublicationRequest): Bundle;
  verify(bundle: Bundle): JsonObject;
  verifyDirectory(directory: string): Bundle;
  createStore(directory: string): Store;
};
export interface Catalog { list(): JsonObject[]; resolve(profile: string, release?: string): unknown; releases(profile: string): JsonObject[] }
export const api: {
  createCatalog(entries?: CatalogEntry[]): Catalog;
  createHandler(catalog?: Catalog, options?: {corsOrigin?: string | null}): (request: HandlerRequest, response: HandlerResponse) => void;
};
