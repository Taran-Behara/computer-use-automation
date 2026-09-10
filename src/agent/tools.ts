import type Anthropic from "@anthropic-ai/sdk";

// Index-grounded tool surface: the model never writes selectors or URLs
// itself, it points at an element index from the numbered list in the most
// recent observation. This is far more reliable than freehand CSS/XPath
// from an LLM, and keeps the model's job purely "which of these things do I
// interact with," which maps cleanly onto the ranked LocatorCandidate list
// each element already carries.
export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "click",
    description: "Click an interactive element from the most recent observation, by its index.",
    input_schema: {
      type: "object",
      properties: {
        index: { type: "integer", description: "Index from the numbered element list in the last observation." },
      },
      required: ["index"],
      additionalProperties: false,
    },
  },
  {
    name: "type",
    description: "Type text into an input field from the most recent observation, by its index. Replaces any existing value.",
    input_schema: {
      type: "object",
      properties: {
        index: { type: "integer" },
        text: { type: "string" },
      },
      required: ["index", "text"],
      additionalProperties: false,
    },
  },
  {
    name: "select",
    description: "Choose an option, by its value attribute, in a <select> element from the most recent observation.",
    input_schema: {
      type: "object",
      properties: {
        index: { type: "integer" },
        value: { type: "string" },
      },
      required: ["index", "value"],
      additionalProperties: false,
    },
  },
  {
    name: "wait",
    description: "Wait for up to 8000ms before observing again -- use when a page or result appears to still be loading.",
    input_schema: {
      type: "object",
      properties: { ms: { type: "integer", minimum: 0, maximum: 8000 } },
      required: ["ms"],
      additionalProperties: false,
    },
  },
  {
    name: "finish",
    description: "Call once the goal has been achieved -- including when the achieved outcome is a legitimate business result like 'no such record' or 'permission denied', not only a happy-path success.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "One sentence describing what was accomplished or found." },
        outputs: {
          type: "object",
          description: "Named values the goal asked to extract, e.g. {\"balance\": \"$4200.55\"}.",
          additionalProperties: { type: "string" },
        },
      },
      required: ["summary"],
      additionalProperties: false,
    },
  },
  {
    name: "report_stuck",
    description: "Call if you cannot safely or successfully progress toward the goal -- blocked by policy, repeating a failed action, or genuinely unsure how to proceed. This escalates to a human operator instead of guessing.",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string" } },
      required: ["reason"],
      additionalProperties: false,
    },
  },
];
