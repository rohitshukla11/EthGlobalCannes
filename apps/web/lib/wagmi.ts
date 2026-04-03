import { createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { injected } from "wagmi/connectors";

export const zgGalileoTestnet = defineChain({
  id: 16602,
  name: "0G Galileo Testnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evmrpc-testnet.0g.ai"] },
  },
  blockExplorers: {
    default: { name: "0G Scan", url: "https://chainscan-galileo.0g.ai" },
  },
});

export const wagmiConfig = createConfig({
  chains: [zgGalileoTestnet],
  connectors: [injected()],
  transports: {
    [zgGalileoTestnet.id]: http(),
  },
  ssr: true,
});
