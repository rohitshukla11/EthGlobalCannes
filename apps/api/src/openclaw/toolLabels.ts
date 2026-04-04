/** User-facing names for tools (hide implementation / “mock” wording). */
export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  mockWebSearch: "knowledge lookup",
  fetchENSProfile: "ENS lookup",
  fetchAgentConfig: "peer advisor profile",
  readEthBalance: "wallet check",
  getMemory: "session memory",
  saveMemory: "consultation notes",
  invokePeerAgent: "peer consultation",
};

export function displayToolName(name: string | undefined): string {
  if (!name) return "tool";
  return TOOL_DISPLAY_NAMES[name] ?? name;
}
