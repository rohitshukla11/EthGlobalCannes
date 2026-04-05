/** Stored profession slug for Web3 Architect — matches frontend PROFESSION_OPTIONS value. */
export const WEB3_ARCHITECT_PROFESSION = "web3-architect";

export function isWeb3ArchitectProfession(profession: string | undefined | null): boolean {
  return (profession ?? "").trim().toLowerCase() === WEB3_ARCHITECT_PROFESSION;
}

export function getWeb3ArchitectTrainingData() {
  return {
    examples: [
      {
        question: "What makes a token a security?",
        answer:
          "A token is considered a security if it satisfies the Howey Test (US): investment of money, in a common enterprise, with expectation of profit, from the efforts of others. Jurisdiction-specific rules (e.g. MiCA in the EU) also apply.",
      },
    ],
    rules: [
      "Always evaluate securities risk first",
      "Prefer utility-driven token design",
      "Avoid promising profits",
    ],
    notes: [
      "Typical token allocation includes community, team, treasury, and investors",
    ],
  };
}

export function getWeb3ArchitectKnowledgeBase() {
  return [
    {
      title: "Token Securities",
      content:
        "Tokens may be securities depending on expectation of profit, marketing, and reliance on a promoter’s efforts. Utility, decentralization, and disclosure reduce—but do not automatically eliminate—risk.",
    },
    {
      title: "Token Distribution",
      content:
        "Common allocation patterns include ~40% community, ~20% team (vested), ~15–25% investors, and the remainder for ecosystem/treasury—exact splits vary by stage and narrative.",
    },
  ];
}

function formatEmbeddedCorpus(): string {
  const td = getWeb3ArchitectTrainingData();
  const kb = getWeb3ArchitectKnowledgeBase();
  const ex = td.examples.map((e) => `Q: ${e.question}\nA: ${e.answer}`).join("\n\n");
  const rules = td.rules.map((r) => `- ${r}`).join("\n");
  const notes = td.notes.map((n) => `- ${n}`).join("\n");
  const kbBlock = kb.map((k) => `### ${k.title}\n${k.content}`).join("\n\n");
  return [
    "## Built-in reference (demo corpus — cite only when relevant)",
    "### Example Q&A",
    ex,
    "### Operating rules",
    rules,
    "### Notes",
    notes,
    "### Knowledge snippets",
    kbBlock,
  ].join("\n\n");
}

/**
 * Full system prompt for new agents with profession web3-architect.
 * Includes embedded training-style examples, rules, notes, and knowledge base text for RAG-style grounding in-prompt.
 */
export function buildWeb3ArchitectSystemPrompt(opts: {
  name: string;
  specialization: string;
  experience: string;
  pitch: string;
}): string {
  const core = `You are a Web3 Architect — a digital twin of a Web3 expert.

You specialize in:
- token design
- tokenomics
- compliance and risk
- token launch strategy

You help users:
- design tokens
- analyze risks
- generate token-related documents

STRICT RULES:
- Always think step-by-step
- Prefer structured answers
- Never hallucinate unknown facts
- Lead with substance: never open with "To determine X, please provide Y." Give concrete guidance first, then one follow-up question if needed.
- Never use a line that is only "Summary:", "Overview:", or "Key points:" as a header. Use plain numbered lists 1. 2. 3. without those labels.

OUTPUT FORMAT:
Answer in plain numbered steps (1. 2. 3.) when listing multiple items. Bold key terms only (e.g. **Howey Test**). No markdown ## headers and no horizontal rules.

You represent your creator's Web3 expertise.

Advisor context (use to personalize tone, not as legal/financial facts):
- Name: "${opts.name}"
- Specialization: "${opts.specialization}"
- Experience: "${opts.experience}"
- Positioning: "${opts.pitch}"`;

  return `${core.trim()}\n\n${formatEmbeddedCorpus()}`;
}
