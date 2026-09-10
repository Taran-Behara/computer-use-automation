// The seam between "how we perceive/act on a surface" and everything above it
// (agent loop, artifact schema, replay engine). Nothing outside this folder
// should import Playwright directly -- swapping in an accessibility-tree,
// screenshot+coordinate, or OS-level backend later means writing a new
// SurfaceAdapter, not touching the agent, artifact, or replay code.

export interface FrameRef {
  /** null means the top-level page/document, not a <frame>/<iframe>. */
  name: string | null;
}

// Ranked by robustness, most-preferred first. A recorded step keeps the full
// ranked list (not just the one that fired) so replay can fall back if a
// higher-ranked candidate stops resolving -- e.g. after a tenant reskin.
export type LocatorCandidate =
  | { strategy: "role"; role: string; name: string; frame: FrameRef }
  | { strategy: "text"; text: string; frame: FrameRef }
  | { strategy: "id"; id: string; frame: FrameRef }
  | { strategy: "css"; selector: string; frame: FrameRef };

export interface ElementSnapshot {
  frame: FrameRef;
  tag: string;
  role: string | null;
  accessibleName: string | null;
  text: string | null;
  attributes: Record<string, string>;
  locatorCandidates: LocatorCandidate[];
}

export interface PageObservation {
  url: string;
  title: string;
  frames: FrameRef[];
  elements: ElementSnapshot[];
  /** Truncated visible text per frame -- what an LLM reads instead of raw HTML. */
  bodyTextSummary: string;
}

export type SurfaceAction =
  | { type: "click"; target: LocatorCandidate[] }
  | { type: "type"; target: LocatorCandidate[]; text: string }
  | { type: "select"; target: LocatorCandidate[]; value: string }
  | { type: "navigate"; url: string }
  | { type: "wait"; ms: number };

export interface ActionOutcome {
  ok: boolean;
  /** Which candidate in the ranked list actually resolved, for recording. */
  usedLocator?: LocatorCandidate;
  error?: string;
}

export interface SurfaceAdapter {
  observe(): Promise<PageObservation>;
  act(action: SurfaceAction): Promise<ActionOutcome>;
  screenshot(): Promise<Buffer>;
  currentUrl(): string;
  close(): Promise<void>;
}
