import { chatVia0GOnly } from "../compute/chat0g.js";
import type { RunAgentParams, RunAgentResult, ExecutionStep, ToolCallPayload } from "./types.js";
import { summarizeStep } from "./summarizeStep.js";
import type { InvokePeerFn } from "./tools.js";
import { createToolExecutor } from "./tools.js";
import type { ToolContext } from "./types.js";

const DEFAULT_MAX = 8;

function extractToolCall(text: string): ToolCallPayload | null {
  const idx = text.indexOf("TOOL_CALL");
  if (idx < 0) return null;
  const slice = text.slice(idx);
  const brace = slice.indexOf("{");
  if (brace < 0) return null;
  let depth = 0;
  let end = -1;
  for (let i = brace; i < slice.length; i++) {
    const c = slice[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) return null;
  try {
    const j = JSON.parse(slice.slice(brace, end + 1)) as { name?: string; arguments?: Record<string, unknown> };
    if (!j.name) return null;
    return { name: j.name, arguments: j.arguments ?? {} };
  } catch {
    return null;
  }
}

function extractFinal(text: string): string | null {
  const idx = text.indexOf("FINAL");
  if (idx < 0) return null;
  const slice = text.slice(idx);
  const brace = slice.indexOf("{");
  if (brace >= 0) {
    let depth = 0;
    let end = -1;
    for (let i = brace; i < slice.length; i++) {
      const c = slice[i];
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end >= 0) {
      try {
        const j = JSON.parse(slice.slice(brace, end + 1)) as { reply?: string };
        if (typeof j.reply === "string") return j.reply;
      } catch {
        /* fall through */
      }
    }
  }
  const after = slice.replace(/^FINAL\s*/i, "").trim();
  return after || null;
}

function buildLoopPrompt(base: string, toolsPrompt: string): string {
  return `${base}

${toolsPrompt}

The last user line in the transcript is labeled [Current turn] — treat it as the only mandatory task for this reply.

After reasoning, output EXACTLY ONE line of either form (no code fences):
TOOL_CALL {"name":"<tool_name>","arguments":{...}}
or
FINAL {"reply":"<user-visible markdown-safe answer>"}

If you need no tools, go straight to FINAL.`;
}

/**
 * OpenClaw-style loop: each step is one 0G Compute chat completion (stateless server; state in messages).
 */
export async function runAgentLoop(
  params: RunAgentParams,
  toolCtx: ToolContext,
  invokePeer?: InvokePeerFn
): Promise<RunAgentResult> {
  const maxSteps = Math.min(Math.max(1, params.maxSteps || DEFAULT_MAX), 12);
  const steps: ExecutionStep[] = [];
  const pushStep = (s: ExecutionStep) => {
    steps.push({ ...s, shortSummary: summarizeStep(s) });
  };
  const toolsUsed: RunAgentResult["toolsUsed"] = [];
  const transcript: { role: string; content: string }[] = [
    { role: "system", content: buildLoopPrompt(params.systemPrompt, params.toolsPrompt) },
    ...params.memoryMessages.map((m) => ({ role: m.role, content: m.content })),
    {
      role: "user",
      content: `[Current turn — follow this; do not assume you must redo prior failed lookups unless asked]\n\n${params.userInput}`,
    },
  ];

  const exec = createToolExecutor(toolCtx, invokePeer);

  for (let step = 0; step < maxSteps; step++) {
    const t0 = Date.now();
    const raw = await chatVia0GOnly(transcript);
    const ms = Date.now() - t0;
    pushStep({ kind: "reasoning", step, detail: raw.slice(0, 2000), durationMs: ms });

    const tool = extractToolCall(raw);
    if (tool) {
      pushStep({
        kind: "tool_call",
        step,
        tool: tool.name,
        detail: JSON.stringify(tool.arguments).slice(0, 1500),
      });
      const t1 = Date.now();
      let result: string;
      try {
        result = await exec(tool);
      } catch (e) {
        result = `tool error: ${String(e)}`;
      }
      const trimmed = result.trim();
      if (!trimmed || trimmed === "(empty)") {
        pushStep({
          kind: "reasoning",
          step,
          detail: "No direct data found; applying domain expertise instead.",
          durationMs: 0,
        });
      }
      toolsUsed.push({ name: tool.name, arguments: tool.arguments, result: result.slice(0, 8000) });
      pushStep({
        kind: "tool_result",
        step,
        tool: tool.name,
        detail: trimmed ? result.slice(0, 2000) : "(empty)",
        durationMs: Date.now() - t1,
      });
      transcript.push({ role: "assistant", content: raw });
      transcript.push({
        role: "user",
        content: `Tool ${tool.name} result:\n${result}\n\nContinue. Output TOOL_CALL or FINAL.`,
      });
      continue;
    }

    const fin = extractFinal(raw) ?? raw.trim();
    pushStep({ kind: "final", step, detail: fin.slice(0, 500) });
    transcript.push({ role: "assistant", content: raw });
    toolCtx.workingMemory.messages.push({ role: "user", content: params.userInput });
    toolCtx.workingMemory.messages.push({ role: "assistant", content: fin });
    return {
      reply: fin,
      steps,
      toolsUsed,
      provider: "0g",
      workingMemory: toolCtx.workingMemory,
    };
  }

  const fallback = "OpenClaw: step budget exhausted without FINAL. Summarize with shorter tool use.";
  toolCtx.workingMemory.messages.push({ role: "user", content: params.userInput });
  toolCtx.workingMemory.messages.push({ role: "assistant", content: fallback });
  return {
    reply: fallback,
    steps,
    toolsUsed,
    provider: "0g",
    workingMemory: toolCtx.workingMemory,
  };
}
