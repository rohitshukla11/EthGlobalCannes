import Link from "next/link";
import { truncateMiddle } from "@/lib/jwt";
import { explorerContractUrl, explorerNftUrl } from "./deploymentLinks";

export type DeploymentProofsPanelProps = {
  agent: {
    id: string;
    tokenId: number;
    owner: string;
    ensFullName: string;
    name?: string;
    configRoot: string;
  };
  deployment: {
    chainId: number;
    chainName: string;
    explorerBaseUrl: string;
    inftContractAddress: string;
    tokenUri: string;
    configRoot: string;
    metadataRoot?: string;
  };
  ensMetadataWritten?: boolean | null;
  /** When false, omit link to /agent/[id]/deployment. */
  showDeepLink?: boolean;
  /** Show full Merkle roots / addresses (dedicated deployment page). */
  verboseHashes?: boolean;
};

export function DeploymentProofsPanel({
  agent,
  deployment,
  ensMetadataWritten = null,
  showDeepLink = true,
  verboseHashes = false,
}: DeploymentProofsPanelProps) {
  const contractOk = /^0x[a-fA-F0-9]{40}$/.test(deployment.inftContractAddress);
  const fmtRoot = (h: string) => (verboseHashes ? h : truncateMiddle(h, 12, 10));
  const fmtAddr = (a: string) => (verboseHashes ? a : truncateMiddle(a, 10, 8));

  return (
    <div className="space-y-4 rounded-control border border-[rgba(74,222,128,0.25)] bg-[rgba(74,222,128,0.06)] p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-success">Deployment &amp; proofs — 0G + Alter</p>
      <p className="font-mono text-[11px] leading-relaxed text-tertiary">
        Persona config is stored on <span className="text-secondary">0G Storage</span> (Merkle root below). The iNFT lives on{" "}
        <span className="text-secondary">{deployment.chainName}</span> (chainId {deployment.chainId}). Confirm the mint and
        ownership on <span className="text-secondary">0G Scan</span>.
      </p>

      <dl className="space-y-3 font-mono text-[11px] text-tertiary">
        <div>
          <dt className="text-[10px] uppercase tracking-[0.08em] text-tertiary/80">iNFT contract</dt>
          <dd className="mt-1 break-all text-secondary">{fmtAddr(deployment.inftContractAddress)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.08em] text-tertiary/80">Token ID</dt>
          <dd className="mt-1 text-primary">{String(agent.tokenId)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.08em] text-tertiary/80">Owner</dt>
          <dd className="mt-1 break-all text-secondary">{fmtAddr(agent.owner)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.08em] text-tertiary/80">ENS (Sepolia)</dt>
          <dd className="mt-1 text-primary">{agent.ensFullName}</dd>
        </div>
        {agent.name ? (
          <div>
            <dt className="text-[10px] uppercase tracking-[0.08em] text-tertiary/80">Display name</dt>
            <dd className="mt-1 text-primary">{agent.name}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-[10px] uppercase tracking-[0.08em] text-tertiary/80">0G — advisor config root</dt>
          <dd className="mt-1 break-all text-secondary">{fmtRoot(deployment.configRoot)}</dd>
        </div>
        {deployment.metadataRoot ? (
          <div>
            <dt className="text-[10px] uppercase tracking-[0.08em] text-tertiary/80">0G — NFT metadata root</dt>
            <dd className="mt-1 break-all text-secondary">{fmtRoot(deployment.metadataRoot)}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-[10px] uppercase tracking-[0.08em] text-tertiary/80">Canonical id (ENS-bound)</dt>
          <dd className="mt-1 break-all text-primary">{agent.id}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.08em] text-tertiary/80">Token URI (metadata)</dt>
          <dd className="mt-1 break-all text-tertiary">
            <a
              href={deployment.tokenUri}
              target="_blank"
              rel="noreferrer"
              className="text-accent underline decoration-mid underline-offset-2 hover:decoration-accent"
            >
              {deployment.tokenUri}
            </a>
          </dd>
        </div>
        {ensMetadataWritten === true ? (
          <p className="text-[11px] text-success">ENS text records (agent.*) were written.</p>
        ) : ensMetadataWritten === false ? (
          <p className="text-[11px] text-tertiary/90">
            ENS agent.* text records were not written (set API <span className="text-secondary">ENS_OPERATOR_PRIVATE_KEY</span>{" "}
            if you control the resolver).
          </p>
        ) : null}
      </dl>

      <div className="flex flex-wrap gap-2 pt-2">
        {contractOk ? (
          <>
            <a
              href={explorerContractUrl(deployment.explorerBaseUrl, deployment.inftContractAddress)}
              target="_blank"
              rel="noreferrer"
              className="rounded-control border border-mid bg-void px-3 py-2 font-mono text-[10px] text-accent no-underline hover:border-accent"
            >
              0G Scan — contract ↗
            </a>
            <a
              href={explorerNftUrl(deployment.explorerBaseUrl, deployment.inftContractAddress, agent.tokenId)}
              target="_blank"
              rel="noreferrer"
              className="rounded-control border border-mid bg-void px-3 py-2 font-mono text-[10px] text-accent no-underline hover:border-accent"
            >
              0G Scan — NFT #{agent.tokenId} ↗
            </a>
            <a
              href={explorerContractUrl(deployment.explorerBaseUrl, agent.owner)}
              target="_blank"
              rel="noreferrer"
              className="rounded-control border border-mid bg-void px-3 py-2 font-mono text-[10px] text-accent no-underline hover:border-accent"
            >
              0G Scan — owner wallet ↗
            </a>
          </>
        ) : null}
        <Link
          href={`/agent/${encodeURIComponent(agent.id)}`}
          className="rounded-control border border-mid bg-void px-3 py-2 font-mono text-[10px] text-accent no-underline hover:border-accent"
        >
          Advisor profile
        </Link>
        {showDeepLink ? (
          <Link
            href={`/agent/${encodeURIComponent(agent.id)}/deployment`}
            className="rounded-control border border-mid bg-void px-3 py-2 font-mono text-[10px] text-accent no-underline hover:border-accent"
          >
            Deployment page
          </Link>
        ) : null}
        <Link
          href="/marketplace"
          className="rounded-control border border-mid bg-void px-3 py-2 font-mono text-[10px] text-accent no-underline hover:border-accent"
        >
          Marketplace
        </Link>
        <Link
          href={`/agent/${encodeURIComponent(agent.id)}/interact`}
          className="rounded-control border border-mid bg-void px-3 py-2 font-mono text-[10px] text-accent no-underline hover:border-accent"
        >
          Consult
        </Link>
      </div>
    </div>
  );
}
