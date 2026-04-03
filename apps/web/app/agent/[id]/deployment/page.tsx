import Link from "next/link";
import { apiGet } from "@/lib/api";
import { DeploymentProofsPanel } from "@/components/deployment/DeploymentProofsPanel";

export const dynamic = "force-dynamic";

type Agent = {
  id: string;
  ensFullName: string;
  name: string;
  owner: string;
  tokenId: number;
  configRoot: string;
};

type PublicConfig = {
  publicApiUrl: string;
  zgChainId: number;
  zgExplorerUrl: string;
  inftContractAddress: string | null;
};

export default async function AgentDeploymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  let agent: Agent | null = null;
  let pub: PublicConfig | null = null;
  let error: string | null = null;

  try {
    const enc = encodeURIComponent(id);
    const [a, p] = await Promise.all([
      apiGet<{ agent: Agent }>(`/agents/${enc}`),
      apiGet<PublicConfig>("/config/public"),
    ]);
    agent = a.agent;
    pub = p;
  } catch (e) {
    error = String(e);
  }

  if (error || !agent || !pub) {
    return (
      <div className="rounded-ui border border-error/40 bg-raised p-8">
        <p className="font-mono text-[13px] text-error">{error ?? "Not found"}</p>
        <Link href="/marketplace" className="mt-6 inline-block font-mono text-[13px] text-secondary no-underline hover:text-primary">
          ← Marketplace
        </Link>
      </div>
    );
  }

  const base = pub.publicApiUrl.replace(/\/$/, "");
  const tokenUri = `${base}/nft/metadata/${encodeURIComponent(agent.id)}`;
  const explorerBase = pub.zgExplorerUrl.replace(/\/$/, "");
  const inft = pub.inftContractAddress ?? "";

  return (
    <div className="space-y-10">
      <Link
        href={`/agent/${encodeURIComponent(agent.id)}`}
        className="inline-block font-mono text-[13px] text-tertiary no-underline hover:text-secondary"
      >
        ← {agent.ensFullName}
      </Link>

      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-tertiary">Deployment</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight text-primary sm:text-4xl">Proofs &amp; 0G links</h1>
        <p className="mt-3 max-w-subtitle font-mono text-[13px] text-secondary">
          On-chain iNFT on Galileo, canonical config on 0G Storage. New mints use a self-describing tokenURI (e.g.{" "}
          <span className="text-tertiary">twinnet-0g-metadata:0x…</span>); this API URL remains a fallback viewer.
        </p>
      </header>

      <DeploymentProofsPanel
        agent={{
          id: agent.id,
          tokenId: agent.tokenId,
          owner: agent.owner,
          ensFullName: agent.ensFullName,
          name: agent.name,
          configRoot: agent.configRoot,
        }}
        deployment={{
          chainId: pub.zgChainId,
          chainName: "0G Galileo Testnet",
          explorerBaseUrl: explorerBase,
          inftContractAddress: inft,
          tokenUri,
          configRoot: agent.configRoot,
        }}
        ensMetadataWritten={null}
        showDeepLink={false}
        verboseHashes
      />
    </div>
  );
}
