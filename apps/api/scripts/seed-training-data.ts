import { uploadTrainingDocument } from "../src/trainingData.js";

const LEX_AGENT_ID = process.env.LEX_AGENT_ID;
if (!LEX_AGENT_ID) {
  console.error("Set LEX_AGENT_ID in .env to the advisor agent id to seed.");
  process.exit(1);
}

const TRAINING_DOCS = [
  {
    filename: "howey-test-analysis-2024.txt",
    description: "SEC Howey Test — when a token is a security",
    content: `THE HOWEY TEST — TOKEN SECURITIES ANALYSIS

The Howey Test determines if a transaction qualifies as an 
"investment contract" and thus a security under US law.

Four elements must ALL be present:
1. An investment of money
2. In a common enterprise  
3. With an expectation of profits
4. Derived from the efforts of others

TOKEN ANALYSIS FRAMEWORK:
- Utility tokens: often fail prong 4 if network is functional
- Governance tokens: prong 4 risk if founders control roadmap
- Revenue-sharing tokens: strong prong 3, likely securities
- NFTs with royalties: case-by-case, SEC watching closely

KEY CASES:
- SEC v. Ripple (2023): XRP not a security in secondary sales
- SEC v. Terraform (2024): LUNA is a security
- Coinbase case (2024): Staking = securities, per SEC theory

SAFE HARBORS:
- Reg D 506(b): unlimited raise, 35 non-accredited investors
- Reg D 506(c): unlimited raise, verified accredited only
- Reg S: sales to non-US persons only
- Reg A+: up to $75M, public offering, light disclosure`,
  },
  {
    filename: "mica-regulation-token-rules.txt",
    description: "EU MiCA regulation — token classification and requirements",
    content: `EU MARKETS IN CRYPTO-ASSETS REGULATION (MiCA)
Effective: June 2024 (stablecoins), December 2024 (full)

TOKEN CLASSIFICATIONS UNDER MiCA:

1. Asset-Referenced Tokens (ARTs)
   - Pegged to basket of assets/currencies/commodities
   - Requires: authorization, whitepaper, 2% own funds reserve
   - Significant ART: additional requirements if >1M holders

2. E-Money Tokens (EMTs)  
   - Pegged to single fiat currency (USDC, EURC)
   - Requires: e-money institution license or credit institution
   - 100% reserve requirement in segregated accounts

3. Other Crypto-Assets (utility tokens, governance)
   - Lighter regime: whitepaper + notification to regulator
   - Exemptions: truly decentralized projects, NFTs (mostly)
   - No authorization needed, but disclosure required

WHITEPAPER REQUIREMENTS (Article 6):
- Issuer details, project description, rights attached
- Risks, technical description, conflicts of interest
- Must be filed with national competent authority
- Civil liability for misleading whitepapers

JURISDICTIONS:
- France: AMF — most active regulator, sandbox friendly
- Germany: BaFin — strict, good for institutional credibility  
- Malta: MFSA — fast, crypto-friendly history
- Luxembourg: CSSF — fund-friendly, good for EU passporting`,
  },
  {
    filename: "saft-template-notes.txt",
    description: "SAFT agreement — structure and key clauses",
    content: `SIMPLE AGREEMENT FOR FUTURE TOKENS (SAFT)

The SAFT is a derivative of the SAFE (Simple Agreement for 
Future Equity), adapted for token projects. It's an investment 
contract between accredited investors and a token issuer.

KEY CLAUSES:

1. PURCHASE AMOUNT
   The investor pays X USD today for the right to receive 
   tokens at network launch.

2. DISCOUNT RATE
   Tokens delivered at a discount to the public sale price.
   Typical range: 20-50% discount. Negotiate hard here.

3. VALUATION CAP
   Max valuation at which SAFT converts. Protects early 
   investors if project raises at high valuation.

4. TOKEN DELIVERY CONDITIONS
   - Network launch (defined precisely)
   - Minimum raise threshold
   - Regulatory approval if needed

5. REGULATORY REPRESENTATIONS
   - Investor is accredited (Reg D requirement)
   - Investor not US person (if Reg S structure)
   - SAFT itself is a security — requires Reg D filing

6. LOCK-UP / VESTING
   Common: 6-12 month cliff, 2-4 year vesting
   Accelerated vesting on change of control is negotiable

RISKS:
- Network never launches → investor has no recourse
- Token is a security → ongoing reporting obligations
- Jurisdiction shift → may need re-structuring

ALTERNATIVES TO SAFT:
- Token Warrant: more flexible, used post-Howey clarity
- Convertible Note: if pivoting to equity is possible
- SAFE + token side letter: common in 2024-2025`,
  },
];

async function seedTrainingData() {
  console.log(`Seeding training data for agent: ${LEX_AGENT_ID}`);

  for (const doc of TRAINING_DOCS) {
    console.log(`  Uploading: ${doc.filename}`);
    const buffer = Buffer.from(doc.content, "utf-8");
    const result = await uploadTrainingDocument(
      LEX_AGENT_ID!,
      doc.filename,
      "text/plain",
      buffer,
      doc.description
    );
    console.log(`  ✓ Hash: ${result.hash}`);
  }

  console.log("Training corpus seeded. Manifest rebuilt.");
  console.log("Check GET /agents/:id/training for this agent id.");
}

seedTrainingData().catch((e) => {
  console.error(e);
  process.exit(1);
});
