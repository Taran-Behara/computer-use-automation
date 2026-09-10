import type { ActionOutcome } from "../surface/types.js";

export interface AgentStep {
  stepIndex: number;
  reasoning: string | null;
  toolName: string;
  toolInput: unknown;
  actionOutcome: ActionOutcome | null;
  timestamp: number;
}

export type AgentRunStatus = "success" | "stuck" | "max_steps";

export interface AgentRunResult {
  goal: string;
  startUrl: string;
  status: AgentRunStatus;
  steps: AgentStep[];
  finishReason?: string;
  outputs?: Record<string, string>;
}
