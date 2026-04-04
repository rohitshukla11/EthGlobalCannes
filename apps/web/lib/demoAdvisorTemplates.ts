export type DemoAdvisorTemplateId = "crypto-lawyer" | "defi-trader" | "contract-auditor";

export type DemoAdvisorTemplate = {
  id: DemoAdvisorTemplateId;
  profession: string;
  specialization: string;
  experience: string;
  pitch: string;
  advisorTone: "formal" | "friendly" | "analytical";
  exampleQuestions: string[];
};

export const DEMO_ADVISOR_TEMPLATES: DemoAdvisorTemplate[] = [
  {
    id: "crypto-lawyer",
    profession: "Lawyer",
    specialization: "Crypto & securities compliance",
    experience: "5+ years advising Web3 startups and token launches",
    pitch: "Helping founders stay legally compliant when launching tokens and DAOs.",
    advisorTone: "formal",
    exampleQuestions: [
      "What legal risks should I consider before launching a token?",
      "How do I structure a SAFT for international investors?",
    ],
  },
  {
    id: "defi-trader",
    profession: "Trader",
    specialization: "DeFi & on-chain risk",
    experience: "7+ years markets; focused on liquidity and protocol risk",
    pitch: "Practical risk framing for DeFi positions and treasury decisions.",
    advisorTone: "analytical",
    exampleQuestions: [
      "How should I think about impermanent loss for this pool?",
      "What red flags do you look for in a new lending protocol?",
    ],
  },
  {
    id: "contract-auditor",
    profession: "Developer",
    specialization: "Smart contract security",
    experience: "Audited 40+ Solidity codebases; former protocol engineer",
    pitch: "Structured reviews: threat modeling, common pitfalls, and upgrade paths.",
    advisorTone: "analytical",
    exampleQuestions: [
      "What should I prioritize before mainnet for this staking contract?",
      "Walk me through reentrancy checks for this pattern.",
    ],
  },
];
