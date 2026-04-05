/**
 * CLI: reconstruct Alter agent from Sepolia ENS + 0G (agent.*; reads legacy twinn.* if present).
 * Usage: npm run resolve:ens -- name.eth
 */
import {
  resolveFullAgentProfile,
  resolvedProfileToAgentRecord,
  getEnsAgentTexts,
  effectiveConfigRoot,
  effectiveMemoryHead,
  effectiveRuntime,
  effectiveToolsCsv,
  effectiveAgentType,
  hasAgentNamespaceRecords,
} from "../src/ens.js";
import { downloadFrom0G } from "../src/storage0g.js";

const name = process.argv[2];
if (!name) {
  console.error("Usage: npm run resolve:ens -- <name.eth>");
  process.exit(1);
}

async function main() {
  const ensName = name.toLowerCase();
  const texts = await getEnsAgentTexts(ensName);
  const p = await resolveFullAgentProfile(name);
  if (!p) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          error: "No resolvable agent.* (or legacy twinn.*) records / config",
          ensName,
          texts,
          standard: "ensip-65-compatible",
          hasAgentRecords: hasAgentNamespaceRecords(texts),
        },
        null,
        2
      )
    );
    process.exit(2);
  }
  const agent = resolvedProfileToAgentRecord(p);
  const configRoot = effectiveConfigRoot(texts) ?? null;
  const memoryHead = effectiveMemoryHead(texts) ?? null;
  const runtime = effectiveRuntime(texts) ?? null;
  const tools = effectiveToolsCsv(texts) ?? null;

  let memory: unknown = null;
  if (memoryHead) {
    try {
      const raw = await downloadFrom0G(memoryHead);
      memory = JSON.parse(raw) as unknown;
    } catch (e) {
      memory = { error: String(e) };
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        ensName,
        configRoot,
        memoryHead,
        runtime,
        tools,
        agentType: effectiveAgentType(texts) ?? null,
        standard: "ensip-65-compatible",
        hasAgentRecords: hasAgentNamespaceRecords(texts),
        config: p.configJson,
        memory,
        agent,
        texts: p.texts,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
