import Anthropic from "@anthropic-ai/sdk";
import type { PlaywrightSurface } from "../surface/playwrightSurface.js";
import type { ActionOutcome, LocatorCandidate, SurfaceAction } from "../surface/types.js";
import { isActionTypeAllowed, isNavigationAllowed, type AllowlistConfig } from "../safety/allowlist.js";
import { AGENT_TOOLS } from "./tools.js";
import { buildSystemPrompt } from "./prompt.js";
import { formatObservation } from "./observationFormatter.js";
import type { AgentRunResult, AgentStep } from "./types.js";

export interface RunDiscoveryOptions {
  goal: string;
  surface: PlaywrightSurface;
  allowlist: AllowlistConfig;
  model?: string;
  maxSteps?: number;
}

const DEFAULT_MODEL = "claude-haiku-4-5";

// Manual loop rather than the SDK's Tool Runner: we need a hook to run every
// proposed action through the safety allowlist *before* it ever reaches the
// browser, which the Tool Runner's callback-per-tool shape makes awkward
// compared to just owning the loop directly.
export async function runDiscovery(options: RunDiscoveryOptions): Promise<AgentRunResult> {
  const { goal, surface, allowlist, maxSteps = 20 } = options;
  const model = options.model ?? DEFAULT_MODEL;
  const client = new Anthropic();

  const startUrl = surface.currentUrl();
  const system = buildSystemPrompt(goal, allowlist.allowedOrigins[0] ?? startUrl);
  const messages: Anthropic.MessageParam[] = [];
  const steps: AgentStep[] = [];

  const firstObservation = formatObservation(await surface.observe());
  let currentIndexMap = firstObservation.indexToLocators;
  messages.push({ role: "user", content: `Initial observation:\n\n${firstObservation.text}` });

  for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
    const extras = supportsEffort(model) ? { output_config: { effort: "low" as const } } : {};

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system,
      tools: AGENT_TOOLS,
      messages,
      ...extras,
    });

    messages.push({ role: "assistant", content: response.content });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text",
    );

    if (!toolUse) {
      messages.push({ role: "user", content: "Please respond by calling exactly one tool." });
      continue;
    }

    const input = (toolUse.input ?? {}) as Record<string, unknown>;

    if (toolUse.name === "finish") {
      steps.push(makeStep(stepIndex, textBlock, toolUse, null));
      return {
        goal,
        startUrl,
        status: "success",
        steps,
        finishReason: typeof input.summary === "string" ? input.summary : "",
        outputs: isStringRecord(input.outputs) ? input.outputs : {},
      };
    }

    if (toolUse.name === "report_stuck") {
      steps.push(makeStep(stepIndex, textBlock, toolUse, null));
      return {
        goal,
        startUrl,
        status: "stuck",
        steps,
        finishReason: typeof input.reason === "string" ? input.reason : "",
      };
    }

    const built = buildSurfaceAction(toolUse.name, input, currentIndexMap);
    let outcome: ActionOutcome;

    if (built.error) {
      outcome = { ok: false, error: built.error };
    } else if (!isActionTypeAllowed(built.action!.type, allowlist)) {
      outcome = { ok: false, error: `Action type "${built.action!.type}" is blocked by the safety allowlist.` };
    } else if (built.action!.type === "navigate" && !isNavigationAllowed(built.action!.url, allowlist)) {
      outcome = { ok: false, error: `Navigation to ${built.action!.url} is outside the allowlisted origin.` };
    } else {
      outcome = await surface.act(built.action!);
    }

    steps.push(makeStep(stepIndex, textBlock, toolUse, outcome));

    const nextObservation = formatObservation(await surface.observe());
    currentIndexMap = nextObservation.indexToLocators;

    messages.push({
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(outcome) },
        { type: "text", text: `Observation after action:\n\n${nextObservation.text}` },
      ],
    });
  }

  return { goal, startUrl, status: "max_steps", steps };
}

function supportsEffort(model: string): boolean {
  return !model.includes("haiku");
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function makeStep(
  stepIndex: number,
  textBlock: Anthropic.TextBlock | undefined,
  toolUse: Anthropic.ToolUseBlock,
  actionOutcome: ActionOutcome | null,
): AgentStep {
  return {
    stepIndex,
    reasoning: textBlock?.text ?? null,
    toolName: toolUse.name,
    toolInput: toolUse.input,
    actionOutcome,
    timestamp: Date.now(),
  };
}

function buildSurfaceAction(
  name: string,
  input: Record<string, unknown>,
  indexMap: LocatorCandidate[][],
): { action: SurfaceAction | null; error: string | null } {
  function targetFor(index: unknown): LocatorCandidate[] | null {
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= indexMap.length) {
      return null;
    }
    return indexMap[index];
  }

  switch (name) {
    case "click": {
      const target = targetFor(input.index);
      if (!target) return { action: null, error: `Invalid element index: ${String(input.index)}` };
      return { action: { type: "click", target }, error: null };
    }
    case "type": {
      const target = targetFor(input.index);
      if (!target) return { action: null, error: `Invalid element index: ${String(input.index)}` };
      if (typeof input.text !== "string") return { action: null, error: "Missing text" };
      return { action: { type: "type", target, text: input.text }, error: null };
    }
    case "select": {
      const target = targetFor(input.index);
      if (!target) return { action: null, error: `Invalid element index: ${String(input.index)}` };
      if (typeof input.value !== "string") return { action: null, error: "Missing value" };
      return { action: { type: "select", target, value: input.value }, error: null };
    }
    case "wait": {
      const ms = typeof input.ms === "number" ? Math.min(Math.max(input.ms, 0), 8000) : 500;
      return { action: { type: "wait", ms }, error: null };
    }
    default:
      return { action: null, error: `Unknown tool: ${name}` };
  }
}
