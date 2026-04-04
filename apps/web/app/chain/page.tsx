import Link from "next/link";
import { apiGet } from "@/lib/api";
import { explorerContractUrl } from "@/components/deployment/deploymentLinks";

export const dynamic = "force-dynamic";

type PublicConfig = {
  publicApiUrl: string;
  wldAppId: string;
  wldAction: string;
  wldRpId: string;
  zgRpc: string;
  zgIndexerRpc: string;
  zgChainId: number;
  zgExplorerUrl: string;
  inftContractAddress: string | null;
  sepoliaRpcConfigured: boolean;
};

export default async function ChainPage() {
  let pub: PublicConfig | null = null;
  let error: string | null = null;
  try {
    pub = await apiGet<PublicConfig>("/config/public");
  } catch (e) {
    error = String(e);
  }

  if (error || !pub) {
    return (
      <div className="rounded-ui border border-error/40 bg-raised p-8">
        <p className="font-mono text-[13px] text-error">{error ?? "Could not load config"}</p>
      </div>
    );
  }

  const explorer = pub.zgExplorerUrl.replace(/\/$/, "");
  const inft = pub.inftContractAddress;

  return (
    <div className="space-y-10">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-tertiary">0G Galileo</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight text-primary sm:text-4xl">Chain &amp; contracts</h1>
        <p className="mt-3 max-w-subtitle font-mono text-[13px] text-secondary">
          Live values from the Counselr API (<code className="text-accent">GET /config/public</code>). Wire wallets and explorers to these
          endpoints.
        </p>
      </header>

      <section className="rounded-ui border border-dim bg-raised p-7">
        <h2 className="type-eyebrow mb-4">Network</h2>
        <dl className="space-y-4 font-mono text-[12px] text-secondary">
          <div>
            <dt className="text-[10px] uppercase tracking-[0.08em] text-tertiary">Chain ID</dt>
            <dd className="mt-1 text-primary">{pub.zgChainId}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.08em] text-tertiary">RPC</dt>
            <dd className="mt-1 break-all text-primary">{pub.zgRpc}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.08em] text-tertiary">Block explorer</dt>
            <dd className="mt-1">
              <a
                href={explorer}
                target="_blank"
                rel="noreferrer"
                className="text-accent underline decoration-mid underline-offset-2 hover:decoration-accent"
              >
                {pub.zgExplorerUrl}
              </a>
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-ui border border-dim bg-raised p-7">
        <h2 className="type-eyebrow mb-4">0G Storage</h2>
        <dl className="space-y-4 font-mono text-[12px] text-secondary">
          <div>
            <dt className="text-[10px] uppercase tracking-[0.08em] text-tertiary">Indexer RPC</dt>
            <dd className="mt-1 break-all text-primary">{pub.zgIndexerRpc}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-ui border border-dim bg-raised p-7">
        <h2 className="type-eyebrow mb-4">TwinAgent iNFT</h2>
        {inft && /^0x[a-fA-F0-9]{40}$/i.test(inft) ? (
          <dl className="space-y-4 font-mono text-[12px] text-secondary">
            <div>
              <dt className="text-[10px] uppercase tracking-[0.08em] text-tertiary">Contract</dt>
              <dd className="mt-1 break-all text-primary">{inft}</dd>
            </div>
            <div>
              <a
                href={explorerContractUrl(explorer, inft)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-control border border-mid px-3 py-2 text-[11px] text-accent no-underline hover:border-accent"
              >
                Open on 0G Scan ↗
              </a>
            </div>
          </dl>
        ) : (
          <p className="font-mono text-[13px] text-tertiary">
            <code className="text-secondary">INFT_CONTRACT_ADDRESS</code> is not set on the API. Deploy the contract and add it
            to <code className="text-secondary">.env</code>, then restart the API.
          </p>
        )}
      </section>

      <section className="rounded-ui border border-dim bg-raised p-7">
        <h2 className="type-eyebrow mb-4">Other</h2>
        <dl className="space-y-4 font-mono text-[12px] text-secondary">
          <div>
            <dt className="text-[10px] uppercase tracking-[0.08em] text-tertiary">Public API base</dt>
            <dd className="mt-1 break-all text-primary">{pub.publicApiUrl}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.08em] text-tertiary">Sepolia RPC (ENS)</dt>
            <dd className="mt-1 text-primary">{pub.sepoliaRpcConfigured ? "Configured" : "Not reported"}</dd>
          </div>
        </dl>
      </section>

      <p className="font-mono text-[12px] text-tertiary">
        <Link href="/verify" className="text-accent no-underline hover:underline">
          How to verify a persona on 0G →
        </Link>
      </p>
    </div>
  );
}
