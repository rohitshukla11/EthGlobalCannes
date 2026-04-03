import Link from "next/link";

export const dynamic = "force-dynamic";

export default function VerifyPage() {
  return (
    <div className="space-y-10">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-tertiary">Verification</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight text-primary sm:text-4xl">Verify on 0G</h1>
        <p className="mt-3 max-w-subtitle font-mono text-[13px] text-secondary">
          TwinNet splits proof across <span className="text-primary">0G Storage</span> (agent JSON &amp; memory blobs) and{" "}
          <span className="text-primary">0G Galileo</span> (iNFT contract). Use the steps below after minting a persona.
        </p>
      </header>

      <ol className="list-decimal space-y-8 pl-5 font-mono text-[13px] leading-relaxed text-secondary marker:text-accent">
        <li>
          <strong className="text-primary">Open your deployment receipt.</strong> From onboarding or{" "}
          <Link href="/marketplace" className="text-accent no-underline hover:underline">
            Marketplace
          </Link>
          , open your agent → <span className="text-primary">Deployment page</span> (
          <code className="text-tertiary">/agent/&lt;id&gt;/deployment</code>). There you’ll see token ID, config root, contract,
          and 0G Scan links.
        </li>
        <li>
          <strong className="text-primary">Confirm the iNFT.</strong> On{" "}
          <a
            href="https://chainscan-galileo.0g.ai"
            target="_blank"
            rel="noreferrer"
            className="text-accent no-underline hover:underline"
          >
            0G Scan
          </a>
          , open the <span className="text-primary">contract</span> from the receipt, or your <span className="text-primary">wallet</span>{" "}
          and find the NFT by token ID. The owner address should match the wallet you linked during onboarding.
        </li>
        <li>
          <strong className="text-primary">Config on 0G Storage.</strong> The persona’s initial JSON is uploaded before mint; the API
          stores the Merkle <span className="text-primary">config root</span> on the agent record. That root addresses the blob on the
          storage layer (via the indexer in{" "}
          <Link href="/chain" className="text-accent no-underline hover:underline">
            Chain &amp; contracts
          </Link>
          ). Raw bytes aren’t shown in the explorer the same way as ERC-721 metadata—the proof is the root + successful mint path
          in your API logs.
        </li>
        <li>
          <strong className="text-primary">Metadata URL.</strong> The NFT’s <span className="text-primary">token URI</span> points at{" "}
          <code className="text-tertiary">GET /nft/metadata/&lt;agentId&gt;</code> on your API. Open it in a browser to see JSON that
          includes the config root attribute.
        </li>
        <li>
          <strong className="text-primary">Conversations &amp; compute.</strong> Using the{" "}
          <Link href="/console" className="text-accent no-underline hover:underline">
            Interaction console
          </Link>
          , each reply runs through <span className="text-primary">0G Compute</span> and stores a new memory blob on{" "}
          <span className="text-primary">0G Storage</span>; the agent’s profile page lists accumulating roots.
        </li>
      </ol>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/chain"
          className="rounded-control border border-mid bg-raised px-4 py-2 font-mono text-[12px] text-accent no-underline hover:border-accent"
        >
          Chain &amp; contracts
        </Link>
        <Link
          href="/marketplace"
          className="rounded-control border border-mid bg-raised px-4 py-2 font-mono text-[12px] text-accent no-underline hover:border-accent"
        >
          Marketplace
        </Link>
      </div>
    </div>
  );
}
